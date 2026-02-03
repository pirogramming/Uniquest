from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User
from missions.models import Mission  # 미션 모델 임포트

# 1. 유저가 '작성한' 미션 목록 (역참조)
class AuthoredMissionInline(admin.TabularInline):
    model = Mission
    fk_name = 'author'  # User를 가리키는 FK가 2개이므로 작성자 필드 명시
    extra = 0
    verbose_name = "내가 등록한 미션"
    verbose_name_plural = "내가 등록한 미션들"
    fields = ('title', 'category', 'status', 'reward', 'created_at')
    readonly_fields = ('created_at',)
    show_change_link = True # 클릭 시 미션 상세페이지로 이동

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    # 1. 관리자 목록 화면 설정
    list_display = (
        'username', 'email', 'nickname', 'university', 
        'is_student_verified', 'is_staff', 
        'get_mission_count', 'get_blocked_count'
    )
    
    # 2. ManyToMany 필드 가로형 UI
    filter_horizontal = ('blocked_people',) 

    # 3. 역참조 인라인 등록
    inlines = [AuthoredMissionInline]

    # 4. 상세 수정 페이지 구성
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
    
    # 5. 유저 생성 시 필드 구성
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('추가 정보', {'fields': ('nickname', 'university', 'univ_email')}),
    )

    # --- 계산 필드 정의 ---

    def get_blocked_count(self, obj):
        return obj.blocked_people.count()
    get_blocked_count.short_description = "차단 인원"

    def get_mission_count(self, obj):
        return obj.missions.count()  # related_name='missions' 기반
    get_mission_count.short_description = "등록 미션수"