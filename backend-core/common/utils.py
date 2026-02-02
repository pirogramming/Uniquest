import redis
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# Redis 연결 풀 생성 (실무 효율성 포인트)
REDIS_POOL = redis.ConnectionPool(host='redis', port=6379, db=0)

def publish_chat_event(room_id: str, event_type: str, data: dict):
    """
    room_id: 미션 ID (예: "15")
    event_type: "KICK", "COMPLETE", "MATCHED" 등
    data: 추가 정보 (예: {"target_id": 10})
    """
    try:
        r = redis.StrictRedis(connection_pool=REDIS_POOL)
        message = {
            "type": event_type,
            "data": data,
            "sender": "system"
        }
        # Redis 채널명 규칙: chat_{room_id}
        channel = f"chat_{room_id}"
        r.publish(channel, json.dumps(message, ensure_ascii=False))
        logger.info(f"Redis Publish 성공: {channel} -> {event_type}")
    except redis.RedisError as e:
        logger.error(f"Redis Publish 실패: {e}")