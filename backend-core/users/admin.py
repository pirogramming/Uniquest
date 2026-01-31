from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.admin.sites import NotRegistered  # 👈 여기가 핵심!
from .models import User, University

# 1. 대학교 모델 등록
@admin.register(University)
class UniversityAdmin(admin.ModelAdmin):
    list_display = ('name', 'domain')

# 2. 유저 모델 재등록을 위한 안전장치
try:
    admin.site.unregister(User)
except NotRegistered:  # 👈 이제 에러 안 날 겁니다
    pass

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'nickname', 'university', 'is_student_verified', 'is_staff')
    
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('개인 정보', {'fields': ('first_name', 'last_name', 'email')}),
        ('Uniquest 추가 정보', {
            'fields': (
                'nickname', 
                'university',
                'is_student_verified', 
                'univ_email', 
                'reliability_score'
            )
        }),
        ('권한', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('중요 날짜', {'fields': ('last_login', 'date_joined')}),
    )