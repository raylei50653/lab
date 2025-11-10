from django.contrib import admin
from .models import Data

@admin.register(Data)
class DataAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "updated_at")
    search_fields = ("id",)
