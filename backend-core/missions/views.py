from __future__ import annotations

import json
import logging
from typing import Any

from django.contrib.auth.decorators import login_required
from django.db import transaction, models
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.core.exceptions import PermissionDenied

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .serializers import MissionSerializer

from .forms import MissionCreateForm
from .models import Mission, MissionImage, Tag, Category, ChatRoom
from common.utils import publish_chat_event
from common.utils import publish_mission_update  # ✨ 추가


logger = logging.getLogger(__name__)

# --- 헬퍼 함수 (그대로 유지) ---
def _slugify_simple(name: str) -> str:
    s = (name or "").strip().lower()
    s = s.replace("#", "")
    s = s.replace(" ", "-")
    s = s.replace("--", "-")
    return (s[:50] or "tag")

# --- 1. 화면 렌더링 View (GET 요청용) ---

def location_picker(request: HttpRequest) -> HttpResponse:
    return render(request, "missions/location_picker.html")

def mission_create_view(request: HttpRequest) -> HttpResponse:
    """미션 생성 페이지 렌더링"""
    initial: dict[str, Any] = {}
    for key in ["loc_name", "lat", "lng", "addr"]:
        val = request.GET.get(key)
        if val:
            if key == "loc_name": initial["location_name"] = val
            elif key == "lat": initial["location_lat"] = val
            elif key == "lng": initial["location_lng"] = val
            elif key == "addr": initial["location_address"] = val
    form = MissionCreateForm(initial=initial)
    return render(request, "missions/mission_form.html", {"form": form, "is_update": False})

def mission_update_view(request: HttpRequest, mission_id: int) -> HttpResponse:
    """미션 수정 페이지 렌더링"""
    mission = get_object_or_404(Mission, id=mission_id)
    initial = {
        "location_name": request.GET.get("loc_name") or getattr(mission, "location_name", ""),
        "location_lat": request.GET.get("lat") or getattr(mission, "location_lat", None),
        "location_lng": request.GET.get("lng") or getattr(mission, "location_lng", None),
        "location_address": request.GET.get("addr") or getattr(mission, "location_address", ""),
    }
    form = MissionCreateForm(instance=mission, initial=initial)
    form.fields["tags_existing"].initial = list(mission.tags.filter(is_active=True))
    return render(request, "missions/mission_form.html", {"form": form, "is_update": True, "mission": mission})

def mission_detail(request: HttpRequest, mission_id: int) -> HttpResponse:
    """화면 뼈대만 보여줍니다."""
    mission = get_object_or_404(Mission, id=mission_id)
    return render(request, "missions/mission_detail.html", {"mission": mission})

def mission_list(request: HttpRequest) -> HttpResponse:
    return render(request, "missions/mission_list.html")


# --- 2. 백엔드 API 로직 (JWT 인증 및 데이터 처리) ---

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def mission_create(request):
    """실제 미션 저장 API"""
    form = MissionCreateForm(request.POST, request.FILES)
    if form.is_valid():
        try:
            mission = form.save(commit=False)
            mission.author = request.user # JWT에서 추출된 유저
            mission.save()

            # 태그 및 이미지 로직 (기존 유지)
            tags_existing = form.cleaned_data.get("tags_existing")
            if tags_existing:
                for tag in tags_existing: mission.tags.add(tag)

            custom_names = form.cleaned_data.get("__custom_tag_names", [])
            for name in custom_names:
                if not name: continue
                tag_slug = "urgent" if name in ["급해요", "급함", "urgent"] else _slugify_simple(name)
                tag_defaults = {"name": name, "is_default": (tag_slug == "urgent"), "is_active": True, "order": 0 if tag_slug == "urgent" else 999}
                tag, _ = Tag.objects.get_or_create(category=None if tag_slug == "urgent" else mission.category, slug=tag_slug, defaults=tag_defaults)
                mission.tags.add(tag)

            images = request.FILES.getlist("images")
            for f in images:
                if f: MissionImage.objects.create(mission=mission, image=f)

            publish_mission_update({
                "action": "CREATE",
                "mission_id": mission.id,
                "data": MissionSerializer(mission).data
            })

            return Response({"success": True, "mission_id": mission.id}, status=status.HTTP_201_CREATED)
        except Exception:
            logger.exception("미션 생성 중 오류 발생")
            return Response({"error": "미션 생성 중 서버 오류가 발생했습니다."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response({"error": form.errors}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PATCH', 'POST']) # HTML Form은 PATCH를 지원하지 않을 수 있어 POST도 허용
@permission_classes([IsAuthenticated])
@transaction.atomic
def mission_update(request, mission_id):
    """실제 미션 수정 API"""
    mission = get_object_or_404(Mission, id=mission_id)

    if mission.author != request.user:
        return Response({"error": "작성자만 수정할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN)

    form = MissionCreateForm(request.POST, request.FILES, instance=mission)
    if form.is_valid():
        try:
            mission = form.save(commit=False)
            mission.save()
            mission.tags.clear()
            
            # 태그 및 새 이미지 추가 로직 (기존 유지)
            tags_existing = form.cleaned_data.get("tags_existing")
            if tags_existing:
                for tag in tags_existing: mission.tags.add(tag)

            custom_names = form.cleaned_data.get("__custom_tag_names", [])
            for name in custom_names:
                if not name: continue
                tag_slug = "urgent" if name in ["급해요", "급함", "urgent"] else _slugify_simple(name)
                tag, _ = Tag.objects.get_or_create(category=None if tag_slug == "urgent" else mission.category, slug=tag_slug, defaults={"name": name, "is_default": (tag_slug == "urgent"), "is_active": True, "order": 999})
                mission.tags.add(tag)

            new_images = request.FILES.getlist("images")
            for f in new_images:
                if f: MissionImage.objects.create(mission=mission, image=f)

            return Response({"success": True, "mission_id": mission.id})
        except Exception:
            return Response({"error": "수정 중 오류 발생"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response({"error": form.errors}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_mission_list(request):
    """JSON으로 미션 목록 반환 (Serializer 적용 버전)"""
    # 관련 데이터를 한 번에 가져오도록(Select/Prefetch) 최적화
    qs = Mission.objects.select_related("author").prefetch_related("tags", "images").order_by("-created_at")
    
    # 필터링 로직
    category = request.GET.get("category")
    if category in Category.values:
        qs = qs.filter(category=category)
    
    urgent = request.GET.get("urgent")
    if urgent in ["1", "true", "True"]:
        qs = qs.filter(tags__slug="urgent", tags__category__isnull=True)
    
    # ⭐ 핵심 수정 부분: 시리얼라이저 사용
    # 기존 data = list(qs.values(...)) 방식은 좌표값이 빠지거나 형식이 제한적이었음
    serializer = MissionSerializer(qs, many=True)
    
    # serializer.data 안에는 이제 location_lat, location_lng가 포함되어 있습니다.
    return Response({"results": serializer.data})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_mission_detail(request, mission_id):
    """실제 유저 정보와 작성자 여부를 포함한 데이터를 반환합니다."""
    mission = get_object_or_404(
        Mission.objects.prefetch_related("tags", "images").select_related("author"),
        id=mission_id
    )
    
    # Serializer로 데이터 변환
    serializer = MissionSerializer(mission)
    data = serializer.data
    
    # ⭐ 현재 로그인한 유저가 작성자인지 여부 추가
    data['is_author'] = (mission.author == request.user)
    
    return Response(data)

@api_view(['GET'])
def tag_suggest(request):
    """태그 자동완성 API"""
    q = (request.GET.get("q") or "").strip().lstrip("#")
    category = request.GET.get("category")
    if not q: return Response({"results": []})

    qs = Tag.objects.filter(is_active=True, name__istartswith=q)
    if category in Category.values:
        qs = qs.filter(models.Q(category=category) | models.Q(category__isnull=True))
    qs = qs.order_by("category", "order", "name")[:10]

    data = [{"id": t.id, "name": t.name, "display": f"#{t.name}", "slug": t.slug} for t in qs]
    return Response({"results": data})

# views.py에 추가할 부분 (mission_accept 함수 바로 위에 추가하세요)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def mission_delete(request, mission_id):
    """미션 삭제 API - 작성자만 삭제 가능"""
    mission = get_object_or_404(Mission, id=mission_id)
    
    # 작성자만 삭제 가능
    if mission.author != request.user:
        return Response({"error": "작성자만 삭제할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        # SSE로 삭제 알림 (삭제 전에 먼저 발행)
        publish_mission_update({
            "action": "DELETE",
            "mission_id": mission.id
        })
        
        # 미션 삭제 (연관된 MissionImage, MissionTag도 CASCADE로 자동 삭제됨)
        mission.delete()
        
        return Response({
            "success": True,
            "message": "미션이 삭제되었습니다."
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception("미션 삭제 중 오류 발생")
        return Response({
            "error": "미션 삭제 중 오류가 발생했습니다."
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def mission_accept(request, mission_id):
    """미션 수락 로직. 채팅방 안에서 호출. room_id는 body로 전달해 해당 채팅방에 알림."""
    mission = get_object_or_404(Mission, id=mission_id)
    
    if mission.status != "WAITING":
        return Response({"error": "이미 매칭된 미션입니다."}, status=status.HTTP_400_BAD_REQUEST)
    
    if mission.author == request.user:
        return Response({"error": "자신의 미션은 수락할 수 없습니다."}, status=status.HTTP_400_BAD_REQUEST)
    
    mission.status = "MATCHED"
    mission.helper = request.user
    mission.save()

    # 채팅방 ID(room_id)가 있으면 그 방에 알림, 없으면 mission_id로(하위 호환)
    room_id = (request.data.get("room_id") if getattr(request, "data", None) else None) or None
    rid = str(room_id) if room_id is not None else str(mission.id)

    publish_chat_event(
        room_id=rid,
        event_type="SYSTEM",
        data={"content": "매칭이 성사되었습니다! 대화를 시작해보세요."}
    )
    
    return JsonResponse({
        "success": True,
        "message": "미션 수락이 완료되었습니다.",
        "mission_id": mission.id
    })


@login_required
def kick_from_chat_room(request: HttpRequest, mission_id: int) -> JsonResponse:
    """
    채팅방에서 유저 강퇴 (방장만 가능). Redis KICK 이벤트 발행.
    room_id는 body로 전달해 해당 채팅방에 KICK 전송.
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST 요청만 허용됩니다."}, status=405)

    mission = get_object_or_404(Mission.objects.select_related("author", "helper"), id=mission_id)
    if request.user != mission.author:
        return JsonResponse({"error": "방장만 강퇴할 수 있습니다."}, status=403)

    try:
        body = json.loads(request.body) if request.body else {}
        raw = request.POST.get("target_id") or (body.get("target_id") if body else None)
        target_id = int(raw)
        room_id = body.get("room_id")
    except (TypeError, ValueError, json.JSONDecodeError):
        return JsonResponse({"error": "target_id가 필요합니다."}, status=400)

    if not mission.helper or mission.helper.id != target_id:
        return JsonResponse({"error": "해당 유저는 이 방의 참여자가 아닙니다."}, status=400)
    if target_id == request.user.id:
        return JsonResponse({"error": "자신은 강퇴할 수 없습니다."}, status=400)

    rid = str(room_id) if room_id is not None else str(mission.id)
    publish_chat_event(
        room_id=rid,
        event_type="KICK",
        data={"target_id": target_id},
    )
    return JsonResponse({"success": True, "message": "강퇴되었습니다."})


@login_required
def start_chat(request: HttpRequest, mission_id: int) -> HttpResponse:
    """
    "채팅하기" 클릭 시: 채팅방 생성 또는 기존 방으로 이동.
    - 비작성자: 작성자와의 1:1 방 생성 후 채팅방으로 리다이렉트.
    - 작성자: 이 미션의 첫 채팅방으로 이동 (없으면 미션 상세로).
    """
    mission = get_object_or_404(
        Mission.objects.select_related("author"),
        id=mission_id,
    )
    author = mission.author
    if author == request.user:
        # 작성자: 이 미션에서 내가 참여한 첫 채팅방으로
        room = (
            ChatRoom.objects.filter(mission=mission)
            .filter(models.Q(user1=request.user) | models.Q(user2=request.user))
            .order_by("-created_at")
            .first()
        )
        if not room:
            from django.contrib import messages
            messages.info(request, "아직 채팅방이 없습니다. 다른 사용자가 채팅을 시작하면 표시됩니다.")
            return redirect("missions:mission_detail", mission_id=mission_id)
        return redirect("missions:chat_room", mission_id=mission_id, room_id=room.id)

    # 비작성자: 작성자와의 방 생성 또는 기존 방으로 (user1 < user2 로 통일)
    u1_id, u2_id = sorted([author.id, request.user.id])
    room, _ = ChatRoom.objects.get_or_create(
        mission=mission,
        user1_id=u1_id,
        user2_id=u2_id,
    )
    return redirect("missions:chat_room", mission_id=mission_id, room_id=room.id)


@login_required
def chat_room(request: HttpRequest, mission_id: int, room_id: int) -> HttpResponse:
    """
    채팅방 페이지. room_id(채팅방 ID) 기준으로 입장.
    """
    room = get_object_or_404(
        ChatRoom.objects.select_related("mission", "mission__author", "mission__helper", "user1", "user2"),
        id=room_id,
        mission_id=mission_id,
    )
    if request.user not in (room.user1, room.user2):
        raise PermissionDenied("이 채팅방에 접근할 권한이 없습니다.")

    mission = room.mission
    is_author = request.user == mission.author
    can_accept = not is_author and mission.status == "WAITING"
    kickable_users = []
    if is_author and mission.helper and mission.helper != request.user:
        kickable_users.append({"id": mission.helper.id, "nickname": mission.helper.nickname})

    return render(
        request,
        "chat/room.html",
        {
            "mission": mission,
            "room": room,
            "room_id": room.id,
            "mission_id": mission.id,
            "is_author": is_author,
            "can_accept": can_accept,
            "kickable_users": kickable_users,
            "kickable_users_json": json.dumps(kickable_users),
        },
    )
