from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class UserRegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'password', 'nickname', 'university', 'univ_email','is_student_verified']
        extra_kwargs = {
            'password': {'write_only': True} # 비번은 응답에 포함 안 함
        }

    def create(self, validated_data):
        # create_user를 써야 비밀번호가 암호화(Hash)돼서 저장됨! (중요)
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            nickname=validated_data['nickname'],
            university=validated_data.get('university', ''),
            univ_email=validated_data.get('univ_email', ''),
            is_student_verified=validated_data.get('is_student_verified', '')
        )
        return user

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'nickname', 'university', 'is_student_verified', 'manner_score', 'is_student_verified']