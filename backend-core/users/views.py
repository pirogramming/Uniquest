from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from .serializers import UserRegisterSerializer, UserProfileSerializer
from django.contrib.auth import get_user_model
import requests 

User = get_user_model()

# 1. 회원가입 View
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer
    permission_classes = [AllowAny] # 누구나 접근 가능

# 2. 내 프로필 조회 View
class ProfileView(views.APIView):
    permission_classes = [IsAuthenticated] # 로그인한 사람만 접근 가능

    def get(self, request):
        # request.user: 현재 토큰으로 로그인한 유저 객체
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

# # 3. 대학생 인증 처리 View (Univcert 연동)
# class UnivCertView(views.APIView):
#     permission_classes = [IsAuthenticated]

#     def post(self, request):
#         """
#         학교 이메일과 대학명을 받아 인증을 처리합니다.
#         (현재는 테스트를 위해 입력값만 있으면 무조건 성공 처리)
#         """
#         email = request.data.get('email')
#         univ_name = request.data.get('univ_name')
        
#         # [TODO] 실제 서비스 배포 시 아래 주석을 해제하고 Univcert API Key를 .env에서 가져오세요.
#         """
#         import os
#         API_KEY = os.getenv("UNIVCERT_API_KEY")
#         response = requests.post(
#             'https://univcert.com/api/v1/certify',
#             json={"key": API_KEY, "email": email, "univName": univ_name, "univ_check": True}
#         )
#         if not response.json().get('success'):
#              return Response({"error": "인증 메일 발송 실패"}, status=400)
#         """
        
#         # [TEST 모드] 입력값이 있으면 인증 성공으로 처리 (개발용)
#         if email and univ_name:
#             user = request.user
#             user.univ_email = email
#             user.is_student_verified = True # 바로 인증 완료 처리
#             user.save()
            
#             return Response({
#                 "message": "인증이 완료되었습니다. (테스트 모드)",
#                 "user_id": user.id,
#                 "is_verified": user.is_student_verified
#             }, status=status.HTTP_200_OK)
            
#         return Response({"error": "이메일과 학교명을 정확히 입력해주세요."}, status=status.HTTP_400_BAD_REQUEST)