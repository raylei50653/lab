from django.urls import path

from .views import abort_stream, camera_stream, stream_proof

urlpatterns = [
    path("stream/", camera_stream, name="camera-stream"),
    path("stream/proof/", stream_proof, name="camera-stream-proof"),
    path("stream/abort/", abort_stream, name="camera-stream-abort"),
]
