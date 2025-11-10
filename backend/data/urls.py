from django.urls import path
from . import views

urlpatterns = [
    path("data/", views.data_collection, name="data-collection"),
    path("data/<int:pk>/", views.data_detail, name="data-detail"),
]
