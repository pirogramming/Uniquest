import json
import asyncio
from app.core.config import collection, redis_client
from app.models.chat import ChatMessage
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # 구조 변경: room_id -> { user_id: WebSocket }
        # 특정 유저를 강퇴하려면 socket을 찾을 수 있어야 합니다.
        self.active_connections = {} 
        self.pubsub_tasks = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: int):
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {} # 딕셔너리로 초기화
            # Redis 구독 시작 (방이 처음 생길 때만)
            self.pubsub_tasks[room_id] = asyncio.create_task(self._redis_sub_listener(room_id))
            
        # 유저 ID를 키로 소켓 저장
        self.active_connections[room_id][user_id] = websocket

    async def disconnect(self, room_id: str, user_id: int):
        if room_id in self.active_connections:
            if user_id in self.active_connections[room_id]:
                del self.active_connections[room_id][user_id]
            
            # 방에 아무도 없으면 구독 취소 및 방 삭제
            if not self.active_connections[room_id]:
                if room_id in self.pubsub_tasks:
                    self.pubsub_tasks[room_id].cancel()
                    del self.pubsub_tasks[room_id]
                del self.active_connections[room_id]

    async def _redis_sub_listener(self, room_id):
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"chat_{room_id}")
        
        try:
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    payload = json.loads(message['data'])
                    msg_type = payload.get("type")
                    data = payload.get("data", {})

                    if msg_type == "KICK":
                        # Django가 쏜 target_id를 받아서 소켓 강제 종료
                        target_id = int(data.get("target_id"))
                        await self._kick_user(room_id, target_id)
                    
                    elif msg_type == "COMPLETE":
                        # 미션 완료 시 시스템 메시지 브로드캐스트
                        await self._local_broadcast({
                            "type": "SYSTEM",
                            "content": "미션이 완료되었습니다."
                        }, room_id)
                    else:
                        message = payload
                        if msg_type == "SYSTEM" and "content" not in payload:
                            content = ""
                            if isinstance(data, dict):
                                content = data.get("content", "")
                            else:
                                content = str(data)
                            message = {
                                "type": "SYSTEM",
                                "content": content
                            }
                        await self._local_broadcast(message, room_id)
        except Exception as e:
            print(f"FastAPI Redis 리스너 에러: {e}")

    # 특정 유저 강퇴 메서드
    async def _kick_user(self, room_id, target_id):
        if room_id in self.active_connections:
            target_socket = self.active_connections[room_id].get(target_id)
            if target_socket:
                try:
                    # 1. 강퇴 알림 전송
                    await target_socket.send_text(json.dumps({
                        "type": "KICK", 
                        "content": "방장에 의해 강퇴되었습니다."
                    }, ensure_ascii=False))
                    # 2. 소켓 연결 종료
                    await target_socket.close(code=4000) 
                except:
                    pass
                # 목록에서 삭제는 disconnect에서 처리되거나 여기서 명시적 삭제
                # (웹소켓이 닫히면 api/chat.py의 finally 블록 등에서 disconnect가 호출됨)

    async def _local_broadcast(self, message, room_id):
        if room_id in self.active_connections:
            # 딕셔너리 값(socket)들만 가져와서 전송
            for connection in self.active_connections[room_id].values():
                try:
                    await connection.send_text(json.dumps(message, ensure_ascii=False))
                except: pass

    async def publish_message(self, message, room_id):
        # Django와 채널명을 맞춰야 합니다 (chat_{room_id})
        await redis_client.publish(f"chat_{room_id}", json.dumps(message, ensure_ascii=False))

    async def save_message(self, msg_obj: ChatMessage):
        await collection.insert_one(msg_obj.model_dump(by_alias=True, exclude={"id"}))

    async def get_history(self, room_id: str):
        # (기존 코드와 동일)
        cursor = collection.find({"room_id": room_id}).sort("created_at", 1)
        history = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "created_at" in doc:
                doc["time"] = doc["created_at"].strftime("%H:%M")
            history.append(doc)
        return history

chat_manager = ConnectionManager()