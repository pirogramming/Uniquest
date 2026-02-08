from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router
from app.api.missions import router as mission_router  # ✨ 추가
from app.services.mission_stream_service import mission_stream_manager

app = FastAPI()    

# CORS 설정 (403 방지)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://127.0.0.1"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/ws")
app.include_router(mission_router, prefix="/stream")  # ✨ 추가

@app.on_event("startup")
async def startup_event():
    """서버 시작 시 Redis 리스너 시작"""
    await mission_stream_manager.start()

@app.get("/health")
async def health_check():
    return {"status": "ok"}