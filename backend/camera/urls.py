from django.urls import path
from .views import camera_stream
urlpatterns = [
    path("stream/", camera_stream, name="camera-stream"),
]
