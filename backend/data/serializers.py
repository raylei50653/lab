from rest_framework import serializers

from .models import Data


class DataSerializer(serializers.ModelSerializer):
    class Meta:
        model = Data
        fields = ["id", "text", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_text(self, value: str) -> str:
        return value.strip() if isinstance(value, str) else value
