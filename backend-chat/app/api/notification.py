from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.notification_service import notification_manager

router = APIRouter()


@router.websocket("/notify/{user_id}")
async def notify_websocket(websocket: WebSocket, user_id: int):
    await notification_manager.connect(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        notification_manager.disconnect(user_id)