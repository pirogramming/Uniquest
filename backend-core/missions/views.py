# missions/views.py
from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db import transaction, models
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.shortcuts import render, redirect, get_object_or_404

from .forms import MissionCreateForm
from .models import Mission, MissionImage, Tag, Category

from common.utils import publish_chat_event

logger = logging.getLogger(__name__)


def _slugify_simple(name: str) -> str:
    """
    간단 slug:
    - 소문자
    - 공백 -> 하이픈
    - # 제거
    - 길이 제한
    """
    s = (name or "").strip().lower()
    s = s.replace("#", "")
    s = s.replace(" ", "-")
    s = s.replace("--", "-")
    return (s[:50] or "tag")


@login_required
def location_picker(request: HttpRequest) -> HttpResponse:
    """
    지도 화면 템플릿만 렌더
    """
    return render(request, "missions/location_picker.html")


@login_required
@transaction.atomic
def mission_create(request: HttpRequest) -> HttpResponse:
    """
    POST: 저장 + 태그 + 이미지 여러장
    """
    if request.method == "POST":
        # 명시적으로 POST와 FILES를 함께 전달
        form = MissionCreateForm(request.POST, request.FILES)
        
        if form.is_valid():
            try:
                mission: Mission = form.save(commit=False)
                mission.author = request.user
                mission.save()

                # 1) 기존 태그 연결
                tags_existing = form.cleaned_data.get("tags_existing")
                if tags_existing:
                    for tag in tags_existing:
                        mission.tags.add(tag)

                # 2) 커스텀 태그 처리
                custom_names = form.cleaned_data.get("__custom_tag_names", [])
                for name in custom_names:
                    if not name: continue
                    if name in ["급해요", "급함", "urgent"]:
                        tag, _ = Tag.objects.get_or_create(
                            category=None,
                            slug="urgent",
                            defaults={"name": "급해요", "is_default": True, "is_active": True, "order": 0},
                        )
                    else:
                        tag, _ = Tag.objects.get_or_create(
                            category=mission.category,
                            slug=_slugify_simple(name),
                            defaults={"name": name, "is_default": False, "is_active": True, "order": 999},
                        )
                    mission.tags.add(tag)

                # 3) 이미지 여러 장 저장 (인코딩 오류 방지를 위해 안전하게 처리)
                images = request.FILES.getlist("images")
                for f in images:
                    if f: # 파일이 존재하는 경우만 생성
                        MissionImage.objects.create(mission=mission, image=f)

                return redirect("missions:mission_detail", mission_id=mission.id)

            except Exception:
                logger.exception("미션 생성 중 오류 발생")
                form.add_error(None, "미션 생성 중 오류가 발생했습니다.")
        else:
            # 폼 검증 실패 시 에러 로그 출력 (브라우저 콘솔이 아닌 서버 터미널에서 확인용)
            print("❌ 폼 에러 상세:", form.errors)
            
        return render(request, "missions/mission_form.html", {"form": form, "is_update": False})
    
    # GET
    initial: dict[str, Any] = {}
    for key in ["loc_name", "lat", "lng", "addr"]:
        val = request.GET.get(key)
        if val:
            if key == "loc_name": initial["location_name"] = val
            elif key == "lat": initial["location_lat"] = val
            elif key == "lng": initial["location_lng"] = val
            elif key == "addr": initial["location_address"] = val

    form = MissionCreateForm(initial=initial)
    return render(request, "missions/mission_form.html", {"form": form})


@login_required
@transaction.atomic
def mission_update(request: HttpRequest, mission_id: int) -> HttpResponse:
    mission = get_object_or_404(Mission.objects.prefetch_related("tags", "images").select_related("author"), id=mission_id)

    if mission.author_id != request.user.id:
        raise PermissionDenied("작성자만 수정할 수 있습니다.")

    if request.method == "POST":
        form = MissionCreateForm(request.POST, request.FILES, instance=mission)
        if form.is_valid():
            try:
                mission = form.save(commit=False)
                mission.save()

                # 태그 재설정
                mission.tags.clear()
                
                # 1) 기존 선택 태그
                tags_existing = form.cleaned_data.get("tags_existing")
                if tags_existing:
                    for tag in tags_existing:
                        mission.tags.add(tag)

                # 2) 커스텀 태그
                custom_names = form.cleaned_data.get("__custom_tag_names", [])
                for name in custom_names:
                    if not name: continue
                    if name in ["급해요", "급함", "urgent"]:
                        tag, _ = Tag.objects.get_or_create(
                            category=None, slug="urgent",
                            defaults={"name": "급해요", "is_default": True, "is_active": True, "order": 0},
                        )
                    else:
                        tag, _ = Tag.objects.get_or_create(
                            category=mission.category, slug=_slugify_simple(name),
                            defaults={"name": name, "is_default": False, "is_active": True, "order": 999},
                        )
                    mission.tags.add(tag)

                # 3) 새 이미지 추가 (안전한 리스트 처리)
                new_images = request.FILES.getlist("images")
                for f in new_images:
                    if f: MissionImage.objects.create(mission=mission, image=f)

                return redirect("missions:mission_detail", mission_id=mission.id)

            except Exception:
                logger.exception("미션 수정 중 오류 발생")
                form.add_error(None, "미션 수정 중 오류가 발생했습니다.")

        return render(request, "missions/mission_form.html", {"form": form, "is_update": True, "mission": mission})

    # GET
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
    mission = get_object_or_404(
        Mission.objects.prefetch_related("tags", "images").select_related("author"),
        id=mission_id,
    )
    return render(request, "missions/mission_detail.html", {"mission": mission})


def mission_list(request: HttpRequest) -> HttpResponse:
    qs = Mission.objects.select_related("author").prefetch_related("tags", "images").order_by("-created_at")

    category = request.GET.get("category")
    if category in Category.values:
        qs = qs.filter(category=category)

    urgent = request.GET.get("urgent")
    if urgent in ["1", "true", "True"]:
        qs = qs.filter(tags__slug="urgent", tags__category__isnull=True)

    return render(request, "missions/mission_list.html", {"missions": qs})


def tag_suggest(request: HttpRequest) -> JsonResponse:
    q = (request.GET.get("q") or "").strip().lstrip("#")
    category = request.GET.get("category")

    if not q:
        return JsonResponse({"results": []})

    qs = Tag.objects.filter(is_active=True, name__istartswith=q)
    if category in Category.values:
        qs = qs.filter(models.Q(category=category) | models.Q(category__isnull=True))

    qs = qs.order_by("category", "order", "name")[:10]

    data = [{
        "id": t.id,
        "name": t.name,
        "display": f"#{t.name}",
        "category": t.category,
        "slug": t.slug,
        "is_default": t.is_default,
    } for t in qs]

    return JsonResponse({"results": data})

@login_required
@transaction.atomic
def mission_accept(request: HttpRequest, mission_id: int) -> HttpResponse:
    """
    미션 수락 (매칭 성사)
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST 요청만 허용됩니다."}, status=405)
    
    mission = get_object_or_404(Mission, id=mission_id)
    
    # 이미 매칭된 미션인지 확인
    if mission.status != "WAITING":
        return JsonResponse({"error": "이미 매칭된 미션입니다."}, status=400)
    
    # 자기 자신의 미션은 수락할 수 없음
    if mission.author == request.user:
        return JsonResponse({"error": "자신의 미션은 수락할 수 없습니다."}, status=400)
    
    # 매칭 성공 로직
    mission.status = "MATCHED"
    mission.helper = request.user
    mission.save()

    # 🚀 핵심: 매칭 즉시 채팅방에 시스템 메시지 전송
    publish_chat_event(
        room_id=str(mission.id),
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
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST 요청만 허용됩니다."}, status=405)

    mission = get_object_or_404(Mission.objects.select_related("author", "helper"), id=mission_id)
    if request.user != mission.author:
        return JsonResponse({"error": "방장만 강퇴할 수 있습니다."}, status=403)

    try:
        raw = request.POST.get("target_id")
        if raw is None and request.body:
            raw = json.loads(request.body).get("target_id")
        target_id = int(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return JsonResponse({"error": "target_id가 필요합니다."}, status=400)

    if not mission.helper or mission.helper.id != target_id:
        return JsonResponse({"error": "해당 유저는 이 방의 참여자가 아닙니다."}, status=400)
    if target_id == request.user.id:
        return JsonResponse({"error": "자신은 강퇴할 수 없습니다."}, status=400)

    publish_chat_event(
        room_id=str(mission.id),
        event_type="KICK",
        data={"target_id": target_id},
    )
    return JsonResponse({"success": True, "message": "강퇴되었습니다."})


@login_required
def chat_room(request, mission_id):
    """
    채팅방 페이지
    """
    mission = get_object_or_404(
        Mission.objects.select_related("author", "helper"),
        id=mission_id,
    )

    # 접근 가능: 작성자, 헬퍼, 또는 미션이 대기 중일 때(수락하려는 사용자)
    if (
        request.user != mission.author
        and request.user != mission.helper
        and mission.status != "WAITING"
    ):
        raise PermissionDenied("이 채팅방에 접근할 권한이 없습니다.")

    is_author = request.user == mission.author
    can_accept = not is_author and mission.status == "WAITING"
    # 방장이 강퇴할 수 있는 상대: 헬퍼가 있을 때만 (매칭된 상태)
    kickable_users = []
    if is_author and mission.helper and mission.helper != request.user:
        kickable_users.append({"id": mission.helper.id, "nickname": mission.helper.nickname})

    return render(
        request,
        "chat/room.html",
        {
            "mission": mission,
            "is_author": is_author,
            "can_accept": can_accept,
            "kickable_users": kickable_users,
            "kickable_users_json": json.dumps(kickable_users),
        },
    )
