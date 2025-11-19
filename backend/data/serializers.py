from rest_framework import serializers

from .models import Data


class DataSerializer(serializers.ModelSerializer):
    text = serializers.CharField(max_length=1024, trim_whitespace=True, allow_blank=False, required=True)

    class Meta:
        model = Data
        fields = ["id", "text", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_text(self, value: str) -> str:
        if not isinstance(value, str):
            raise serializers.ValidationError("text must be a string")
        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError("text is required")
        return trimmed
