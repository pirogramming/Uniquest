from django.db import models
from django.conf import settings

class Mission(models.Model):
    """
    미션(심부름/매칭) 정보를 담는 모델
    """
    # 상태값 정의 (Enum)
    STATUS_CHOICES = [
        ('RECRUITING', '모집중'),
        ('IN_PROGRESS', '진행중'),
        ('COMPLETED', '완료'),
        ('CANCELED', '취소됨'),
    ]

    # 작성자 (User 모델과 연결)
    writer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='missions')
    
    title = models.CharField(max_length=100, verbose_name="제목")
    content = models.TextField(verbose_name="내용")
    reward = models.PositiveIntegerField(default=0, verbose_name="사례금")
    
    # 상태 (기본값: 모집중)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='RECRUITING')
    
    # 위치 정보 (나중에 PostGIS 쓰더라도 일단 위도/경도로 받아두기)
    latitude = models.FloatField(verbose_name="위도")
    longitude = models.FloatField(verbose_name="경도")
    location_name = models.CharField(max_length=100, verbose_name="장소명")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"[{self.get_status_display()}] {self.title}"