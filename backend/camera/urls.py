from django.urls import path
from .views import camera_stream, camera_stream_control
urlpatterns = [
    path("stream/", camera_stream, name="camera-stream"),
    path("stream/control/", camera_stream_control, name="camera-stream-control"),
]
