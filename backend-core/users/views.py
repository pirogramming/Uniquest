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
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate

#유저모델 불러오기
User = get_user_model()

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

def login_page(request):
    return render(request,'users/login.html')

class MyLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # 1. 프론트에서 보낸 email과 password 받기
        email = request.data.get('email')
        password = request.data.get('password')
        print(email,password)

        try:
            # 2. 이메일로 유저 객체 찾기 (이메일이 유니크하다고 가정)
            user_obj = User.objects.get(univ_email=email)
            print(user_obj.username)
            
            # 3. 비밀번호 검증 (authenticate 대신 직접 체크)
            if user_obj.check_password(password):
                # 4. 검증 성공 시 JWT 발급
                refresh = RefreshToken.for_user(user_obj)
                return Response({
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }, status=status.HTTP_200_OK)
            else:
                return Response({'detail': '비밀번호가 틀렸습니다.'}, status=status.HTTP_401_UNAUTHORIZED)
                
        except User.DoesNotExist:
            return Response({'detail': '존재하지 않는 이메일입니다.'}, status=status.HTTP_404_NOT_FOUND)