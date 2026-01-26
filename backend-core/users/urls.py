from django.urls import path
from .views import RegisterView, ProfileView, UnivCertView
from rest_framework_simplejwt.views import (
    TokenObtainPairView, # 로그인 (Access + Refresh 토큰 발급)
    TokenRefreshView,    # 토큰 갱신
)

urlpatterns = [
    path('signup/', RegisterView.as_view(), name='signup'),
    
    # 로그인 (이거 하나면 끝!)
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    path('profile/', ProfileView.as_view(), name='profile'),
    path('verify-univ/', UnivCertView.as_view(), name='verify_univ'),
]