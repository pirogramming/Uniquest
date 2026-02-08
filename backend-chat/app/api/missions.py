from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.services.mission_stream_service import mission_stream_manager
from app.core.auth import verify_token
import json
import asyncio

router = APIRouter()

@router.get("/missions/stream")
async def mission_stream(request: Request, token: str):
    """미션 목록 SSE 스트림"""
    
    # 인증 검증
    payload = verify_token(token)
    if not payload:
        return {"error": "Unauthorized"}, 401
    
    user_id = payload.get("user_id")
    
    async def event_generator():
        # SSE 연결 등록
        queue = await mission_stream_manager.subscribe(user_id)
        
        try:
            # 초기 데이터 전송 (연결 확인용)
            yield f"data: {json.dumps({'type': 'CONNECTED'})}\n\n"
            
            while True:
                # 클라이언트 연결 끊김 체크
                if await request.is_disconnected():
                    break
                
                # Redis에서 메시지 대기 (타임아웃 30초)
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(message)}\n\n"
                except asyncio.TimeoutError:
                    # 30초마다 heartbeat 전송 (연결 유지)
                    yield f": heartbeat\n\n"
                
        except Exception as e:
            print(f"SSE 스트림 오류: {e}")
        finally:
            await mission_stream_manager.unsubscribe(user_id)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )