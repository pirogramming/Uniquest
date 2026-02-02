from django.urls import path
from . import views

app_name = "missions"

urlpatterns = [
    path("", views.mission_list, name="mission_list"),
    path("new/", views.mission_create, name="mission_create"),
    path("location/pick/", views.location_picker, name="location_picker"),
    path("<int:mission_id>/", views.mission_detail, name="mission_detail"),
    path("<int:mission_id>/edit", views.mission_update, name="mission_update"),
    path("<int:mission_id>/accept", views.mission_accept, name="mission_accept"),
    path("tags/suggest/", views.tag_suggest, name="tag_suggest"),
]
