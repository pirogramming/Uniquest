import os
from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as aioredis

# 환경 변수 관리
MONGO_URL = os.getenv("MONGO_URL", "mongodb://mongo:27017")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

# DB 클라이언트 설정
client = AsyncIOMotorClient(MONGO_URL)
db = client.uniquest_chat
collection = db.messages

# Redis 클라이언트 설정
redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)