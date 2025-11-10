# camera/views.py
import os, time, threading
import cv2
from django.http import StreamingHttpResponse, HttpResponse
from django.views.decorators.http import require_GET

OPEN_RETRY_SEC = float(os.getenv("CAM_OPEN_RETRY", "2"))
FRAME_INTERVAL = float(os.getenv("CAM_FRAME_INTERVAL", "0"))  # 例：0.05 ≈ 20fps
STREAM_LOCK = threading.Lock()  # 確保同一時間只會有一個攝影機串流
STREAM_STATE_LOCK = threading.Lock()
CURRENT_STOP_EVENT = None
LOCK_WAIT_SEC = float(os.getenv("CAM_STREAM_LOCK_WAIT", "5"))
OPEN_TEST_TIMEOUT = float(os.getenv("CAM_OPEN_TEST_TIMEOUT", "8"))

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
    global CURRENT_STOP_EVENT
    with STREAM_STATE_LOCK:
        if CURRENT_STOP_EVENT is not None:
            CURRENT_STOP_EVENT.set()

def _register_stream_stop_event(stop_event: threading.Event):
    global CURRENT_STOP_EVENT
    with STREAM_STATE_LOCK:
        CURRENT_STOP_EVENT = stop_event

def _clear_stream_stop_event(stop_event: threading.Event):
    global CURRENT_STOP_EVENT
    with STREAM_STATE_LOCK:
        if CURRENT_STOP_EVENT is stop_event:
            CURRENT_STOP_EVENT = None

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

    test = _open_capture_with_retry(url, OPEN_TEST_TIMEOUT)
    if test is None:
        _clear_stream_stop_event(stop_event)
        STREAM_LOCK.release()
        return HttpResponse(f"Cannot open camera URL: {url}", status=503)
    test.release()

    stop_event = threading.Event()
    _register_stream_stop_event(stop_event)

    def stream_with_lock():
        try:
            yield from _gen_ip(url, to_gray=to_gray, width=width, stop_event=stop_event)
        finally:
            _clear_stream_stop_event(stop_event)
            STREAM_LOCK.release()

    return StreamingHttpResponse(
        stream_with_lock(),
        content_type="multipart/x-mixed-replace; boundary=frame"
    )
