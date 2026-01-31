from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    # 1. 관리자 목록 화면 설정 (차단 인원수 열 추가)
    list_display = (
        'username', 'email', 'nickname', 'university', 
        'is_student_verified', 'is_staff', 'get_blocked_count'
    )
    
    # 2. ManyToMany 필드를 가로형 선택 박스 UI로 변경
    filter_horizontal = ('blocked_people',) 

    # 3. 상세 수정 페이지 구성 (Uniquest 정보 섹션에 차단 필드 추가)
    fieldsets = UserAdmin.fieldsets + (
        ('Uniquest 정보', {'fields': (
            'nickname', 
            'university', 
            'is_student_verified', 
            'univ_email', 
            'manner_score',
            'blocked_people'
        )}),
    )
    
    # 4. 유저를 새로 생성할 때 필요한 필드
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('추가 정보', {'fields': ('nickname', 'university', 'univ_email')}),
    )

    # 5. 목록 화면에서 차단 인원수를 보여주기 위한 계산 함수
    def get_blocked_count(self, obj):
        return obj.blocked_people.count()
    
    get_blocked_count.short_description = "차단 인원수"