from django.urls import path
from .views import RegisterView
from rest_framework_simplejwt.views import (
    TokenObtainPairView, # 로그인 (Access + Refresh 토큰 발급)
    TokenRefreshView,    # 토큰 갱신
)
from . import views
from .views import MyLoginView

app_name = 'users'

urlpatterns = [
    #회원가입
    path('signup/',views.signup_page,name="signup"),
    path('signup-data/', RegisterView.as_view(), name='signup-data'),
    path('verify-email/', views.verify_email, name='verify-email'),
    
    # 로그인
    path('login/',views.login_page,name="login"),
    path('login_logic/', MyLoginView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    #로그아웃
    path('logout/',views.logout,name='logout'),

    # 마이페이지 메인
    path('mypage/', views.mypage_view, name='mypage_screen'),
    path('api/profile/', views.get_my_info, name='get_my_info_api'),

    # 마이페이지 수정
    path('mypage_modify/', views.mypage_modify_view, name='mypage_modify_screen'),
    path('api/profile_modify/', views.get_my_info_patch, name='get_my_info_api_patch'),

    #차단 유저 관리
    path('blocked_users/',views.get_blocked_users,name="blocked_users"),
    path('api/blocked_users/',views.get_blocked_users_info,name="blocked_user_info"),

    #홈 페이지
    path('homepage/',views.get_home_page,name="homepage"),
    path('api/homepage',views.get_homepage_info,name="homepage_info"),
]