import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router
from app.api.missions import router as mission_router
from app.api.notification import router as notify_router
from app.services.mission_stream_service import mission_stream_manager
from app.services.notification_service import notification_manager

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://127.0.0.1"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/ws")
app.include_router(notify_router, prefix="/ws")
app.include_router(mission_router, prefix="/stream")


@app.on_event("startup")
async def startup_event():
    await mission_stream_manager.start()
    asyncio.create_task(notification_manager.start_listener())


@app.get("/health")
async def health_check():
    return {"status": "ok"}