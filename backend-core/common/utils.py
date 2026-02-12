import redis
import json
import logging
import os
from django.conf import settings
import uuid

logger = logging.getLogger(__name__)

# Redis 연결 (Docker: REDIS_URL=redis://redis:6379, 로컬: 기본값)
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

def publish_mission_update(data: dict):
    """미션 변경사항을 Redis로 발행"""
    redis_client.publish("mission_updates", json.dumps(data))


def publish_chat_event(room_id: str, event_type: str, data: dict):
    """
    room_id: 채팅방 ID (ChatRoom.id, WebSocket과 동일)
    event_type: "KICK", "COMPLETE", "MATCHED" 등
    data: 추가 정보 (예: {"target_id": 10})
    """
    try:
        r = redis.Redis.from_url(REDIS_URL)
        message = {
            "type": event_type,
            "data": data,
            "sender": "system"
        }
        # Redis 채널명 규칙: chat_{room_id}
        channel = f"chat_{room_id}"
        r.publish(channel, json.dumps(message, ensure_ascii=False))
        logger.info(f"Redis Publish 성공: {channel} -> {event_type}")
        print(f"[DEBUG] Redis Publish - channel={channel}, message={message}")
    except redis.RedisError as e:
        logger.error(f"Redis Publish 실패: {e}")

RELEASE_LOCK_SCRIPT = f"""
if redis.call("get", KEYS[1]) == ARGV[1] then 
    return redis.call("del", KEYS[1])
else
    return 0
end
"""

def acquire_lock(lock_key: str, ttl_seconds: int = 5) -> str | None:
    """
        distribution lock accquired
        - 성공: 고유 value 변환
        - 실패: None 변환 
    """

    value = uuid.uuid4().hex
    acquired = redis_client.set(lock_key, value, nx=True, px=ttl_seconds * 1000)
    return value if acquired else None

def release_lock(lock_key: str, value: str) -> bool:
    """lock 헤제, value가 일치할 때만 삭제"""
    try:
        result = redis_client.eval(RELEASE_LOCK_SCRIPT, 1, lock_key, value)
        return result == 1
    except redis.RedisError as e:
        logger.error(f"락 헤제 실패: {e}")
        return False