from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    """
    Uniquest 사용자 모델
    - 기본 로그인 ID는 'username' 필드를 사용합니다.
    - 대학생 인증 여부와 학교 정보를 포함합니다.
    """
    nickname = models.CharField(max_length=20, unique=True, verbose_name="닉네임")
    university = models.CharField(max_length=50, blank=True, null=True, verbose_name="대학교")
    
    # Univcert 인증 관련
    is_student_verified = models.BooleanField(default=False, verbose_name="학생 인증 여부")
    univ_email = models.EmailField(blank=True, null=True, verbose_name="학교 이메일")
    
    # 매너 온도 (기본 36.5도)
    manner_score = models.FloatField(default=36.5, verbose_name="매너 온도")
    blocked_people = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        related_name='blocked_by_users'
    )

    def __str__(self):
        return self.nickname if self.nickname else self.username