from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import List

# Nginx에서 '/ws'로 들어오는 요청을 처리한다고 명시
app = FastAPI(root_path="/ws")

# [Connection Manager]
# 채팅방에 들어온 사람들을 관리하는 클래스입니다.
class ConnectionManager:
    def __init__(self):
        # 현재 접속한 웹소켓들을 리스트로 관리
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        # 접속한 모든 사람에게 메시지 전송
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.get("/")
def read_root():
    return {"message": "Uniquest Chat Server is Running!"}

# [웹소켓 엔드포인트]
# ws://localhost/ws/chat/1 (1번방 접속 시도 시)
@app.websocket("/chat/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    try:
        while True:
            # 1. 클라이언트(프론트)로부터 메시지를 받음
            data = await websocket.receive_text()
            
            # 2. 받은 메시지를 가공 (여기선 단순하게 ID를 붙여서)
            response_msg = f"User {client_id}: {data}"
            
            # 3. 채팅방에 있는 모든 사람에게 뿌림 (Broadcast)
            await manager.broadcast(response_msg)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(f"User {client_id} left the chat")