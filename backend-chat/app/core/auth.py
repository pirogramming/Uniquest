import jwt
from app.core.config import JWT_SECRET, JWT_ALGORITHM

def verify_token(token: str) -> dict | None:
    """
    JWT 토큰 검증 후 payload 반환
    실패 시 None 반환
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None  # 토큰 만료
    except jwt.InvalidTokenError:
        return None  # 유효하지 않은 토큰