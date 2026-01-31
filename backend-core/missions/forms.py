# missions/forms.py
from __future__ import annotations

from django import forms
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import Mission, Tag

# ✅ 에러 없는 다중 파일 업로드 위젯
class MultiFileInput(forms.FileInput):
    allow_multiple_selected = True


class MissionCreateForm(forms.ModelForm):
    tags_existing = forms.ModelMultipleChoiceField(
        queryset=Tag.objects.filter(is_active=True),
        required=False,
        help_text="최대 5개 선택",
    )
    tags_input = forms.CharField(
        required=False,
        help_text="엔터로 추가한 태그를 쉼표로 join해서 전송",
    )

    # ✅ FileInput을 상속받은 MultiFileInput을 사용해야 ValueError가 안 납니다.
    images = forms.FileField(
        widget=MultiFileInput(attrs={
            "multiple": True, 
            "accept": "image/*", 
            "class": "form-control"
        }),
        required=False, # 파일 없어도 제출 가능하게
        label="미션 이미지들",
    )

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

        if timezone.is_naive(deadline):
            deadline = timezone.make_aware(deadline, timezone.get_current_timezone())

        now = timezone.now()
        # 입력 시간과 현재 시간의 차이를 5분 정도로 넉넉히 둠
        if deadline < (now - timezone.timedelta(minutes=5)):
            raise ValidationError(f"마감기한은 현재 이후여야 합니다. (입력: {deadline.strftime('%Y-%m-%d %H:%M')})")

        return deadline

    def clean(self):
        cleaned = super().clean()

        # 태그 검증
        existing = list(cleaned.get("tags_existing") or [])
        raw = (cleaned.get("tags_input") or "").strip()
        custom_names = [t.strip().lstrip("#") for t in raw.split(",") if t.strip()] if raw else []
        
        if len(set(list(t.name for t in existing) + custom_names)) > 5:
            raise ValidationError("해시태그는 최대 5개까지 선택/추가할 수 있습니다.")

        cleaned["__custom_tag_names"] = custom_names
        return cleaned