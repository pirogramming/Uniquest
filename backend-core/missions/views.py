# missions/views.py
from __future__ import annotations

import logging
from typing import Any

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db import transaction, models
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.shortcuts import render, redirect, get_object_or_404

from .forms import MissionCreateForm
from .models import Mission, MissionImage, Tag, Category

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
    (return 파라미터는 템플릿에서 읽어서 복귀 URL로 사용)
    """
    return render(request, "missions/location_picker.html")


@login_required
@transaction.atomic
def mission_create(request: HttpRequest) -> HttpResponse:
    """
    GET: ?loc_name=...&lat=...&lng=...&addr=... 로 들어오면 폼 initial로 채움
    POST: 저장 + 태그(최대5) + 이미지 여러장
    """
    if request.method == "POST":
        form = MissionCreateForm(request.POST, request.FILES)
        if form.is_valid():
            try:
                mission: Mission = form.save(commit=False)
                mission.author = request.user
                mission.save()

                # 1) 기존 태그 연결
                for tag in list(form.cleaned_data.get("tags_existing") or []):
                    mission.tags.add(tag)

                # 2) 커스텀 태그 처리
                custom_names = form.cleaned_data.get("__custom_tag_names", [])
                for name in custom_names:
                    if not name:
                        continue

                    # 전역 #급해요
                    if name in ["급해요", "급함", "urgent"]:
                        tag, _ = Tag.objects.get_or_create(
                            category=None,
                            slug="urgent",
                            defaults={
                                "name": "급해요",
                                "is_default": True,
                                "is_active": True,
                                "order": 0,
                            },
                        )
                    else:
                        tag, _ = Tag.objects.get_or_create(
                            category=mission.category,
                            slug=_slugify_simple(name),
                            defaults={
                                "name": name,
                                "is_default": False,
                                "is_active": True,
                                "order": 999,
                            },
                        )
                    mission.tags.add(tag)

                # 3) 이미지 여러 장 저장
                for f in request.FILES.getlist("images"):
                    MissionImage.objects.create(mission=mission, image=f)

                return redirect("missions:mission_detail", mission_id=mission.id)

            except Exception:
                logger.exception("미션 생성 중 오류 발생")
                form.add_error(None, "미션 생성 중 오류가 발생했습니다. 다시 시도해주세요.")
        else: 
            print("폼 에러:", form.errors)
            return render(request, "missions/mission_form.html", {"form": form, "is_update": False,})
        # ✅ POST인데 폼이 invalid거나 예외면, 여기서 다시 렌더해야 버튼 눌렀을 때 반응이 있음
        return render(request, "missions/mission_form.html", {"form": form, "is_update": False,})
    
    # GET
    initial: dict[str, Any] = {}

    loc_name = request.GET.get("loc_name")
    lat = request.GET.get("lat")
    lng = request.GET.get("lng")
    addr = request.GET.get("addr")

    if loc_name and lat and lng:
        initial.update({
            "location_name": loc_name,
            "location_lat": lat,
            "location_lng": lng,
            "location_address": addr or "",
        })

    form = MissionCreateForm(initial=initial)
    return render(request, "missions/mission_form.html", {"form": form})


@login_required
@transaction.atomic
def mission_update(request: HttpRequest, mission_id: int) -> HttpResponse:
    """
    미션 수정:
    - 작성자만 수정 가능
    - 기존 태그는 폼 initial로 넣고, 저장 시 재설정(set)
    - 커스텀 태그(tags_input)도 동일 로직으로 반영
    - 이미지: 새로 추가된 것만 추가 저장 (기존 이미지 삭제는 별도 기능로 뺄 것)
    """
    mission = get_object_or_404(Mission.objects.prefetch_related("tags", "images").select_related("author"), id=mission_id)

    if mission.author_id != request.user.id:
        raise PermissionDenied("작성자만 수정할 수 있습니다.")

    if request.method == "POST":
        form = MissionCreateForm(request.POST, request.FILES, instance=mission)
        if form.is_valid():
            try:
                mission = form.save(commit=False)
                mission.save()

                # ✅ 태그는 수정이므로 "재설정"이 안전
                mission.tags.clear()

                # 1) 기존 선택 태그
                for tag in list(form.cleaned_data.get("tags_existing") or []):
                    mission.tags.add(tag)

                # 2) 커스텀 태그
                custom_names = form.cleaned_data.get("__custom_tag_names", [])
                for name in custom_names:
                    if not name:
                        continue

                    if name in ["급해요", "급함", "urgent"]:
                        tag, _ = Tag.objects.get_or_create(
                            category=None,
                            slug="urgent",
                            defaults={
                                "name": "급해요",
                                "is_default": True,
                                "is_active": True,
                                "order": 0,
                            },
                        )
                    else:
                        tag, _ = Tag.objects.get_or_create(
                            category=mission.category,
                            slug=_slugify_simple(name),
                            defaults={
                                "name": name,
                                "is_default": False,
                                "is_active": True,
                                "order": 999,
                            },
                        )
                    mission.tags.add(tag)

                # 3) 새 이미지 추가
                for f in request.FILES.getlist("images"):
                    MissionImage.objects.create(mission=mission, image=f)

                return redirect("missions:mission_detail", mission_id=mission.id)

            except Exception:
                logger.exception("미션 수정 중 오류 발생")
                form.add_error(None, "미션 수정 중 오류가 발생했습니다. 다시 시도해주세요.")

        return render(request, "missions/mission_form.html", {"form": form, "is_update": True, "mission": mission})

    # GET (수정 폼 초기값)
    initial: dict[str, Any] = {}

    # 지도 선택 후 돌아오는 값이 있으면 우선 반영
    loc_name = request.GET.get("loc_name")
    lat = request.GET.get("lat")
    lng = request.GET.get("lng")
    addr = request.GET.get("addr")

    if loc_name and lat and lng:
        initial.update({
            "location_name": loc_name,
            "location_lat": lat,
            "location_lng": lng,
            "location_address": addr or "",
        })
    else:
        # 기존 값
        initial.update({
            "location_name": getattr(mission, "location_name", "") or "",
            "location_lat": getattr(mission, "location_lat", None),
            "location_lng": getattr(mission, "location_lng", None),
            "location_address": getattr(mission, "location_address", "") or "",
        })

    form = MissionCreateForm(instance=mission, initial=initial)

    # 기존 태그들을 "기존 선택 태그"로 보여주기
    # (urgent 포함해서 다 들어가면 보기 불편하면 여기서 필터링 가능)
    form.fields["tags_existing"].initial = list(mission.tags.filter(is_active=True))

    # 커스텀 태그 입력창(tags_input)은 템플릿에서 hidden으로 관리 중이라
    # 수정 화면에서 자동으로 채우고 싶으면 템플릿 JS에서 tags_input hidden에 초기값 넣는 방식 추천.
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
    """
    자동완성:
    GET /missions/tags/suggest/?q=우산&category=RENTAL
    - category 있으면 해당 카테고리 태그 + 전역태그 반환
    """
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
        "category": t.category,  # None이면 전역
        "slug": t.slug,
        "is_default": t.is_default,
    } for t in qs]

    return JsonResponse({"results": data})
