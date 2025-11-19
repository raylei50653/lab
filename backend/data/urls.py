from django.urls import path

from .views import DataListCreateView, DataRetrieveUpdateDestroyView


urlpatterns = [
    path("data/", DataListCreateView.as_view(), name="data-collection"),
    path("data/<int:pk>/", DataRetrieveUpdateDestroyView.as_view(), name="data-detail"),
]
