from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import University

User = get_user_model()

class UserRegisterSerializer(serializers.ModelSerializer):
    """
    회원가입용 시리얼라이저
    - 대학 이름(문자열)을 입력받아 DB의 University 객체와 연결합니다.
    """
    # 입력용: 대학 이름을 문자열로 받음 (필수 아님)
    university_name = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = User
        fields = ['username', 'password', 'university', 'univ_email', 'is_student_verified', 'university_name', 'userphoto']
        extra_kwargs = {
            'password': {'write_only': True},
            'userphoto': {'required': False, 'allow_null': True},
        }

    def create(self, validated_data):
        # 1. 대학 이름 추출 (View에서 문자열로 넘어옴. validated_data에서 제거)
        univ_name = validated_data.pop('university_name', None)
        univ_from_view = validated_data.pop('university', None)  # View의 save(university=대학명) 값
        univ_name = univ_name or univ_from_view  # 둘 중 하나로 University 조회
        user_photo = validated_data.pop('userphoto', None)

        # 2. university FK는 create_user에 넣지 않음 (문자열이라서). 나중에 인스턴스로 연결
        univ_email = validated_data.get('univ_email', '')
        is_student_verified = validated_data.get('is_student_verified', False)

        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            univ_email=univ_email,
            is_student_verified=is_student_verified,
        )

        # 3. 대학 정보 연결 (문자열 → University 인스턴스)
        if univ_name:
            university, _ = University.objects.get_or_create(
                name=univ_name,
                defaults={'domain': 'example.com'}
            )
            user.university = university
            user.save(update_fields=['university'])

        # 4. 프로필 사진 저장
        if user_photo:
            user.userphoto = user_photo
            user.save(update_fields=['userphoto'])

        return user

class UserProfileSerializer(serializers.ModelSerializer):
    """
    프로필 조회용 시리얼라이저
    """
    # 보여주기용: 대학 객체의 이름을 문자열로 반환
    university = serializers.CharField(source='university.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'university', 'is_student_verified', 'manner_score']
