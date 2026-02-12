from django.contrib import admin
from django.urls import path, include
from django.conf import settings  # 하단에 있던 것을 위로 이동
from django.conf.urls.static import static  # 하단에 있던 것을 위로 이동

# Swagger 관련 임포트
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework import permissions

# === Swagger 설정 ===
schema_view = get_schema_view(
   openapi.Info(
      title="Uniquest API 문서",
      default_version='v1',
      description="팀원들아, API 명세서는 여기서 확인해! (Swagger)",
      terms_of_service="https://www.google.com/policies/terms/",
      contact=openapi.Contact(email="team@uniquest.com"),
      license=openapi.License(name="BSD License"),
   ),
   public=True,
   permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    path('api/admin/', admin.site.urls),
    path('api/missions/', include('missions.urls')), # 관례상 api/ 를 붙여주는 것이 좋습니다.
    path('api/users/', include('users.urls')),

    # Swagger 문서 접속 주소
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]

# 미디어/정적 파일 설정 (이 부분이 리스트 바깥으로 깔끔하게 빠져야 합니다)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    # static: STATICFILES_DIRS(static/)에서 서빙 (room.css 등)
    from django.contrib.staticfiles.urls import staticfiles_urlpatterns
    urlpatterns += staticfiles_urlpatterns()
