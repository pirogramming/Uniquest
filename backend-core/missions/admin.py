from django.contrib import admin
from .models import Mission, Review

@admin.register(Mission)
class MissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'requester', 'helper', 'status', 'created_at')
    list_filter = ('status', 'university')
    search_fields = ('title', 'content')

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('id', 'mission', 'writer', 'target', 'created_at')