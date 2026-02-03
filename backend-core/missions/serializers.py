from rest_framework import serializers
from .models import Mission, Tag

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug', 'category']

class MissionSerializer(serializers.ModelSerializer):
    # 작성자 이름이나 태그 목록처럼 중첩된 데이터를 깔끔하게 보여주기 위함
    author_username = serializers.ReadOnlyField(source='author.username')
    tags = TagSerializer(many=True, read_only=True)
    
    class Meta:
        model = Mission
        fields = [
            'id', 'author_username', 'title', 'descriptions', 
            'reward', 'category', 'status', 'location_name', 
            'location_lat', 'location_lng', 'location_address', 
            'tags', 'created_at', 'deadline'
        ]