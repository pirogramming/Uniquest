from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime
from app.services.chat_service import chat_manager
from app.models.chat import ChatMessage

router = APIRouter()

@router.get("/history/{room_id}")
async def get_chat_history(room_id: str):
    return await chat_manager.get_history(room_id)

@router.websocket("/chat/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: int):
    await chat_manager.connect(websocket, room_id)
    
    # [입장 알림]
    await chat_manager.publish_message({
        "type": "SYSTEM", "sender_id": 0, "content": f"유저 {user_id} 입장",
        "time": datetime.now().strftime("%H:%M")
    }, room_id)

    try:
        while True:
            data = await websocket.receive_text()
            msg_obj = ChatMessage(room_id=room_id, sender_id=user_id, content=data)
            
            await chat_manager.save_message(msg_obj)
            await chat_manager.publish_message({
                "type": "TALK", "sender_id": user_id, "content": data,
                "time": msg_obj.created_at.strftime("%H:%M")
            }, room_id)
    except WebSocketDisconnect:
        await chat_manager.disconnect(websocket, room_id)