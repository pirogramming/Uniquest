from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User  # 찬웅님이 만든 유저 모델

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    # 관리자 목록 화면에서 보여줄 필드 (닉네임, 학교, 인증여부 추가)
    list_display = ('username', 'email', 'nickname', 'university', 'is_student_verified', 'is_staff')
    
    # 상세 수정 페이지에 찬웅님이 만든 커스텀 필드들을 추가
    fieldsets = UserAdmin.fieldsets + (
        ('Uniquest 정보', {'fields': ('nickname', 'university', 'is_student_verified', 'univ_email', 'manner_score')}),
    )
    
    # 관리자 페이지에서 유저를 새로 생성할 때 필요한 필드
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('추가 정보', {'fields': ('nickname', 'university', 'univ_email')}),
    )