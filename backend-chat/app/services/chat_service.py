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
        room_id = str(room_id)  # room_id 항상 str로 통일
        user_id = int(user_id)  # user_id 항상 int로 통일
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}  # 딕셔너리로 초기화
            # Redis 구독 시작 (방이 처음 생길 때만)
            self.pubsub_tasks[room_id] = asyncio.create_task(self._redis_sub_listener(room_id))

        # 유저 ID를 키로 소켓 저장 (int 고정)
        self.active_connections[room_id][user_id] = websocket

    async def disconnect(self, room_id: str, user_id: int):
        room_id = str(room_id)
        user_id = int(user_id)
        if room_id in self.active_connections:
            room = self.active_connections[room_id]
            if user_id in room:
                del room[user_id]
            elif str(user_id) in room:
                del room[str(user_id)]
            
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
                        # 차단 시 Django가 전달한 target_id → 해당 유저 채팅방에서 강퇴
                        raw_id = data.get("target_id")
                        target_id = int(raw_id) if raw_id is not None else None
                        print(f"[DEBUG] Redis KICK 수신 - room_id={room_id!r}, target_id={target_id!r}")
                        if target_id is not None:
                            await self._kick_user(room_id, target_id)
                    
                    elif msg_type == "COMPLETE":
                        # 미션 완료 시 시스템 메시지 브로드캐스트
                        await self._local_broadcast({
                            "type": "SYSTEM",
                            "content": "미션이 완료되었습니다."
                        }, room_id)
                    else:
                        if msg_type == "SYSTEM":
                            content = ""
                            if isinstance(data, dict):
                                content = data.get("content", "")
                            else:
                                content = str(data)
                            message = {"type": "SYSTEM", "content": content, **data}
                        else:
                            message = payload
                        await self._local_broadcast(message, room_id)
        except Exception as e:
            print(f"FastAPI Redis 리스너 에러: {e}")

    # 차단된 유저를 채팅방에서 강퇴 (WebSocket 종료)
    async def _kick_user(self, room_id, target_id):
        room_id = str(room_id)
        target_id = int(target_id)
        room_conns = self.active_connections.get(room_id) or self.active_connections.get(str(room_id))
        if not room_conns:
            print(f"[DEBUG] Kick 실패: room_id={room_id!r} 없음. 접속방 목록={list(self.active_connections.keys())}")
            return
        target_socket = room_conns.get(target_id) or room_conns.get(str(target_id))
        if not target_socket:
            print(f"[DEBUG] Kick 실패: target_id={target_id!r} 해당 소켓 없음. 현재 접속자={list(room_conns.keys())}")
            return
        try:
            await target_socket.send_text(json.dumps({
                "type": "KICK",
                "content": "차단되어 채팅방에서 나가셨습니다."
            }, ensure_ascii=False))
            await target_socket.close(code=4000)
            print(f"[DEBUG] Kick 성공: user_id={target_id} 종료됨")
        except Exception as e:
            print(f"[DEBUG] Kick 중 예외: {e}")

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