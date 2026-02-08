import asyncio
import json
from typing import Dict
from app.core.config import redis_client  # ✨ 기존 config.py의 redis_client 재활용

class MissionStreamManager:
    def __init__(self):
        self.subscribers: Dict[int, asyncio.Queue] = {}
        self.pubsub = None
        self._listener_task = None
    
    async def start(self):
        """Redis Pub/Sub 리스너 시작"""
        self.pubsub = redis_client.pubsub()
        await self.pubsub.subscribe("mission_updates")
        self._listener_task = asyncio.create_task(self._listen())
    
    async def _listen(self):
        """Redis에서 메시지를 받아 모든 구독자에게 전달"""
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    
                    # 모든 연결된 클라이언트에게 브로드캐스트
                    for queue in self.subscribers.values():
                        try:
                            await queue.put(data)
                        except:
                            pass  # 큐가 가득 차면 무시
        except Exception as e:
            print(f"Redis 리스너 오류: {e}")
    
    async def subscribe(self, user_id: int) -> asyncio.Queue:
        """SSE 연결 등록"""
        queue = asyncio.Queue(maxsize=100)
        self.subscribers[user_id] = queue
        return queue
    
    async def unsubscribe(self, user_id: int):
        """SSE 연결 해제"""
        self.subscribers.pop(user_id, None)

mission_stream_manager = MissionStreamManager()