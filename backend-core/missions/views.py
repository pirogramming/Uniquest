from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.conf import settings
from .models import Mission
import redis
import json

User = get_user_model()
r = redis.from_url(settings.REDIS_URL)

class ConfirmHelperView(APIView):
    """미션 수행자 확정 (수락)"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, mission_id):
        mission = get_object_or_404(Mission, id=mission_id)
        
        # 1. 권한 및 상태 체크
        if mission.requester != request.user:
            return Response({"error": "방장만 수락할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN)
        
        if mission.status != 'WAITING':
             return Response({"error": "이미 진행 중인 미션입니다."}, status=status.HTTP_400_BAD_REQUEST)

        helper_id = request.data.get('helper_id')
        helper = get_object_or_404(User, id=helper_id)

        # 2. DB 업데이트
        mission.helper = helper
        mission.status = 'MATCHED'
        mission.save()

        # 3. Redis로 "확정" 이벤트 발행 (FastAPI가 받음)
        # 채널명: chat_{mission_id} (FastAPI 구독 채널과 일치해야 함!)
        message_data = {
            "type": "CONFIRM",  # FastAPI 로직 분기용 키워드
            "room_id": mission_id,
            "content": f"🎉 {helper.nickname}님과 매칭이 확정되었습니다! 미션을 시작해주세요."
        }
        # ensure_ascii=False 해야 한글이 안 깨짐
        r.publish(f"chat_{mission_id}", json.dumps(message_data, ensure_ascii=False))

        return Response({"message": "매칭 확정 완료"}, status=status.HTTP_200_OK)


class CompleteMissionView(APIView):
    """미션 완료 처리"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, mission_id):
        mission = get_object_or_404(Mission, id=mission_id)

        if mission.requester != request.user:
            return Response({"error": "권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)

        # DB 업데이트
        mission.status = 'COMPLETED'
        mission.save()

        # Redis로 "완료" 이벤트 발행
        message_data = {
            "type": "COMPLETE",
            "room_id": mission_id,
            "content": "✅ 미션이 완료되었습니다. 수고하셨습니다!"
        }
        r.publish(f"chat_{mission_id}", json.dumps(message_data, ensure_ascii=False))

        return Response({"message": "미션 완료 처리됨"}, status=status.HTTP_200_OK)


class KickUserView(APIView):
    """강퇴 기능"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, mission_id):
        mission = get_object_or_404(Mission, id=mission_id)

        if mission.requester != request.user:
            return Response({"error": "권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)

        target_user_id = request.data.get('user_id')
        
        # DB 업데이트 (강퇴 목록 추가)
        target_user = get_object_or_404(User, id=target_user_id)
        mission.banned_users.add(target_user)
        
        # 만약 수행자였다면 자격 박탈
        if mission.helper == target_user:
            mission.helper = None
            mission.status = 'WAITING'
        
        mission.save()

        # Redis로 "강퇴" 이벤트 발행
        message_data = {
            "type": "KICK",      # FastAPI가 이 타입을 보면 소켓을 끊음
            "room_id": mission_id,
            "target_id": target_user_id, # 강퇴할 유저 ID
            "content": "방장에 의해 강퇴되었습니다."
        }
        r.publish(f"chat_{mission_id}", json.dumps(message_data, ensure_ascii=False))

        return Response({"message": "강퇴 완료"}, status=status.HTTP_200_OK)