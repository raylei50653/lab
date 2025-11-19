from rest_framework import generics, permissions

from .models import Data
from .serializers import DataSerializer


class DataListCreateView(generics.ListCreateAPIView):
    serializer_class = DataSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        keyword = (self.request.query_params.get("search") or "").strip()
        queryset = Data.objects.all()
        if keyword:
            queryset = queryset.filter(text__icontains=keyword)
        return queryset.order_by("id")


class DataRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DataSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Data.objects.all().order_by("id")
