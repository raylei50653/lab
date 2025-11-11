# camera/views.py
import json
import os
import threading
import time
import uuid
import cv2
from django.http import StreamingHttpResponse, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

OPEN_RETRY_SEC = float(os.getenv("CAM_OPEN_RETRY", "2"))
FRAME_INTERVAL = float(os.getenv("CAM_FRAME_INTERVAL", "0"))  # 例：0.05 ≈ 20fps
STREAM_LOCK = threading.Lock()  # 確保同一時間只會有一個攝影機串流
STREAM_STATE_LOCK = threading.Lock()
CURRENT_STOP_EVENT = None
CURRENT_CLIENT_ID = None
CLIENT_LAST_ACK_AT = 0.0
CURRENT_CLIENT_REQUIRES_ACK = False
LOCK_WAIT_SEC = float(os.getenv("CAM_STREAM_LOCK_WAIT", "5"))
OPEN_TEST_TIMEOUT = float(os.getenv("CAM_OPEN_TEST_TIMEOUT", "8"))
CLIENT_ACK_TIMEOUT = float(os.getenv("CAM_CLIENT_ACK_TIMEOUT", "15"))  # 設 0 停用

def _open_ip():
    """
    來源優先：
    1) ?url=...   (HTTP MJPEG / RTSP)
    2) 環境變數 CAMERA_URL
    """
    return os.getenv("CAMERA_URL")

def _open_capture(url: str):
    """
    優先使用 FFMPEG，若失敗則退回預設 (CAP_ANY) 以容忍不同的 OpenCV 編譯選項。
    """
    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    if cap.isOpened():
        return cap
    cap.release()

    cap = cv2.VideoCapture(url)
    if cap.isOpened():
        return cap
    cap.release()
    return None

def _open_capture_with_retry(url: str, timeout: float):
    deadline = time.time() + timeout
    while True:
        cap = _open_capture(url)
        if cap is not None:
            return cap
        remaining = deadline - time.time()
        if remaining <= 0:
            return None
        time.sleep(min(OPEN_RETRY_SEC, max(remaining, 0)))

def _signal_existing_stream_stop():
    global CURRENT_STOP_EVENT, CURRENT_CLIENT_ID, CLIENT_LAST_ACK_AT
    with STREAM_STATE_LOCK:
        if CURRENT_STOP_EVENT is not None:
            CURRENT_STOP_EVENT.set()

def _register_stream(stop_event: threading.Event, client_id: str, require_ack: bool):
    global CURRENT_STOP_EVENT, CURRENT_CLIENT_ID, CLIENT_LAST_ACK_AT, CURRENT_CLIENT_REQUIRES_ACK
    with STREAM_STATE_LOCK:
        CURRENT_STOP_EVENT = stop_event
        CURRENT_CLIENT_ID = client_id
        CLIENT_LAST_ACK_AT = time.time()
        CURRENT_CLIENT_REQUIRES_ACK = require_ack

def _clear_stream(stop_event: threading.Event):
    global CURRENT_STOP_EVENT, CURRENT_CLIENT_ID, CLIENT_LAST_ACK_AT, CURRENT_CLIENT_REQUIRES_ACK
    with STREAM_STATE_LOCK:
        if CURRENT_STOP_EVENT is stop_event:
            CURRENT_STOP_EVENT = None
            CURRENT_CLIENT_ID = None
            CLIENT_LAST_ACK_AT = 0.0
            CURRENT_CLIENT_REQUIRES_ACK = False

def _touch_client_ack(client_id: str):
    global CLIENT_LAST_ACK_AT
    with STREAM_STATE_LOCK:
        if not (CURRENT_CLIENT_ID and client_id == CURRENT_CLIENT_ID):
            return False
        CLIENT_LAST_ACK_AT = time.time()
        return True

def _stop_stream_for_client(client_id: str | None):
    with STREAM_STATE_LOCK:
        if CURRENT_STOP_EVENT is None:
            return False
        if CURRENT_CLIENT_ID and client_id and client_id != CURRENT_CLIENT_ID:
            return False
        CURRENT_STOP_EVENT.set()
        return True

def _client_ack_expired(stop_event: threading.Event):
    if CLIENT_ACK_TIMEOUT <= 0:
        return False
    with STREAM_STATE_LOCK:
        if stop_event is not CURRENT_STOP_EVENT:
            return False
        if not CURRENT_CLIENT_ID or not CURRENT_CLIENT_REQUIRES_ACK:
            return False
        return (time.time() - CLIENT_LAST_ACK_AT) > CLIENT_ACK_TIMEOUT

def _gen_ip(url: str, to_gray=False, width=None, stop_event=None):
    cap = None
    last = 0.0
    try:
        while True:
            if stop_event is not None and stop_event.is_set():
                break
            # 節流（可降低 CPU/頻寬）
            if FRAME_INTERVAL > 0:
                now = time.time()
                sleep = FRAME_INTERVAL - (now - last)
                if sleep > 0:
                    time.sleep(sleep)
                last = time.time()

            # 確保連線
            if cap is None:
                cap = _open_capture(url)
                if cap is None:
                    time.sleep(OPEN_RETRY_SEC)
                    continue

            ok, frame = cap.read()
            if not ok or frame is None:
                cap.release()
                cap = None
                time.sleep(OPEN_RETRY_SEC)
                continue

            if width:
                h = int(frame.shape[0] * (width / frame.shape[1]))
                frame = cv2.resize(frame, (width, h))
            if to_gray:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if not ok:
                continue

            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n")

            if stop_event is not None and _client_ack_expired(stop_event):
                break
    finally:
        if cap is not None:
            cap.release()

@require_GET
def camera_stream(request):
    """
    /stream/                → 用環境變數 CAMERA_URL
    /stream/?url=...        → 指定來源 (http://IP:4747/video、rtsp://...)
    /stream/?gray=1&width=640
    """
    url = request.GET.get("url") or _open_ip()
    if not url:
        return HttpResponse("No CAMERA_URL or ?url provided", status=400)

    to_gray = request.GET.get("gray") in ("1", "true", "True")
    w = request.GET.get("width")
    width = int(w) if (w and w.isdigit()) else None

    _signal_existing_stream_stop()

    # 先測試一次連線，失敗回 503
    if not STREAM_LOCK.acquire(timeout=LOCK_WAIT_SEC):
        return HttpResponse("Camera stream still running, please close it before updating.", status=423)

    stop_event = threading.Event()
    client_from_request = request.GET.get("client")
    client_id = client_from_request or uuid.uuid4().hex

    test = _open_capture_with_retry(url, OPEN_TEST_TIMEOUT)
    if test is None:
        STREAM_LOCK.release()
        return HttpResponse(f"Cannot open camera URL: {url}", status=503)
    test.release()

    _register_stream(stop_event, client_id, require_ack=bool(client_from_request))
    if client_from_request:
        _touch_client_ack(client_id)

    def stream_with_lock():
        try:
            yield from _gen_ip(url, to_gray=to_gray, width=width, stop_event=stop_event)
        finally:
            _clear_stream(stop_event)
            STREAM_LOCK.release()

    response = StreamingHttpResponse(
        stream_with_lock(),
        content_type="multipart/x-mixed-replace; boundary=frame"
    )
    response["X-Stream-Client"] = client_id
    return response

@csrf_exempt
@require_POST
def camera_stream_control(request):
    """
    接收前端 heartbeat / stop 指令，避免串流在客戶端中斷時占用。
    """
    payload = {}
    content_type = request.META.get("CONTENT_TYPE", "")
    if content_type.startswith("application/json"):
        try:
            payload = json.loads(request.body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            payload = {}
    elif request.POST:
        payload = request.POST

    action = (payload.get("action") or "ack").lower()
    client_id = payload.get("client") or payload.get("client_id")

    if action not in ("ack", "stop"):
        return JsonResponse({"ok": False, "error": "Unsupported action"}, status=400)
    if not client_id:
        return JsonResponse({"ok": False, "error": "Missing client id"}, status=400)

    if action == "ack":
        touched = _touch_client_ack(client_id)
        status = 200 if touched else 404
        return JsonResponse({"ok": touched, "active": touched}, status=status)

    stopped = _stop_stream_for_client(client_id)
    return JsonResponse({"ok": True, "stopped": stopped})
