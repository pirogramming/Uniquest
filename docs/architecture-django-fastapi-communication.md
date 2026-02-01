# Uniquest: Django ↔ FastAPI 통신 구조

## 1. 전체 아키텍처 (클라이언트 관점)

```mermaid
flowchart TB
    subgraph Client["🖥️ 클라이언트 (브라우저)"]
        Browser[Browser]
    end

    subgraph Gateway["🌐 Nginx (게이트웨이 :80)"]
        Nginx[Nginx]
    end

    subgraph Backends["백엔드 서비스"]
        Django["Django (backend-core:8000)<br/>유저·미션·정산 등 핵심 로직"]
        FastAPI["FastAPI (backend-chat:8001)<br/>실시간 채팅·WebSocket"]
    end

    subgraph DataStores["데이터 저장소"]
        Postgres[(PostgreSQL<br/>유저, 미션)]
        Mongo[(MongoDB<br/>채팅 메시지)]
        Redis[(Redis<br/>Pub/Sub, 캐시)]
    end

    Browser -->|"HTTP /, /api/*, /media/, /static/"| Nginx
    Browser -->|"WebSocket /ws/"| Nginx

    Nginx -->|"일반 요청"| Django
    Nginx -->|"Upgrade: websocket"| FastAPI

    Django <--> Postgres
    FastAPI <--> Mongo
    Django -->|"publish 이벤트"| Redis
    FastAPI -->|"subscribe + publish"| Redis
```

---

## 2. Nginx 라우팅 규칙

```mermaid
flowchart LR
    subgraph Nginx["Nginx 라우팅"]
        L1["location /"]
        L2["location /ws/"]
        L3["location /media/"]
        L4["location /static/"]
    end

    L1 --> Django["→ backend-core:8000"]
    L2 --> FastAPI["→ backend-chat:8001<br/>(WebSocket Upgrade)"]
    L3 --> Media["→ /app/media/"]
    L4 --> Static["→ /app/static/"]
```

---

## 3. Django → FastAPI 간 통신 (Redis Pub/Sub)

**Django와 FastAPI는 HTTP로 직접 호출하지 않습니다.**  
이벤트 기반 통신을 위해 **Redis Pub/Sub**을 사용합니다.

```mermaid
sequenceDiagram
    participant User as 사용자/시스템
    participant Django as Django (backend-core)
    participant Redis as Redis
    participant FastAPI as FastAPI (backend-chat)
    participant WS as WebSocket 클라이언트

    Note over Django,FastAPI: 케이스 1: 미션 수락 시 (매칭 성사)
    User->>Django: POST /api/missions/{id}/accept
    Django->>Django: mission.status = MATCHED, helper 저장
    Django->>Redis: PUBLISH chat_{mission_id} {"type":"SYSTEM", "data":{...}}
    Redis-->>FastAPI: (구독 중인 FastAPI가 수신)
    FastAPI->>WS: 시스템 메시지 브로드캐스트

    Note over Django,FastAPI: 케이스 2: 차단 유저 강퇴
    User->>Django: POST /api/users/block/ (차단 대상 유저)
    Django->>Django: 해당 유저와 연관된 진행 중 미션 조회
    loop 각 미션방
        Django->>Redis: PUBLISH chat_{mission_id} {"type":"KICK", "data":{"target_id": N}}
    end
    Redis-->>FastAPI: KICK 이벤트 수신
    FastAPI->>WS: target_id 소켓에 강퇴 메시지 전송 후 연결 종료
```

---

## 4. Redis 채널 규칙 및 역할 분리

```mermaid
flowchart LR
    subgraph Django["Django"]
        A1["missions/views.py<br/>mission_accept()"]
        A2["users/views.py<br/>block_user()"]
        A3["common/utils.py<br/>publish_chat_event()"]
    end

    subgraph Redis["Redis"]
        CH["채널: chat_{room_id}<br/>(room_id = mission_id)"]
    end

    subgraph FastAPI["FastAPI"]
        B1["api/chat.py<br/>WebSocket 엔드포인트"]
        B2["services/chat_service.py<br/>ConnectionManager"]
        B3["_redis_sub_listener()<br/>KICK, COMPLETE 처리"]
    end

    A1 -->|"SYSTEM (매칭 성사)"| A3
    A2 -->|"KICK (강퇴)"| A3
    A3 -->|"PUBLISH"| CH
    CH -->|"subscribe"| B3
    B3 -->|"강퇴/시스템 메시지 반영"| B2
    B2 --> B1
```

| 발신 (Django) | 이벤트 타입 | 의미 |
|---------------|-------------|------|
| 미션 수락 완료 | `SYSTEM` | 매칭 성사 알림 |
| 유저 차단 | `KICK` | 해당 유저를 연관 채팅방에서 강퇴 |

| 수신 (FastAPI) | 처리 |
|----------------|------|
| `KICK` | `data.target_id` 소켓에 강퇴 메시지 전송 후 연결 종료 |
| `COMPLETE` | 방 전체에 "미션이 완료되었습니다" 시스템 메시지 브로드캐스트 |

---

## 5. FastAPI 채팅 흐름 (클라이언트 ↔ FastAPI)

```mermaid
sequenceDiagram
    participant C1 as 클라이언트 A
    participant C2 as 클라이언트 B
    participant Nginx as Nginx
    participant FastAPI as FastAPI
    participant MongoDB as MongoDB
    participant Redis as Redis

    C1->>Nginx: WS /ws/chat/{room_id}/{user_id}
    Nginx->>FastAPI: WebSocket 프록시
    FastAPI->>FastAPI: connect(room_id, user_id)
    FastAPI->>Redis: SUBSCRIBE chat_{room_id} (방 최초 생성 시)
    FastAPI-->>C1: 연결 수락

    C1->>FastAPI: 텍스트 메시지 전송
    FastAPI->>MongoDB: 메시지 저장
    FastAPI->>Redis: PUBLISH (같은 방 구독자에게 전파)
    FastAPI-->>C2: 메시지 수신 (같은 방)

    Note over FastAPI: GET /ws/history/{room_id} → MongoDB에서 조회
```

---

## 6. 요약: “Django와 FastAPI 간 통신” 정리

| 구분 | 내용 |
|------|------|
| **직접 HTTP 호출** | 없음. 서로의 API를 HTTP로 호출하지 않음. |
| **통신 수단** | **Redis Pub/Sub** (채널명: `chat_{room_id}`) |
| **Django 역할** | 비즈니스 로직 처리 후, 이벤트를 `publish_chat_event()`로 Redis에 발행. |
| **FastAPI 역할** | Redis를 구독해 `KICK`, `COMPLETE` 등 수신 후 WebSocket 클라이언트에 반영. |
| **왜 이렇게 설계했는지** | 서비스 간 **결합도 감소**(이벤트 기반), **확장성**(채팅 서버 다중 인스턴스 시에도 Redis 하나로 동기화 가능), **역할 분리**(Django=도메인/DB, FastAPI=실시간 소켓). |

이 문서는 `Uniquest/` 프로젝트 루트 기준 상대 경로로, `docs/architecture-django-fastapi-communication.md` 에 두고 사용하면 됩니다.
