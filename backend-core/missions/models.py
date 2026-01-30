# missions/models.py
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError


class Category(models.TextChoices):
    ERRAND = "ERRAND", "심부름"
    STUDY = "STUDY", "학업"
    RENTAL = "RENTAL", "대여"
    RECRUIT = "RECRUIT", "구인"
    LIFE = "LIFE", "생활"
    OTHER = "OTHER", "기타"


class MissionStatus(models.TextChoices):
    WAITING = "WAITING", "waiting"
    MATCHED = "MATCHED", "matched"
    COMPLETED = "COMPLETED", "completed"
    CANCELLED = "CANCELLED", "cancelled"


class Tag(models.Model):
    """
    - category가 있으면: 카테고리 전용 태그
    - category가 NULL이면: 전역 태그 (예: #급해요)
    """
    name = models.CharField(max_length=30)  # 저장은 '#' 없이: '우산', '급해요'
    slug = models.SlugField(max_length=40)  # 내부 식별자: 'umbrella', 'urgent'
    category = models.CharField(max_length=20, choices=Category.choices, null=True, blank=True)

    is_default = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["category", "slug"], name="uniq_tag_per_category_slug"),
        ]
        indexes = [
            models.Index(fields=["category", "is_default", "is_active", "order"]),
            models.Index(fields=["slug"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self) -> str:
        prefix = self.category if self.category else "GLOBAL"
        return f"[{prefix}] #{self.name}"


class Mission(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="missions")

    title = models.CharField(max_length=100)
    descriptions = models.TextField(blank=True)

    reward = models.PositiveIntegerField(default=0)
    category = models.CharField(max_length=20, choices=Category.choices)
    status = models.CharField(max_length=20, choices=MissionStatus.choices, default=MissionStatus.WAITING)

    # timezone-aware deadline
    deadline = models.DateTimeField(default=timezone.now)

    # ===== location =====
    # 사용자가 입력한 "거래 희망 장소명"
    location_name = models.CharField(max_length=80, blank=True)
    # 지도에서 선택한 좌표
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)

    # 선택 사항: 주소(역지오코딩으로 가져오면 저장 가능)
    location_address = models.CharField(max_length=200, blank=True)

    tags = models.ManyToManyField(Tag, through="MissionTag", related_name="missions", blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()

        if self.deadline:
            now = timezone.now()
            if self.deadline < (now - timezone.timedelta(minutes=1)):
                raise ValidationError({"deadline": "마감기한은 현재 이후여야 합니다."})

        # 위치를 받는 정책: "위치추가를 눌렀으면 name+lat+lng 세트로 와야" 정도로 강제
        if self.location_name and (self.location_lat is None or self.location_lng is None):
            raise ValidationError({"location_name": "좌표가 없는 장소명입니다. 지도에서 다시 선택해주세요."})
        if (self.location_lat is not None or self.location_lng is not None) and not self.location_name:
            raise ValidationError({"location_name": "장소명을 입력해주세요."})

    def __str__(self) -> str:
        return f"{self.title} ({self.category})"


class MissionTag(models.Model):
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("mission", "tag")

    def clean(self):
        # 전역태그(category=NULL)는 ok
        if self.tag.category and self.tag.category != self.mission.category:
            raise ValidationError("카테고리와 맞지 않는 태그입니다.")


class MissionImage(models.Model):
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="missions/%Y/%m/%d/")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"MissionImage(mission_id={self.mission_id})"
