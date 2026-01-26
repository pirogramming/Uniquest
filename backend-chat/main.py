from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorClient
from models import ChatMessage
from datetime import datetime
import os
import json

# Nginx의 /ws 경로 설정을 고려하여 root_path를 지정합니다.
app = FastAPI(root_path="/ws")

# [1] MongoDB 연결 설정
# Docker Compose의 환경 변수 MONGO_URL을 사용합니다.
MONGO_URL = os.getenv("MONGO_URL", "mongodb://mongo:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.uniquest_chat
collection = db.messages

# [2] 웹소켓 연결 매니저
class ConnectionManager:
    """
    방(room_id)별로 여러 웹소켓 연결을 관리하여 단체 채팅을 지원합니다.
    """
    def __init__(self):
        # { room_id: [websocket1, websocket2, ...] }
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        """새로운 클라이언트 연결 수락 및 방 등록"""
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        """연결 종료 시 리스트에서 제거"""
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            # 방에 아무도 없으면 메모리 관리를 위해 방 키 삭제
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, message: dict, room_id: str):
        """방에 있는 모든 접속자에게 메시지 전송 (단체 채팅의 핵심)"""
        if room_id in self.active_connections:
            # 한글 깨짐 방지를 위해 ensure_ascii=False 설정
            message_json = json.dumps(message, ensure_ascii=False)
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_text(message_json)
                except Exception:
                    # 끊긴 연결은 자동으로 무시
                    pass

manager = ConnectionManager()

# [3] 과거 대화 내역 조회 API
@app.get("/history/{room_id}")
async def get_chat_history(room_id: str):
    # 생성 시간 순으로 메시지를 가져옵니다.
    cursor = collection.find({"room_id": room_id}).sort("created_at", 1)
    history = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])  # ObjectId를 문자열로 변환
        if "created_at" in doc:
            doc["time"] = doc["created_at"].strftime("%H:%M")
        history.append(doc)
    return history

# [4] 실시간 채팅 웹소켓 엔드포인트
@app.websocket("/chat/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: int):
    # 연결 수락 및 관리자 등록
    await manager.connect(websocket, room_id)
    
    current_time = datetime.now().strftime("%H:%M")
    
    # [시스템 알림] 유저 입장 알림 발송
    await manager.broadcast({
        "type": "SYSTEM",
        "sender_id": 0,
        "content": f"유저 {user_id}님이 입장하셨습니다.",
        "time": current_time
    }, room_id)

    try:
        while True:
            # 클라이언트로부터 메시지 수신
            data = await websocket.receive_text()
            
            # Pydantic 모델을 사용하여 데이터 구조화
            msg_obj = ChatMessage(
                room_id=room_id,
                sender_id=user_id,
                content=data
            )
            
            # 1. MongoDB에 메시지 저장
            await collection.insert_one(msg_obj.model_dump(by_alias=True, exclude={"id"}))
            
            # 2. 방 안의 모든 사용자에게 실시간 전송 (Key를 content로 통일)
            await manager.broadcast({
                "type": "TALK",
                "sender_id": user_id,
                "content": data,
                "time": msg_obj.created_at.strftime("%H:%M")
            }, room_id)
            
    except WebSocketDisconnect:
        # 연결 종료 처리
        manager.disconnect(websocket, room_id)
        
        # [시스템 알림] 유저 퇴장 알림 발송
        await manager.broadcast({
            "type": "SYSTEM",
            "sender_id": 0,
            "content": f"유저 {user_id}님이 퇴장하셨습니다.",
            "time": datetime.now().strftime("%H:%M")
        }, room_id)