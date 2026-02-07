import redis.asyncio as redis
import os

# Redis 연결 설정
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

# 비동기 Redis 클라이언트
redis_client = redis.from_url(REDIS_URL, decode_responses=True)