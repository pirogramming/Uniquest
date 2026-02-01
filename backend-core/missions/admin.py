# Register your models here.
# missions/admin.py
from django.contrib import admin
from .models import Mission, Tag, MissionImage


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "category", "is_default", "is_active", "order", "created_at")
    list_filter = ("category", "is_default", "is_active")
    search_fields = ("name", "slug")


class MissionImageInline(admin.TabularInline):
    model = MissionImage
    extra = 0


@admin.register(Mission)
class MissionAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "author", "helper", "category", "status", "deadline", "location_name", "created_at")
    list_filter = ("category", "status")
    search_fields = ("title", "descriptions", "author__username", "helper__username", "location_name")
    inlines = [MissionImageInline]
