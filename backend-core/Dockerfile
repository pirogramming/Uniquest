FROM python:3.11-slim

# 파이썬 로그가 버퍼링 없이 바로 찍히게 설정 (디버깅용)
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# 필수 패키지 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .