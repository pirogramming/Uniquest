from django.db import models
from django.contrib.auth.models import AbstractUser

class University(models.Model):
    """
    대학교 정보
    """
    name = models.CharField(max_length=50, unique=True, verbose_name="대학명")
    domain = models.CharField(max_length=50, verbose_name="인증 메일 도메인 (예: yonsei.ac.kr)")

    def __str__(self):
        return self.name

class User(AbstractUser):
    """
    사용자 모델 (AbstractUser 상속)
    """
    username = models.CharField(
        unique=False,
        max_length=150,
        blank=True, 
        null=True
    )
    # 대학 정보 (FK)
    university = models.ForeignKey(
        University, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='students',
        verbose_name="소속 대학"
    )
    
    # 인증 및 신뢰도
    is_student_verified = models.BooleanField(default=False, verbose_name="학생 인증 여부")
    univ_email = models.EmailField(blank=True,
        null=True,
        verbose_name="학교 이메일",
        unique=True
    )

    USERNAME_FIELD = 'univ_email'

    REQUIRED_FIELDS = ['username']
    
    # 매너 온도 (기본 80도)
    manner_score = models.FloatField(default=3, verbose_name="매너 온도")
    blocked_people = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        related_name='blocked_by_users'
    )

    #유저 프로필 사진
    userphoto = models.ImageField(
        upload_to='user/%Y/%m/%d/',
        null=True,
        blank=True,
    )

    #유저 리뷰 모음
    review_datas = models.JSONField(default=list)

    def get_display_name(self):
        """템플릿 등에서 표시할 이름 (username 사용)"""
        return self.username

    def __str__(self):
        return self.username