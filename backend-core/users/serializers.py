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
    프로필 조회용 시리얼라이저 (profile/, 공개 프로필 공통)
    """
    university = serializers.CharField(source='university.name', read_only=True)
    userphoto = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'university', 'is_student_verified', 'manner_score', 'userphoto']

    def get_userphoto(self, obj):
        return obj.userphoto.url if obj.userphoto else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.manner_score is not None:
            data['manner_score'] = round(float(instance.manner_score), 1)
        return data


class UserMypageSerializer(serializers.ModelSerializer):
    """마이페이지 전체 정보 (GET /api/profile/)"""
    university = serializers.CharField(source='university.name', read_only=True)
    userphoto = serializers.SerializerMethodField()
    missions = serializers.SerializerMethodField()
    blocked_people = serializers.SerializerMethodField()
    accepted_missions = serializers.SerializerMethodField()
    review_data = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'university', 'univ_email', 'is_student_verified',
            'manner_score', 'missions', 'blocked_people', 'accepted_missions',
            'userphoto', 'review_data',
        ]

    def get_userphoto(self, obj):
        return obj.userphoto.url if obj.userphoto else None

    def get_missions(self, obj):
        return list(obj.missions.all().values(
            'id', 'title', 'reward', 'status', 'descriptions', 'category', 'location_name'
        ))

    def get_blocked_people(self, obj):
        return list(obj.blocked_people.all().values('id', 'username'))

    def get_accepted_missions(self, obj):
        return list(obj.accepted_missions.all().values(
            'id', 'title', 'reward', 'status', 'descriptions'
        ))

    def get_review_data(self, obj):
        return obj.review_datas

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.manner_score is not None:
            data['manner_score'] = round(float(instance.manner_score), 1)
        return data


class UserProfileModifySerializer(serializers.ModelSerializer):
    """프로필 수정 페이지 GET/PATCH (GET: 조회, PATCH: username, user_photo 수정)"""
    university = serializers.CharField(source='university.name', read_only=True)
    userphoto = serializers.SerializerMethodField(read_only=True)
    user_photo = serializers.ImageField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'univ_email', 'university', 'userphoto', 'user_photo']
        read_only_fields = ['univ_email', 'university']

    def get_userphoto(self, obj):
        return obj.userphoto.url if obj.userphoto else None

    def update(self, instance, validated_data):
        user_photo = validated_data.pop('user_photo', None)
        if 'username' in validated_data:
            instance.username = validated_data['username']
        update_fields = []
        if 'username' in validated_data:
            update_fields.append('username')
        if user_photo is not None:
            instance.userphoto = user_photo
            update_fields.append('userphoto')
        if update_fields:
            instance.save(update_fields=update_fields)
        return instance
