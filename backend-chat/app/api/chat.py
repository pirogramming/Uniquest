import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime
from app.services.chat_service import chat_manager
from app.models.chat import ChatMessage
from app.core.auth import verify_token  # ✅ 추가

router = APIRouter()

@router.get("/history/{room_id}")
async def get_chat_history(room_id: str):
    return await chat_manager.get_history(room_id)


@router.websocket("/chat/{room_id}")  # 
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    
    # ========== 1단계: 인증 대기 (5초 타임아웃) ==========
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        auth_msg = json.loads(raw)
        
        # AUTH 타입인지 확인
        if auth_msg.get("type") != "AUTH":
            await websocket.send_text(json.dumps({
                "type": "ERROR",
                "content": "첫 메시지는 AUTH 타입이어야 합니다."
            }))
            await websocket.close(code=4001)
            return
        
        # 토큰 검증
        token = auth_msg.get("token")
        payload = verify_token(token)
        
        if not payload:
            await websocket.send_text(json.dumps({
                "type": "ERROR", 
                "content": "유효하지 않은 토큰입니다."
            }))
            await websocket.close(code=4001)
            return
        
        # SimpleJWT: user_id (또는 sub) → 항상 int로 저장 (타입 불일치 방지)
        raw_id = payload.get("user_id") or payload.get("sub") or payload.get("id")
        user_id = int(raw_id) if raw_id is not None else None
        if not user_id:
            print(f"[DEBUG] JWT payload에 user_id 없음. payload keys={list(payload.keys())}")
            await websocket.close(code=4001)
            return

        # 표시 이름 (username 사용, 클라이언트가 AUTH에 담아 보냄)
        username = auth_msg.get("username") or auth_msg.get("nickname") or "알 수 없음"

    except asyncio.TimeoutError:
        await websocket.send_text(json.dumps({
            "type": "ERROR",
            "content": "인증 타임아웃"
        }))
        await websocket.close(code=4001)
        return
    except Exception:
        await websocket.close(code=4001)
        return
    
    # ========== 2단계: 인증 성공 → 채팅 시작 ==========
    await websocket.send_text(json.dumps({
        "type": "AUTH_SUCCESS",
        "content": "인증 성공",
        "user_id": user_id
    }))

    print(f"[DEBUG] WebSocket connect - room_id={room_id!r}, user_id={user_id!r}")

    await chat_manager.connect(websocket, room_id, user_id)
    
    # 입장 알림
    await chat_manager.publish_message({
        "type": "SYSTEM", 
        "sender_id": 0, 
        "content": f"유저 {user_id} 입장",
        "time": datetime.now().strftime("%H:%M")
    }, room_id)

    # ========== 3단계: 메시지 수신 루프 ==========
    try:
        while True:
            data = await websocket.receive_text()

            msg_obj = ChatMessage(
                room_id=room_id,
                sender_id=user_id,
                sender_nickname=username,
                content=data,
            )
            await chat_manager.save_message(msg_obj)
            await chat_manager.set_room_last_message(room_id, msg_obj)

            await chat_manager.publish_message({
                "type": "TALK",
                "sender_id": user_id,
                "sender_nickname": username,
                "content": data,
                "time": msg_obj.created_at.strftime("%H:%M"),
            }, room_id)

    except WebSocketDisconnect:
        await chat_manager.disconnect(room_id, user_id)