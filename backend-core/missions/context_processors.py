from django.conf import settings

def kakao_key(request):
    return {'KAKAO_KEY': settings.KAKAO_KEY}