from django.db import models
from django.conf import settings
from users.models import University  # Users 앱의 University 모델 가져오기

class Mission(models.Model):
    """
    미션 중개 핵심 모델
    """
    # [상태 관리 Enum]
    class Status(models.TextChoices):
        WAITING = 'WAITING', '매칭 대기'    
        MATCHED = 'MATCHED', '매칭 완료'   
        COMPLETED = 'COMPLETED', '미션 완료'  
        FINISHED = 'FINISHED', '종료됨'       
        CANCELED = 'CANCELED', '취소됨'    

    # [카테고리 Enum]
    class Category(models.TextChoices):
        DELIVERY = 'DELIVERY', '음식 배달'
        PICKUP = 'PICKUP', '물건 전달/구매'
        PRINTING = 'PRINTING', '프린트/제본'
        KNOWLEDGE = 'KNOWLEDGE', '과외/지식공유'
        HELP = 'HELP', '기타 도움'

    # --- 관계 (Relationships) ---
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='requested_missions',
        verbose_name="요청자"
    )
    performer = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, # 수행자가 탈퇴해도 미션 기록은 남아야 함
        null=True, 
        blank=True, 
        related_name='performed_missions',
        verbose_name="수행자"
    )
    university = models.ForeignKey(
        University,
        on_delete=models.CASCADE,
        related_name='missions',
        verbose_name="소속 대학"
    )

    # --- 미션 정보 (Fields) ---
    title = models.CharField(max_length=100, verbose_name="제목")
    description = models.TextField(verbose_name="상세 내용")
    
    # 보상: 정확한 금액 계산을 위해 Decimal 사용 (최대 10자리, 소수점 없음)
    reward = models.DecimalField(
        max_digits=10, 
        decimal_places=0, 
        default=0, 
        verbose_name="사례금"
    )
    
    category = models.CharField(
        max_length=20, 
        choices=Category.choices, 
        default=Category.HELP,
        verbose_name="카테고리"
    )
    
    status = models.CharField(
        max_length=20, 
        choices=Status.choices, 
        default=Status.WAITING,
        verbose_name="진행 상태"
    )

    # 위치 정보 (단순 텍스트 + 위도/경도 좌표)
    location_name = models.CharField(max_length=100, verbose_name="장소명 (예: 중앙도서관)")
    latitude = models.FloatField(verbose_name="위도", null=True, blank=True)
    longitude = models.FloatField(verbose_name="경도", null=True, blank=True)

    deadline = models.DateTimeField(verbose_name="마감 시간")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="생성일")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="수정일")

    class Meta:
        ordering = ['-created_at'] # 최신순 정렬
        # [성능 최적화] 자주 조회하는 조건에 인덱스 걸기
        indexes = [
            models.Index(fields=['university', 'status']), # 우리 학교의 대기중인 미션 찾기
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"[{self.get_status_display()}] {self.title}"


class Review(models.Model):
    """
    리뷰 모델 (미션 1개당 리뷰 1개)
    """
    mission = models.OneToOneField(
        Mission, 
        on_delete=models.CASCADE, 
        related_name='review',
        verbose_name="관련 미션"
    )
    writer = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='written_reviews',
        verbose_name="작성자"
    )
    target = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='received_reviews',
        verbose_name="평가 대상"
    )
    
    rating = models.PositiveSmallIntegerField(verbose_name="평점 (1-5)", default=5)
    comment = models.TextField(verbose_name="코멘트", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Review for {self.mission.title}"