# camera/views.py
import hashlib
import os
import threading
import time
import uuid
from urllib.parse import urlparse

import cv2
from django.http import StreamingHttpResponse, HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

FRAME_INTERVAL = float(os.getenv("CAM_FRAME_INTERVAL", "0"))  # 例：0.05 ≈ 20fps


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
    if not cap.isOpened():
        cap.release()
        cap = cv2.VideoCapture(url)
    if cap.isOpened():
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass
        return cap
    cap.release()
    return None


def _is_url_allowed(url: str | None) -> bool:
    if not url:
        return False
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    return parsed.scheme in ("http", "https", "rtsp")


_ACTIVE_STREAMS: dict[str, threading.Event] = {}
_ACTIVE_STREAMS_LOCK = threading.Lock()


def _register_stream_session(client_id: str | None):
    if not client_id:
        return None
    event = threading.Event()
    previous = None
    with _ACTIVE_STREAMS_LOCK:
        previous = _ACTIVE_STREAMS.get(client_id)
        _ACTIVE_STREAMS[client_id] = event
    if previous:
        previous.set()
    return event


def _release_stream_session(client_id: str | None, token: threading.Event | None):
    if not client_id or token is None:
        return
    with _ACTIVE_STREAMS_LOCK:
        current = _ACTIVE_STREAMS.get(client_id)
        if current is token:
            _ACTIVE_STREAMS.pop(client_id, None)
    token.set()


def _abort_stream_session(client_id: str | None) -> bool:
    if not client_id:
        return False
    with _ACTIVE_STREAMS_LOCK:
        token = _ACTIVE_STREAMS.get(client_id)
    if token:
        token.set()
        return True
    return False


def _iter_stream(
    request,
    url: str,
    *,
    to_gray: bool,
    width: int | None,
    client_id: str | None,
    stop_token: threading.Event | None,
):
    cap = _open_capture(url)
    if cap is None:
        _release_stream_session(client_id, stop_token)
        return
    last_frame_ts = 0.0
    check_aborted = getattr(request, "is_aborted", None)

    def _request_disconnected() -> bool:
        if callable(check_aborted):
            try:
                return bool(check_aborted())
            except Exception:
                return False
        return False

    try:
        while True:
            if (stop_token and stop_token.is_set()) or _request_disconnected():
                break
            if FRAME_INTERVAL > 0:
                now = time.time()
                sleep = FRAME_INTERVAL - (now - last_frame_ts)
                if sleep > 0:
                    time.sleep(sleep)
                last_frame_ts = time.time()

            ok, frame = cap.read()
            if not ok or frame is None:
                break

            if width:
                h = int(frame.shape[0] * (width / frame.shape[1]))
                frame = cv2.resize(frame, (width, h))
            if to_gray:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if not ok:
                continue

            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n"
    finally:
        cap.release()
        _release_stream_session(client_id, stop_token)


@require_GET
def camera_stream(request):
    """
    /stream/                → 用環境變數 CAMERA_URL
    /stream/?url=...        → 指定來源 (http://IP:4747/video、rtsp://...)
    /stream/?gray=1&width=640
    """
    url = request.GET.get("url") or _open_ip()
    if not _is_url_allowed(url):
        return HttpResponse("Invalid or missing camera URL", status=400)

    to_gray = request.GET.get("gray") in ("1", "true", "True")
    w = request.GET.get("width")
    try:
        width = int(w) if w is not None else None
    except (ValueError, TypeError):
        width = None
    if width is not None and width < 16:
        width = 16

    client_id = request.GET.get("client")
    stop_token = _register_stream_session(client_id)

    response = StreamingHttpResponse(
        _iter_stream(
            request=request,
            url=url,
            to_gray=to_gray,
            width=width,
            client_id=client_id,
            stop_token=stop_token,
        ),
        content_type="multipart/x-mixed-replace; boundary=frame",
    )
    response["Cache-Control"] = "no-store"
    response["Pragma"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@require_GET
def stream_proof(request):
    """
    提供由後端簽章的資料，證明串流來源是由 Django 進行連線。
    """
    url = request.GET.get("url") or _open_ip()
    if not _is_url_allowed(url):
        return JsonResponse({"error": "Invalid or missing camera URL"}, status=400)

    parsed = urlparse(url)
    proof_payload = {
        "via_backend": True,
        "client_id": request.GET.get("client"),
        "request_id": uuid.uuid4().hex,
        "server_time": timezone.now().isoformat(),
        "camera_protocol": parsed.scheme,
        "camera_host": parsed.hostname,
        "camera_signature": hashlib.sha256(url.encode("utf-8")).hexdigest(),
    }
    return JsonResponse(proof_payload)


@require_POST
def abort_stream(request):
    client_id = request.GET.get("client") or request.POST.get("client")
    if not client_id:
        return JsonResponse({"error": "missing client"}, status=400)
    aborted = _abort_stream_session(client_id)
    return JsonResponse({"aborted": aborted})
