from django.urls import path
from .views import RegisterView, ProfileView, UnivCertView
from rest_framework_simplejwt.views import (
    TokenObtainPairView, # 로그인 (Access + Refresh 토큰 발급)
    TokenRefreshView,    # 토큰 갱신
)

urlpatterns = [
    # 회원가입
    path('signup/', RegisterView.as_view(), name='signup'),
    
    # 로그인 (SimpleJWT 기본 제공 뷰 사용)
    # 아이디/비번을 POST로 보내면 access, refresh 토큰을 반환합니다.
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # 토큰 갱신 (Access 토큰 만료 시 Refresh 토큰으로 재발급)
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # 내 정보 조회
    path('profile/', ProfileView.as_view(), name='profile'),
    
    # 대학생 인증
    path('verify-univ/', UnivCertView.as_view(), name='verify_univ'),
]