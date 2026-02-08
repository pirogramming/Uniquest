from rest_framework import serializers
from .models import Mission, Tag, MissionImage  # MissionImage 모델 임포트 확인

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug', 'category']

# 1. 이미지 시리얼라이저 추가
class MissionImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MissionImage
        fields = ['id', 'image']

class MissionSerializer(serializers.ModelSerializer):
    author_username = serializers.ReadOnlyField(source='author.username')
    tags = TagSerializer(many=True, read_only=True)
    
    # 2. 역참조 필드 추가 (Mission 모델의 related_name이 'images'라고 가정)
    images = MissionImageSerializer(many=True, read_only=True)
    
    # [팁] 작성자인지 여부를 확인하는 필드 (상세페이지 버튼 제어용)
    is_author = serializers.SerializerMethodField()

    class Meta:
        model = Mission
        fields = [
            'id', 'author_username', 'is_author', 'title', 'descriptions', 
            'reward', 'category', 'status', 'location_name', 
            'location_lat', 'location_lng', 'location_address', 
            'tags', 'images', 'created_at', 'deadline'  # 3. fields에 'images' 추가
        ]

    def get_is_author(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.author == request.user
        return False