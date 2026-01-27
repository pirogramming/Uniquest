import json
import asyncio
from app.core.config import collection, redis_client
from app.models.chat import ChatMessage

class ConnectionManager:
    def __init__(self):
        self.active_connections = {}
        self.pubsub_tasks = {}

    async def connect(self, websocket, room_id):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
            # Redis 구독 시작
            self.pubsub_tasks[room_id] = asyncio.create_task(self._redis_sub_listener(room_id))
        self.active_connections[room_id].append(websocket)

    async def disconnect(self, websocket, room_id):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                self.pubsub_tasks[room_id].cancel()
                del self.pubsub_tasks[room_id]
                del self.active_connections[room_id]

    async def _redis_sub_listener(self, room_id):
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"chat_{room_id}")
        try:
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    data = json.loads(message['data'])
                    await self._local_broadcast(data, room_id)
        except asyncio.CancelledError:
            await pubsub.unsubscribe(f"chat_{room_id}")

    async def _local_broadcast(self, message, room_id):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_text(json.dumps(message, ensure_ascii=False))
                except: pass

    async def publish_message(self, message, room_id):
        await redis_client.publish(f"chat_{room_id}", json.dumps(message, ensure_ascii=False))

    async def save_message(self, msg_obj: ChatMessage):
        await collection.insert_one(msg_obj.model_dump(by_alias=True, exclude={"id"}))

    async def get_history(self, room_id: str):
        cursor = collection.find({"room_id": room_id}).sort("created_at", 1)
        history = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "created_at" in doc:
                doc["time"] = doc["created_at"].strftime("%H:%M")
            history.append(doc)
        return history

chat_manager = ConnectionManager()