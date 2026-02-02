from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from .serializers import UserRegisterSerializer, UserProfileSerializer
from django.contrib.auth import get_user_model
from django.shortcuts import render,redirect
import json
from django.http import JsonResponse
import requests # Univcert 호출용
from .utils import extract_univ,send_verification_email,verify_code
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from common.utils import publish_chat_event
from missions.models import Mission
from django.db import models

#유저모델 불러오기
User = get_user_model()

#메일 인증 test용
from django.core.cache import cache

# 1. 회원가입 View
def signup_page(request):
    return render(request,'users/signup.html')

def verify_email(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            action = data.get('action')

            if action == "send_email": # 인증번호 보내기 버튼
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

                #메일 전송 완료
                return JsonResponse({
                    'message': f'{university} 메일로 인증번호를 보냈습니다.',
                    'university': university,
                }, status=200)

            elif action == "check_number": #인증하기 버튼
                email = data.get('email')
                number = data.get('number')
                university = extract_univ(email)

                if verify_code(email,number):
                    print('True')
                    cache.set(f"university_info_{email}", university, timeout=600)
                    cache.set(f"varified_info_{email}", True, timeout=600)
                    return JsonResponse({'is_varified': True,'email':email}, status=200)
                else:
                    print('False')
                    return JsonResponse({'is_varified': False}, status=200)

        except json.JSONDecodeError:
            return JsonResponse({'message': '잘못된 데이터 형식입니다.'}, status=400)

    return JsonResponse({'error': '잘못된 접근입니다.'}, status=405)

#유저 생성 로직
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer # serializer.py class불러오기
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        # 1. 사용자가 보낸 이메일을 키로 캐시 정보 조회
        email = request.data.get('univ_email')
        is_student_verified = cache.get(f"varified_info_{email}")
        university = cache.get(f"university_info_{email}")

        # 2. 보안 검증: 인증 정보가 없거나 False면 가입 차단
        if not is_student_verified or not university:
            return Response(
                {"error": "이메일 인증이 완료되지 않았거나 인증 시간이 만료되었습니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Serializer 검증 및 유저 생성
        # 여기서 백엔드가 직접 찾은 university 값을 주입합니다.
        serializer = self.get_serializer(data=request.data) # 회원가입용 serializer를 만들기만 함
        serializer.is_valid(raise_exception=True) #username, password, nickname등 형식/필수값 검사
        
        # save() 시점에 university 필드를 강제로 채워줍니다.
        # (유저 모델에 university 필드가 있다고 가정합니다)
        user = serializer.save(
            university=university,
            is_student_verified=True,
            univ_email=email
        )

        # 4. 가입 완료 후 보안을 위해 캐시 즉시 삭제
        cache.delete(f"varified_info_{email}")
        cache.delete(f"university_info_{email}")

        # 5. 토큰 발급 및 응답
        refresh = RefreshToken.for_user(user)
        return Response({
            "user": serializer.data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "message": f"{university} 소속으로 가입 및 로그인이 완료되었습니다!"
        }, status=status.HTTP_201_CREATED)

# 2. 내 프로필 조회 View
class ProfileView(views.APIView):
    permission_classes = [IsAuthenticated] # 로그인한 사람만 접근 가능

    def get(self, request):
        # request.user: 현재 토큰으로 로그인한 유저 객체
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

#로그인 페이지
# users/views.py

@method_decorator(csrf_exempt, name='dispatch')
class MyLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # 1. 요청에서 데이터 가져오기
        username = request.data.get('username') # 아이디 (root용)
        email = request.data.get('email')       # 이메일 (학생용)
        password = request.data.get('password')

        try:
            # 2. 유저 찾기 (아이디가 있으면 아이디로, 없으면 이메일로 검색)
            if username:
                user_obj = User.objects.get(username=username)
            else:
                user_obj = User.objects.get(univ_email=email)
            
            # 3. 비밀번호 검증
            if user_obj.check_password(password):
                # 4. 토큰 발급
                refresh = RefreshToken.for_user(user_obj)
                return Response({
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }, status=status.HTTP_200_OK)
            else:
                return Response({'detail': '비밀번호가 틀렸습니다.'}, status=status.HTTP_401_UNAUTHORIZED)
                
        except User.DoesNotExist:
            return Response({'detail': '사용자를 찾을 수 없습니다.'}, status=status.HTTP_404_NOT_FOUND)
        
def logout(request):
    return render(request,'users/logout.html')

# 마이 페이지

@api_view(['GET'])
@permission_classes([IsAuthenticated]) # 🛡️ 토큰 해독 보안 요원
def get_my_info(request):
    user = request.user
    missions = list(user.missions.all().values('id','title','reward'))
    blocked_Queryset = user.blocked_people.all()
    return Response({
        "id": user.id,
        "username": user.username,
        "nickname": user.nickname,
        "university": user.university,
        "univ_email": user.univ_email,
        "is_student_verified": user.is_student_verified,
        "manner_score": round(user.manner_score, 1),
        "missions" : missions,
        "blocked_people" : list(blocked_Queryset.values('id','nickname'))
    })

def mypage_view(request):
    return render(request, 'users/mypage.html')

# 프로필 수정 페이지

@api_view(['GET','PATCH'])
@permission_classes([IsAuthenticated])
def get_my_info_patch(request):
    user = request.user
    
    if request.method == 'GET':
        # 기존 조회 로직
        return Response({
            "username": user.username,
            "nickname": user.nickname,
            "univ_email": user.univ_email,
            "university": user.university,
        })

    elif request.method == 'PATCH':
        # 1. 프론트에서 보낸 데이터(updatedData) 받기
        nickname = request.data.get('nickname')
        username = request.data.get('username')

        # 2. 데이터 업데이트 (값이 있을 때만)
        if nickname:
            user.nickname = nickname
        if username:
            user.username = username
        
        # 3. DB 저장
        user.save()
        
        return Response({
            "message": "수정 완료",
            "nickname": user.nickname,
            "username": user.username
        }, status=status.HTTP_200_OK)

def mypage_modify_view(request):
    return render(request, 'users/mypage_modify.html')

#차단 유저들

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_blocked_users_info(request):
    user = request.user
    target_user_id = request.data.get('target_id')
    
    try:
        target_user = User.objects.get(id=target_user_id)
        # 1. DB에서 차단 관계 설정
        user.blocked_people.add(target_user) 
        
        # 2. [핵심] 두 유저가 연관된 '진행 중인' 미션방들을 모두 찾음
        related_missions = Mission.objects.filter(
            models.Q(author=user, helper=target_user) | 
            models.Q(author=target_user, helper=user)
        ).filter(status__in=['WAITING', 'MATCHED']) # 대기나 매칭 중인 방만

        # 3. 찾은 모든 방에 대해 각각 강퇴 이벤트 발행
        for mission in related_missions:
            publish_chat_event(
                room_id=str(mission.id), # 실제 미션 ID를 동적으로 넣음
                event_type="KICK", 
                data={"target_id": target_user_id}
            )
            
        return Response({"message": "차단 및 실시간 강퇴 완료"}, status=status.HTTP_200_OK)

    except User.DoesNotExist:
        return Response({"error": "유저를 찾을 수 없습니다."}, status=404)
            



def get_blocked_users(request):
    return render(request,'users/blocked_users.html')