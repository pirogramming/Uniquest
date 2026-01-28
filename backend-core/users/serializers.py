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
        fields = ['username', 'password', 'nickname', 'university', 'univ_email','is_student_verified']
        extra_kwargs = {
            'password': {'write_only': True} # 비밀번호는 응답에 노출되지 않도록 설정
        }

    def create(self, validated_data):
        # 1. 대학 이름 추출 (validated_data에서 제거)
        univ_name = validated_data.pop('university_name', None)
        
        # 2. 유저 생성 (비밀번호 암호화 자동 처리)
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            nickname=validated_data['nickname'],
            university=validated_data.get('university', ''),
            univ_email=validated_data.get('univ_email', ''),
            is_student_verified=validated_data.get('is_student_verified', '')
        )

        # 3. 대학 정보 연결
        if univ_name:
            # 대학이 DB에 있으면 가져오고, 없으면 생성 (도메인은 임시값)
            # 실제 서비스에서는 미리 등록된 대학 리스트만 허용하는 것이 좋습니다.
            university, _ = University.objects.get_or_create(
                name=univ_name, 
                defaults={'domain': 'example.com'} 
            )
            user.university = university
            user.save()
            
        return user

class UserProfileSerializer(serializers.ModelSerializer):
    """
    프로필 조회용 시리얼라이저
    """
    # 보여주기용: 대학 객체의 이름을 문자열로 반환
    university = serializers.CharField(source='university.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'nickname', 'university', 'is_student_verified', 'manner_score', 'is_student_verified']
