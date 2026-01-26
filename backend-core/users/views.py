from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from .serializers import UserRegisterSerializer, UserProfileSerializer
from django.contrib.auth import get_user_model
import requests # Univcert 호출용

User = get_user_model()

# 1. 회원가입 View
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer
    permission_classes = [AllowAny] # 누구나 접근 가능

# 2. 내 프로필 조회 View
class ProfileView(views.APIView):
    permission_classes = [IsAuthenticated] # 로그인한 사람만

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

# 3. 대학생 인증 메일 발송 View (Univcert 연동 예시)
class UnivCertView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        email = request.data.get('email')
        univ_name = request.data.get('univ_name')
        
        # 실제로는 여기서 Univcert API 호출
        # response = requests.post('https://univcert.com/api/v1/certify', ...)
        
        # (테스트용 가짜 로직)
        if email and univ_name:
            return Response({"message": "인증 메일이 전송되었습니다."}, status=status.HTTP_200_OK)
        return Response({"error": "이메일과 학교명을 입력해주세요."}, status=status.HTTP_400_BAD_REQUEST)