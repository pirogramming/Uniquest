from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from .serializers import UserRegisterSerializer, UserProfileSerializer
from django.contrib.auth import get_user_model
from django.shortcuts import render,redirect
import json
import uuid
from django.http import JsonResponse
import requests # Univcert 호출용
from .utils import extract_univ,send_verification_email,verify_code
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from common.utils import publish_chat_event
from missions.models import Mission
from django.db import models
from django.db.models import Q
from django.urls import reverse
from missions.serializers import MissionSerializer


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

            if (User.objects.filter(univ_email=data.get('email'))).exists():
                return JsonResponse({'message': '이미 사용된 이메일입니다'}, status=400)

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

# 비번 변경에서 이메일 확인 로직
def verify_email_check(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            action = data.get('action')

            if not (User.objects.filter(univ_email=data.get('email'))).exists():
                return JsonResponse({'message': '회원정보에 없는 이메일입니다'}, status=400)

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
                except Exception as e:
                    return JsonResponse({'message': '메일 발송 서버에 문제가 발생했습니다.'}, status=500)

                return JsonResponse({
                    'message': f'{university} 메일로 인증번호를 보냈습니다.'
                }, status=200)

            elif action == "check_number": #인증하기 버튼
                email = data.get('email')
                number = data.get('number')

                if verify_code(email, number):
                    # 3. 비밀번호 재설정용 일회용 토큰 생성 (캐시에 저장 후 프론트에 전달)
                    reset_token = str(uuid.uuid4())
                    cache.set(f"reset_token_{reset_token}", email, timeout=600)
                    
                    return JsonResponse({'is_varified': True, 'email': email, 'token':reset_token}, status=200)
                else:
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
        user_photo = request.FILES.get('user_photo')

        # 2. 보안 검증: 인증 정보가 없거나 False면 가입 차단
        if not is_student_verified or not university:
            return Response(
                {"error": "이메일 인증이 완료되지 않았거나 인증 시간이 만료되었습니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Serializer 검증 및 유저 생성
        # 여기서 백엔드가 직접 찾은 university 값을 주입합니다.
        serializer = self.get_serializer(data=request.data) # 회원가입용 serializer를 만들기만 함
        serializer.is_valid(raise_exception=True)  # username, password 등 형식/필수값 검사
        
        # save() 시점에 university 필드를 강제로 채워줍니다.
        # (유저 모델에 university 필드가 있다고 가정합니다)
        user = serializer.save(
            university=university,
            is_student_verified=True,
            univ_email=email,
            userphoto=user_photo
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

# 로그인: GET → 로그인 페이지(HTML), POST → /api/users/login/submit/ (API)
def login_page(request):
    return render(request, 'users/login.html')

#개인정보 수집 페이지
def announcement_page(request):
    return render(request,'users/announcement_page.html')

@method_decorator(csrf_exempt, name='dispatch')
class MyLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # 1. 요청에서 데이터 가져오기
        email = request.data.get('email')       # 이메일 (학생용)
        password = request.data.get('password')

        try:
            # 2. 유저 찾기 (아이디가 있으면 아이디로, 없으면 이메일로 검색)
            user_obj = User.objects.get(univ_email=email)
            
            # 3. 비밀번호 검증
            if user_obj.check_password(password):
                # 4. Django 세션 생성 (채팅하기 등 링크 클릭 시 @login_required 통과용)
                login(request, user_obj)
                # 5. JWT 토큰 발급 (API 호출용)
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
    missions = list(user.missions.all().values('id','title','reward','status','descriptions','category','location_name'))
    accepted_missions = list(user.accepted_missions.all().values('id','title','reward','status','descriptions'))
    blocked_Queryset = user.blocked_people.all()
    return Response({
        "id": user.id,
        "username": user.username,
        "university": user.university.name if user.university else None,
        "univ_email": user.univ_email,
        "is_student_verified": user.is_student_verified,
        "manner_score": round(user.manner_score, 1),
        "missions": missions,
        "blocked_people": list(blocked_Queryset.values('id', 'username')),
        "accepted_missions": accepted_missions,
        "userphoto": user.userphoto.url if user.userphoto else None,
        "review_data" : user.review_datas
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
            "univ_email": user.univ_email,
            "university": user.university.name if user.university else None,
            "userphoto" : user.url if user.userphoto else None
        })

    elif request.method == 'PATCH':
        # 1. 프론트에서 보낸 데이터(updatedData) 받기
        username = request.data.get('username')
        userphoto = request.data.get('user_photo')

        # 2. 데이터 업데이트 (값이 있을 때만)
        if username:
            user.username = username
        if userphoto:
            user.userphoto = userphoto
        
        # 3. DB 저장
        user.save()
        
        return Response({
            "message": "수정 완료",
            "username": user.username,
        }, status=status.HTTP_200_OK)

def mypage_modify_view(request):
    return render(request, 'users/mypage_modify.html')

#차단 유저들

@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def get_blocked_users_info(request):
    user = request.user
    if request.method == 'GET':
        try:
            # 차단한 유저 목록 가져오기 (id와 username만)
            blocked_users = list(user.blocked_people.all().values('id', 'username'))
            
            return Response({
                "blocked_users": blocked_users,
                "count": len(blocked_users) # 개수도 같이 주면 프론트가 좋아해요!
            }, status=status.HTTP_200_OK)

        except Exception as e:
            # 예상치 못한 에러(DB 연결 등) 처리
            print(f"Error: {e}") 
            return Response({"error": "목록을 불러오는 중 오류가 발생했습니다."}, status=500)
    
    elif request.method == 'POST':
        target_id = request.data.get('target_id')
        try:
            target_user = User.objects.get(id=target_id)
            user.blocked_people.remove(target_user)
            return Response({"message": f"{target_user.username}님을 차단 해제했습니다."}, status=200)
        except User.DoesNotExist:
            return Response({"message":"대상유저가 없습니다"},status=404) 


def get_blocked_users(request):
    return render(request,'users/blocked_users.html')

#홈 페이지

def get_home_page(request):
    return render(request,'users/homepage.html')


def get_home_page_guest(request):
    """비로그인 사용자 전용 홈 페이지 (별도 URL/템플릿)."""
    return render(request, 'users/homepage_guest.html')
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_homepage_info(request):
    user = request.user
    blocked_list = list(user.blocked_people.all().values('id', 'username'))
    
    # 1. 내가 등록한 미션들 (is_author: True)
    my_created_missions = user.missions.all().values(
        'id','title','descriptions','reward','category','status','location_name'
    )
    for m in my_created_missions:
        m['is_author'] = True

    # 2. 내가 참여(헬퍼)한 미션들 (is_author: False)
    # Mission 모델에 helper 필드가 있다면 아래와 같이 가져와야 합니다.
    my_joined_missions = Mission.objects.filter(helper=user).values(
        'id','title','descriptions','reward','category','status','location_name'
    )
    for m in my_joined_missions:
        m['is_author'] = False

    # 두 리스트 합치기
    mission_lst = list(my_created_missions) + list(my_joined_missions)

    # 카운트 계산
    waiting_count = len([m for m in mission_lst if m['status'] == 'WAITING' and m['is_author']])
    matched_count = len([m for m in mission_lst if m['status'] == 'MATCHED'])
    completed_count = len([m for m in mission_lst if m['status'] == 'COMPLETED'])
    
    return Response({
        "id": user.id,
        "username": user.username,
        "university": user.university.name if user.university else None,
        "is_student_verified": user.is_student_verified,
        "univ_email": user.univ_email,
        "manner_score": user.manner_score,
        "blocked_people": blocked_list,
        "missions": mission_lst,  # 이제 여기에 is_author가 포함됨!
        "waiting_count": waiting_count,
        "matched_count": matched_count,
        "completed_count": completed_count,
        "userphoto": user.userphoto.url if user.userphoto else None
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def get_homepage_info_unlogin(request):
    missions = Mission.objects.all().values('id','title','descriptions','category','status','reward','location_name')
    return Response({
        "missions":missions
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def block_user(request):
    """
    차단 = 1) 차단한 유저 목록에 추가  2) 해당 채팅방에서 강퇴
    """
    user = request.user
    target_user_id = request.data.get('target_id')
    room_id = request.data.get('room_id')

    print(f"[DEBUG] block_user 호출 - target_id={target_user_id!r}, room_id={room_id!r}")

    if not target_user_id:
        return Response({'error': 'target_id가 필요합니다.'}, status=400)

    try:
        target_user = User.objects.get(id=target_user_id)
    except User.DoesNotExist:
        return Response({"error": "유저를 찾을 수 없습니다."}, status=404)

    if target_user.id == user.id:
        return Response({"error": '자신은 차단할 수 없습니다.'}, status=400)

    # 1) 차단한 유저 목록에 추가
    user.blocked_people.add(target_user)

    # 2) 채팅방에서 강퇴 (Redis로 WebSocket 서버에 전달)
    if room_id is not None and str(room_id).strip() != '':
        room_id_str = str(room_id).strip()
        target_id_int = int(target_user_id)
        publish_chat_event(
            room_id=room_id_str,
            event_type="KICK",
            data={"target_id": target_id_int}
        )
        print(f"[DEBUG] Redis Publish 완료 - channel=chat_{room_id_str}, target_id={target_id_int}")

    return Response({'message': '차단되었습니다'}, status=200)
    
#회원 탈퇴

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def signout(request):
    user = request.user
    try:
        user.delete()
        return Response({
            "message":"회원탈퇴 완료"
        },status=200)
    except Exception as e:
        # 예상치 못한 에러(DB 연결 등) 처리
        print(f"Error: {e}") 
        return Response({"error": "목록을 불러오는 중 오류가 발생했습니다."}, status=500)
    
def check_password(request):
    return render(request,'users/check_password.html')

# 비밀번호 갱신

@api_view(['PATCH'])
@permission_classes([AllowAny])
def change_password(request):
    data = json.loads(request.body)
    reset_token = data.get('password_reset_token')

    email = cache.get(f"reset_token_{reset_token}") # 이메일 재설정
    password = data.get('password')

    try:
        target_user = User.objects.get(univ_email=email)
        target_user.set_password(password)
        target_user.save()

        cache.delete(f"reset_token_{reset_token}")
        return Response({"message": f"{target_user.username} 비밀번호가 성공적으로 변경되었습니다."}, status=200)
    
    except User.DoesNotExist:
        return Response({"error": "해당 이메일의 사용자를 찾을 수 없습니다."}, status=404)
    
def change_password_render(request):
    return render(request,'users/change_password.html')

#리뷰 페이지

def render_review_page(request,mission_id):
    return render(request,'users/review.html')

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def render_review_page_info(request,mission_id):
    user = request.user
    target_mission = Mission.objects.get(id=mission_id)
    if (target_mission.author.username == user.username): # 내가 등록자 일 때
        target_user = target_mission.helper
    else:
        target_user = target_mission.author

    mission_name = target_mission.title
    username = target_user.username

    return JsonResponse({'mission_name':mission_name,'username':username},status=200)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_json(request):
    user = request.user
    review_json = json.loads(request.body)
    target_mission = Mission.objects.get(id=review_json['personal_key'])
    if (target_mission.author.username == user.username): # 내가 등록자 일 때
        target_user = target_mission.helper
    else:
        target_user = target_mission.author
    target_user.review_datas.append(review_json)

    total_score = 0
    for review_data in target_user.review_datas:
        total_score += int(review_data['my_score'])
    total_length = len(target_user.review_datas)
    if total_length == 0:
        average_score = 0
    else:
        average_score = total_score / total_length
    target_user.manner_score = round(total_score / total_length, 1)
    target_user.save()

    return Response({"status": "success", "average_score":average_score}, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_public_profile(request, user_id):
    """
    다른 유저의 공개 프로필 조회 (채팅방 프로필 보기 등).
    이메일 등 민감 정보는 제외.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "사용자를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

    # (선택) 차단 관계면 404 처리
    if request.user.blocked_people.filter(id=user_id).exists():
        return Response({"error": "접근할 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)
    if user.blocked_people.filter(id=request.user.id).exists():
        return Response({"error": "접근할 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        "id": user.id,
        "username": user.username,
        "university": user.university.name if user.university else None,
        "is_student_verified": user.is_student_verified,
        "manner_score": round(user.manner_score, 1),
        "userphoto": user.userphoto.url if user.userphoto else None,
    })

@login_required
def my_missions_view(request):
    """내 미션 전체보기 페이지"""
    return render(request, 'users/my_missions.html')
# ============================================
# users/views.py - homepage_info 함수 수정
# ============================================


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def homepage_info(request):
    """
    홈페이지 정보 API
    - 사용자 정보
    - 미션 카운트
    - 내가 등록한 미션 최신 1개
    - 내가 참여한 미션 최신 1개
    """
    user = request.user
    
    # 미션 카운트
    created_count = Mission.objects.filter(author=user).count()
    joined_count = Mission.objects.filter(helper=user).count()
    
    waiting_count = Mission.objects.filter(
        author=user, 
        status='WAITING'
    ).count()
    
    matched_count = Mission.objects.filter(
        Q(author=user) | Q(helper=user),
        status='MATCHED'
    ).count()
    
    completed_count = Mission.objects.filter(
        Q(author=user) | Q(helper=user),
        status='COMPLETED'
    ).count()
    
    # ✨ 내가 등록한 미션 중 최신 1개 (진행중인 것만)
    created_mission = Mission.objects.filter(
        author=user,
        status__in=['WAITING', 'MATCHED']
    ).order_by('-created_at').first()
    
    # ✨ 내가 참여한 미션 중 최신 1개 (진행중인 것만)
    joined_mission = Mission.objects.filter(
        helper=user,
        status__in=['WAITING', 'MATCHED']
    ).order_by('-created_at').first()
    
    # 직렬화
    created_data = None
    if created_mission:
        created_data = MissionSerializer(
            created_mission, 
            context={'request': request}
        ).data
    
    joined_data = None
    if joined_mission:
        joined_data = MissionSerializer(
            joined_mission,
            context={'request': request}
        ).data
    
    # 사용자 프로필 사진 URL
    userphoto_url = None
    if user.userphoto:
        userphoto_url = request.build_absolute_uri(user.userphoto.url)
    
    return Response({
        'id': user.id,
        'username': user.username,
        'userphoto': userphoto_url,
        
        # 카운트
        'created_count': created_count,
        'joined_count': joined_count,
        'waiting_count': waiting_count,
        'matched_count': matched_count,
        'completed_count': completed_count,
        
        # ✨ 미션 (각 1개씩)
        'created_mission': created_data,
        'joined_mission': joined_data
    })