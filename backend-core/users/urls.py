from django.urls import path
from .views import RegisterView, ProfileView
from rest_framework_simplejwt.views import (
    TokenObtainPairView, # 로그인 (Access + Refresh 토큰 발급)
    TokenRefreshView,    # 토큰 갱신
)
from . import views
from .views import MyLoginView

app_name = 'users'

urlpatterns = [
    path('signup/',views.signup_page,name="signup"),
    path('signup-data/', RegisterView.as_view(), name='signup-data'),
    path('verify-email/', views.verify_email, name='verify-email'),
    
    # 로그인 (이거 하나면 끝!)
    path('login/',views.login_page,name="login"),
    path('login_logic/', MyLoginView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    path('profile/', ProfileView.as_view(), name='profile'),
    # path('verify-univ/', UnivCertView.as_view(), name='verify_univ'),
]