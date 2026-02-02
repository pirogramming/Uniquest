from django.urls import path
from . import views
from .views import RegisterView, ProfileView, MyLoginView
from rest_framework_simplejwt.views import TokenRefreshView

app_name = 'users'

urlpatterns = [
    # 1. 회원가입 (HTML 페이지 연결 삭제 -> API 연결)
    path('signup/', views.signup_page),
    path('signup/submit/', RegisterView.as_view(), name='signup'),
    
    # 2. 이메일 인증
    path('verify-email/', views.verify_email, name='verify-email'),
    
    # 3. 로그인: GET → 로그인 페이지, POST → login/submit/ (API)
    path('login/', views.login_page, name='login'),
    path('login/submit/', MyLoginView.as_view(), name='login_submit'),
    
    # 4. 토큰 갱신 (선택 사항)
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # 5. 내 정보 조회
    path('profile/', ProfileView.as_view(), name='profile'),

    # 마이페이지 메인
    path('mypage/', views.mypage_view, name='mypage_screen'),
    path('api/profile/', views.get_my_info, name='get_my_info_api'),
    # 마이페이지 수정
    path('mypage_modify/', views.mypage_modify_view, name='mypage_modify_screen'),
    path('api/profile_modify/', views.get_my_info_patch, name='get_my_info_api_patch'),
    #차단 유저 관리
    path('blocked_users/',views.get_blocked_users,name="blocked_users"),
    path('api/blocked_users/',views.get_blocked_users_info,name="blocked_user_info"),
]