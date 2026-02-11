from django.urls import path
from . import views
from .views import RegisterView, ProfileView, MyLoginView
from rest_framework_simplejwt.views import TokenRefreshView

app_name = 'users'

urlpatterns = [
    # 1. 회원가입 (HTML 페이지 연결 삭제 -> API 연결)
    path('signup/', views.signup_page,name='signup_view'),
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

    #6. 로그아웃 하기
    path('logout/',views.logout,name="logout"),

    # 마이페이지 메인
    path('mypage/', views.mypage_view, name='mypage_screen'),
    path('api/profile/', views.get_my_info, name='get_my_info_api'),
    # 마이페이지 수정
    path('mypage_modify/', views.mypage_modify_view, name='mypage_modify_screen'),
    path('api/profile_modify/', views.get_my_info_patch, name='get_my_info_api_patch'),
    #차단 유저 관리
    path('blocked_users/',views.get_blocked_users,name="blocked_users"),
    path('api/blocked_users/',views.get_blocked_users_info,name="blocked_user_info"),
    path('api/block_user/', views.block_user, name="block_user"),

    #홈페이지
    path('homepage/', views.get_home_page, name="homepage"),
    path('homepage_guest/', views.get_home_page_guest, name="homepage_guest"),
    path('api/homepage/', views.get_homepage_info, name="homepage_info"),
    path('api/homepage_unlogin/',views.get_homepage_info_unlogin,name="homepage_unlogin"),

    #회원탈퇴 페이지
    path('api/signout/',views.signout,name="signout"),

    #비밀번호 찾기
    path('check_password/',views.check_password,name="check_password"),
    path('verify-email-check/', views.verify_email_check, name='verify-email-check'),
    path('change_password/',views.change_password_render,name="change_password"),
    path('change_password/info/',views.change_password,name="change_password_info"),

    #리뷰 페이지
    path('review_page/<int:mission_id>/',views.render_review_page,name="review_page"),
    path('review_page_info/<int:mission_id>/',views.render_review_page_info,name="review_page_info"),
]