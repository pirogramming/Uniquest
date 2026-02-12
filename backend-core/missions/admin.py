# Register your models here.
# missions/admin.py
from django.contrib import admin
from django.utils.html import format_html
from .models import Mission, Tag, MissionImage


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "category", "is_default", "is_active", "order", "created_at")
    list_filter = ("category", "is_default", "is_active")
    search_fields = ("name", "slug")


class MissionImageInline(admin.TabularInline):
    model = MissionImage
    extra = 0
    fields = ("image_preview", "image")
    readonly_fields = ("image_preview",)

    def image_preview(self, obj):
        """업로드된 미션 사진 미리보기"""
        if not obj.pk or not obj.image:
            return "-"
        return format_html(
            '<img src="{}" style="max-width: 80px; max-height: 80px; object-fit: cover;" />',
            obj.image.url,
        )
    image_preview.short_description = "미리보기"


@admin.register(Mission)
class MissionAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "author", "helper", "category", "status", "deadline", "location_name", "created_at")
    list_filter = ("category", "status")
    search_fields = ("title", "descriptions", "author__username", "helper__username", "location_name")
    inlines = [MissionImageInline]
