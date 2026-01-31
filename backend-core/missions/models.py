from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Mission(models.Model):
    STATUS_CHOICES = [
        ('WAITING', '대기중'),
        ('MATCHED', '매칭됨'),
        ('COMPLETED', '완료됨'),
    ]

    title = models.CharField(max_length=100)
    content = models.TextField()
    university = models.CharField(max_length=50, default="Yonsei")
    
    # [중요] 방장 (Requester)
    requester = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='requested_missions'
    )

    # [중요] 수행자 (Helper) - 이 부분이 없어서 에러가 난 겁니다!
    helper = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='helped_missions'
    )

    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='WAITING'
    )
    
    # 강퇴당한 유저 목록 (Many-to-Many)
    banned_users = models.ManyToManyField(
        User, 
        related_name='banned_missions', 
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deadline = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title


class Review(models.Model):
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE)
    writer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='written_reviews')
    target = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_reviews')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)