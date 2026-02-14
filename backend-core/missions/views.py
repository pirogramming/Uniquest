from __future__ import annotations

import json
import logging
from typing import Any

from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie
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
from common.utils import publish_chat_event, redis_client
from common.utils import publish_mission_update  
from common.utils import acquire_lock, release_lock 
from collections import defaultdict


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
    """
    미션 수락 로직, 채팅방 안에서 호출
    """
    lock_key = f"lock:mission_accept:{mission_id}"
    lock_value = acquire_lock(lock_key, ttl_seconds=5)

    if lock_value is None:
        return Response(
            {"error": "다른 사용자가 수락중입니다. 잠시 후 다시 시도해주세요."},
            status=status.HTTP_409_CONFLICT
        )
    
    try:
        mission = get_object_or_404(Mission, id=mission_id)

        if mission.status != "WAITING":
            return Response({"error":"이미 매칭된 미션입니다."}, status=status.HTTP_400_BAD_REQUEST)
        
        if mission.author == request.user:
            return Response({"error":"자신의 미션은 수락할 수 없습니다."},  status=status.HTTP_400_BAD_REQUEST)
        
        mission.status = "PENDING_APPROVAL"
        mission.helper = request.user
        mission.save()

        room_id = (request.data.get("room_id") if getattr(request, "data", None) else None) or None
        rid = str(room_id) if room_id is not None else str(mission.id)

        requester_name = getattr(request.user, "nickname", None) or getattr(request.user, "username", "someone")
        publish_chat_event(
            room_id=rid,
            event_type="SYSTEM",
            data={
                "content": f"{requester_name}님이 미션 수락을 요청했습니다. 등록자가 확정하면 매칭이 완료됩니다.",
                "mission_status": "PENDING_APPROVAL",
                "action": "mission_accepted",
            },
        )

        return JsonResponse({
            "success": True,
            "message": "수락 요청이 등록자에게 전달되었습니다. 등록자가 확정할 때까지 기다려 주세요.",
            "mission_id": mission.id,
        })
    finally:
        release_lock(lock_key, lock_value)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def mission_confirm_helper(request, mission_id):
    """
    등록자가 수행자를 확정. PENDING_APPROVAL -> MATCHED
    """
    mission = get_object_or_404(Mission, id=mission_id)
    if mission.author != request.user:
        return Response({"error": "등록자만 수행자를 확정할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN)
    if mission.status != "PENDING_APPROVAL":
        return Response({"error":"확정 대기 상태가 아닙니다."}, status=status.HTTP_400_BAD_REQUEST)
    if not mission.helper:
        return Response({"error":"수행자가 없습니다."}, status=status.HTTP_400_BAD_REQUEST)
    
    mission.status = "MATCHED"
    mission.save()

    room_id = (request.data.get("room_id") if getattr(request, "data", None) else None) or None
    rid = str(room_id) if room_id else str(mission.id)
    publish_chat_event(room_id=rid, event_type="SYSTEM", data = {"content": "매칭이 성사되었습니다! 대화를 시작해보세요."})

    return Response({"success": True, "message": "수행자가 확정되었습니다."})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def mission_reject_helper(request, mission_id):
    """등록자가 수행자 수락을 거절. PENDING_APPROVAL → WAITING, helper 초기화"""
    mission = get_object_or_404(Mission, id=mission_id)
    if mission.author != request.user:
        return Response({"error": "등록자만 거절할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN)
    if mission.status != "PENDING_APPROVAL":
        return Response({"error": "확정 대기 상태가 아닙니다."}, status=status.HTTP_400_BAD_REQUEST)

    mission.status = "WAITING"
    mission.helper = None
    mission.save()

    room_id = (request.data.get("room_id") if getattr(request, "data", None) else None) or None
    rid = str(room_id) if room_id else str(mission.id)
    publish_chat_event(room_id=rid, event_type="SYSTEM", data={"content": "등록자가 수락을 거절했습니다. 미션이 다시 모집 중입니다."})

    return Response({"success": True, "message": "수락을 거절했습니다."})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def mission_complete(request, mission_id):
    mission = get_object_or_404(Mission, id=mission_id)
    if mission.author != request.user:
        return Response({"error": "등록자만 완료할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN)
    if mission.status != "MATCHED":
        return Response({'error':"매칭 완료된 미션만 완료 처리할 수 있습니다."}, status=status.HTTP_400_BAD_REQUEST)
    
    mission.status = "COMPLETED"
    mission.save()
    
    room_id = (request.data.get("room_id") if getattr(request, "data", None) else None) or None
    rid = str(room_id) if room_id else str(mission.id)
    publish_chat_event(
        room_id=rid,
        event_type="COMPLETE",
        data={"content": "미션이 완료되었습니다."}
    )

    return Response({"success": True, "message": "미션이 완료되었습니다."})
        


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


def _is_blocked_between(user_a, user_b) -> bool:
    """두 유저 중 한 명이라도 상대를 차단했으면 True"""
    if not user_a or not user_b:
        return False
    return (
        user_a.blocked_people.filter(id=user_b.id).exists()
        or user_b.blocked_people.filter(id=user_a.id).exists()
    )


@login_required
def start_chat(request: HttpRequest, mission_id: int) -> HttpResponse:
    """
    "채팅하기" 클릭 시: 채팅방 생성 또는 기존 방으로 이동.
    - 비작성자: 작성자와의 1:1 방 생성 후 채팅방으로 리다이렉트.
    - 작성자: 이 미션의 첫 채팅방으로 이동 (없으면 미션 상세로).
    - 차단 관계가 있으면 채팅 불가.
    """
    mission = get_object_or_404(
        Mission.objects.select_related("author"),
        id=mission_id,
    )
    author = mission.author

    # 차단 관계 확인: 서로 차단한 유저끼리는 채팅 불가
    if _is_blocked_between(request.user, author):
        from django.contrib import messages
        messages.error(request, "차단된 사용자와는 채팅할 수 없습니다.")
        return redirect("missions:mission_detail", mission_id=mission_id)

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
        # 작성자가 들어가는 방의 상대방과도 차단 확인
        other = room.user2 if room.user1 == request.user else room.user1
        if _is_blocked_between(request.user, other):
            from django.contrib import messages
            messages.error(request, "차단된 사용자와는 채팅할 수 없습니다.")
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
@ensure_csrf_cookie
def chat_room(request: HttpRequest, mission_id: int, room_id: int) -> HttpResponse:
    """
    채팅방 페이지. room_id(채팅방 ID) 기준으로 입장.
    차단 관계가 있으면 접근 불가.
    """
    room = get_object_or_404(
        ChatRoom.objects.select_related("mission", "mission__author", "mission__helper", "user1", "user2"),
        id=room_id,
        mission_id=mission_id,
    )
    if request.user not in (room.user1, room.user2):
        raise PermissionDenied("이 채팅방에 접근할 권한이 없습니다.")

    other_user = room.user2 if room.user1 == request.user else room.user1
    if _is_blocked_between(request.user, other_user):
        from django.contrib import messages
        messages.error(request, "차단된 사용자와는 채팅할 수 없습니다.")
        return redirect("missions:mission_detail", mission_id=mission_id)

    mission = room.mission
    is_author = request.user == mission.author
    can_accept = not is_author and mission.status == "WAITING"
    can_confirm_performer = is_author and mission.status == "PENDING_APPROVAL"
    show_complete_btn = is_author and mission.status == "MATCHED"
    blockable_user = {"id": other_user.id, "username": other_user.username} if other_user else None

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
            "can_confirm_performer": can_confirm_performer,
            "show_complete_btn": show_complete_btn,
            "blockable_user": blockable_user,
            "other_user": other_user,
        },
    )

@login_required
def chat_list(request: HttpRequest) -> HttpResponse:
    """내가 참여한 채팅방을 미션별로 묶어서 보여줌"""
    rooms = (
        ChatRoom.objects
        .filter(models.Q(user1=request.user) | models.Q(user2=request.user))
        .select_related("mission", "mission__author", "user1", "user2")
        .order_by("-created_at")
    )

    mission_groups = defaultdict(list)
    for room in rooms:
        other = room.user2 if room.user1 == request.user else room.user1
        if _is_blocked_between(request.user, other):
            continue
        # Redis에서 이 방의 마지막 메시지 미리보기 조회
        last_message = None
        try:
            raw = redis_client.get(f"chat:room:{room.id}:last")
            if raw:
                data = json.loads(raw)
                last_message = data.get("content") or None
        except (json.JSONDecodeError, TypeError):
            pass
        mission_groups[room.mission].append({
            "room": room,
            "other_user": other,
            "last_message": last_message,
        })

    grouped_list = [
        {"mission": mission, "rooms": room_items}
        for mission, room_items in mission_groups.items()
    ]

    return render(
        request,
        "chat/list.html",
        {"grouped_list": grouped_list},
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_missions(request):
    user = request.user
    created = Mission.objects.filter(author=user)
    joined = Mission.objects.filter(helper=user)
    all_missions = (created | joined).distinct()
    
    serializer = MissionSerializer(all_missions, many=True, context={'request': request})
    data = serializer.data
    
    for item in data:
        item['is_author'] = created.filter(id=item['id']).exists()
        item['is_participant'] = joined.filter(id=item['id']).exists()
        item['chat_room_id'] = None  # 채팅 연결 시 구현
    
    return Response({'results': data})
# ============================================
# missions/views.py에 추가할 코드
# ============================================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_missions_api(request):
    """내가 등록하거나 참여한 미션 목록"""
    user = request.user
    
    # ✅ author, helper 사용
    created_missions = Mission.objects.filter(author=user)
    joined_missions = Mission.objects.filter(helper=user)
    
    all_missions = (created_missions | joined_missions).distinct()
    
    from .serializers import MissionSerializer
    serializer = MissionSerializer(all_missions, many=True, context={'request': request})
    
    data = []
    for item in serializer.data:
        mission_dict = dict(item)
        mission_dict['is_creator'] = created_missions.filter(id=item['id']).exists()
        mission_dict['is_participant'] = joined_missions.filter(id=item['id']).exists()
        mission_dict['chat_room_id'] = None
        data.append(mission_dict)
    
    return Response({'results': data, 'count': len(data)})