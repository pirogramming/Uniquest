from fastapi import FastAPI
from app.api.chat import router as chat_router

app = FastAPI(root_path="/ws")

# 라우터 등록
app.include_router(chat_router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}