import json
import asyncio
from fastapi import WebSocket
from app.core.config import redis_client

CHANNEL = "global_notifications"


class NotificationManager:
    def __init__(self):
        self.active_connections: dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[int(user_id)] = websocket

    def disconnect(self, user_id: int):
        uid = int(user_id)
        if uid in self.active_connections:
            del self.active_connections[uid]

    async def send_to_user(self, user_id: int, data: dict):
        uid = int(user_id)
        if uid in self.active_connections:
            try:
                await self.active_connections[uid].send_text(json.dumps(data, ensure_ascii=False))
            except Exception:
                pass

    async def start_listener(self):
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(CHANNEL)
        try:
            async for message in pubsub.listen():
                if message.get("type") == "message":
                    try:
                        data = json.loads(message["data"])
                        target_id = data.get("target_id")
                        if target_id is not None:
                            await self.send_to_user(target_id, data)
                    except (json.JSONDecodeError, KeyError):
                        pass
        except asyncio.CancelledError:
            await pubsub.unsubscribe(CHANNEL)


notification_manager = NotificationManager()