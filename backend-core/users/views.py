from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from .serializers import UserRegisterSerializer, UserProfileSerializer
from django.contrib.auth import get_user_model
from django.shortcuts import render
import json
from django.http import JsonResponse
import requests # Univcert 호출용
from .utils import extract_univ,send_verification_email,verify_code

#메일 인증 test용
from django.core.cache import cache

User = get_user_model()

# 1. 회원가입 View
def signup_page(request):
    return render(request,'users/signup.html')

def verify_email(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            action = data.get('action')

            if action == "send_email":
                email = data.get('email')
                if not email:
                    return JsonResponse({'message': '이메일 주소를 입력해주세요.'}, status=400)

                # 1. 대학 도메인 검증
                university = extract_univ(email)
                if not university:
                    return JsonResponse({'message': '학사 이메일(@.ac.kr) 형식이 아닙니다.'}, status=400)

                # 2. 메일 발송
                try:
                    send_verification_email(email)
                    # 디버깅: 인증번호 확인용 (배포 시 삭제)
                    # print(f"DEBUG: {email} -> {cache.get(f'auth_{email}')}")
                except Exception as e:
                    return JsonResponse({'message': '메일 발송 서버에 문제가 발생했습니다.'}, status=500)

                return JsonResponse({
                    'message': f'{university} 메일로 인증번호를 보냈습니다.',
                    'university': university,
                }, status=200)

            elif action == "check_number":
                email = data.get('email')
                number = data.get('number')
                if verify_code(email,number):
                    print('True')
                    return JsonResponse({'is_varified': True,'email':email}, status=200)
                else:
                    print('False')
                    return JsonResponse({'is_varified': False}, status=200)

        except json.JSONDecodeError:
            return JsonResponse({'message': '잘못된 데이터 형식입니다.'}, status=400)

    return JsonResponse({'error': '잘못된 접근입니다.'}, status=405)

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