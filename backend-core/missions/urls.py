from django.urls import path
from . import views

app_name = "missions"

urlpatterns = [
    # --- 1. 화면 렌더링 (GET) ---
    path("", views.mission_list, name="mission_list"),
    path("new/", views.mission_create_view, name="mission_create_view"),
    path("<int:mission_id>/", views.mission_detail, name="mission_detail"),
    path("<int:mission_id>/accept", views.mission_accept, name="mission_accept"),
    path("<int:mission_id>/chat/start/", views.start_chat, name="start_chat"),
    path("<int:mission_id>/chat/<int:room_id>/", views.chat_room, name="chat_room"),
    path("<int:mission_id>/edit/", views.mission_update_view, name="mission_update_view"),
    path("location/pick/", views.location_picker, name="location_picker"),
    path("chat/", views.chat_list, name="chat_list"),
    path("api/chat/room/<int:room_id>/participants/", views.chat_room_participants, name="chat_room_participants"),
    path("api/<int:mission_id>/confirm/", views.mission_confirm_helper, name="mission_confirm_helper_api"),
    path("api/<int:mission_id>/reject/", views.mission_reject_helper, name="mission_reject_helper_api"),
    path("api/<int:mission_id>/complete/", views.mission_complete, name="mission_complete_api"),
    # --- 2. 실제 데이터 처리 API (POST/PATCH) ---
    # JS에서 호출할 주소들입니다.
    path("api/create/", views.mission_create, name="mission_create_api"),
    path("api/<int:mission_id>/update/", views.mission_update, name="mission_update_api"),
    path("api/list/", views.get_mission_list, name="mission_list_api"),
    path("api/<int:mission_id>/accept/", views.mission_accept, name="mission_accept_api"),
    path("api/<int:mission_id>/delete/", views.mission_delete, name="mission_delete_api"),
    path("api/tags/suggest/", views.tag_suggest, name="tag_suggest_api"),
    path('api/<int:mission_id>/detail/', views.get_mission_detail, name='mission_detail_api'),
]
