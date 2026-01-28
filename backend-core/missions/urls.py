from django.urls import path
from . import views

urlpatterns = [
    path("map/", views.sy_map, name="sy_map"),
]
