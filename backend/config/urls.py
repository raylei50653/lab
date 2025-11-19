from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def healthz(request):
    return JsonResponse({"ok": True})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz/", healthz),
    path("", include("data.urls")),
    path("", include("camera.urls")),
]
