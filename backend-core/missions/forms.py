# missions/forms.py
from __future__ import annotations

from django import forms
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import Mission, Tag


class MultiFileInput(forms.FileInput):
    """
    Django 기본 ClearableFileInput은 multiple 업로드를 지원하지 않아서
    FileInput을 상속해서 multiple만 켠 커스텀 위젯을 사용한다.
    """
    allow_multiple_selected = True


class MissionCreateForm(forms.ModelForm):
    tags_existing = forms.ModelMultipleChoiceField(
        queryset=Tag.objects.filter(is_active=True),
        required=False,
        help_text="최대 5개 선택",
    )
    tags_input = forms.CharField(
        required=False,
        help_text="엔터로 추가한 태그를 쉼표로 join해서 전송 (예: 우산,충전기,급해요)",
    )

    # ✅ multiple 업로드 지원 위젯으로 교체
    images = forms.ImageField(
        required=False,
        widget=MultiFileInput(attrs={"multiple": True}),
    )

    # 위치 hidden 필드(지도 선택 후 자동으로 채워짐)
    location_name = forms.CharField(required=False)
    location_lat = forms.FloatField(required=False)
    location_lng = forms.FloatField(required=False)
    location_address = forms.CharField(required=False)

    class Meta:
        model = Mission
        fields = [
            "title", "descriptions", "deadline", "reward", "category",
            "location_name", "location_lat", "location_lng", "location_address"
        ]
        widgets = {
            "deadline": forms.DateTimeInput(attrs={"type": "datetime-local"}),
        }

    def clean_deadline(self):
        deadline = self.cleaned_data.get("deadline")
        if deadline is None:
            return deadline

        # datetime-local은 timezone 정보 없이 넘어오므로 naive일 수 있음
        if timezone.is_naive(deadline):
            deadline = timezone.make_aware(deadline, timezone.get_current_timezone())

        # ✅ "분 단위"로 now를 내림해서
        # datetime-local(분까지만) vs now(초/마이크로초) 때문에
        # 방금 고른 시간이 과거 판정 나는 문제를 방지
        now = timezone.now()
        comparision_now = now.replace(second=0, microsecond=0)  

        if deadline <= comparision_now:
            raise ValidationError("마감기한은 현재 이후여야 합니다.ddddd(입력: {deadline.strftime('%Y-%m-%d %H:%M')})")

        return deadline

    def clean(self):
        cleaned = super().clean()

        # 태그 최대 5개
        existing = list(cleaned.get("tags_existing") or [])
        raw = (cleaned.get("tags_input") or "").strip()

        custom_names = []
        if raw:
            custom_names = [t.strip().lstrip("#") for t in raw.split(",") if t.strip()]

        existing_names = {t.name for t in existing}
        merged_names = list(existing_names.union(custom_names))

        if len(merged_names) > 5:
            raise ValidationError("해시태그는 최대 5개까지 선택/추가할 수 있습니다.")

        cleaned["__custom_tag_names"] = custom_names

        # 위치 규칙
        loc_name = (cleaned.get("location_name") or "").strip()
        lat = cleaned.get("location_lat")
        lng = cleaned.get("location_lng")

        if loc_name and (lat is None or lng is None):
            raise ValidationError("장소명은 있는데 좌표가 없습니다. 지도에서 다시 선택해주세요.")
        if (lat is not None or lng is not None) and not loc_name:
            raise ValidationError("좌표는 있는데 장소명이 없습니다. 장소명을 입력해주세요.")

        return cleaned
