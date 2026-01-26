from pydantic import BaseModel, Field, BeforeValidator
from typing import Optional, List, Annotated
from datetime import datetime

# MongoDB의 _id (ObjectId)를 문자열로 변환하여 처리하기 위한 설정입니다.
# 클라이언트(프론트엔드)와 통신할 때는 일반 문자열(str)로 취급해야 하기 때문입니다.
PyObjectId = Annotated[str, BeforeValidator(str)]

class ChatMessage(BaseModel):
    """
    MongoDB의 'messages' 컬렉션에 저장될 개별 메시지 구조입니다.
    """
    # MongoDB의 고유 ID 필드 (_id를 id로 매핑)
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    
    # Django의 Mission ID를 room_id로 사용하여 두 서비스를 연결합니다.
    room_id: str = Field(..., description="연결된 채팅방(미션) ID")
    
    # 메시지 발신자 정보
    sender_id: int = Field(..., description="발신자 유저 ID")
    sender_nickname: str = Field(default="알 수 없음", description="발신자 닉네임")
    
    # 메시지 본문 및 타입
    content: str = Field(..., description="메시지 내용")
    type: str = Field(default="TEXT", description="메시지 타입 (TEXT, IMAGE, SYSTEM)")
    
    # 생성 시간 (서버 시간 기준 자동 생성)
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        # JSON 변환 시 _id와 id 사이의 매핑을 허용합니다.
        populate_by_name = True
        # 임의의 타입(ObjectId 등) 사용을 허용합니다.
        arbitrary_types_allowed = True
        # API 문서용 예시 데이터
        json_schema_extra = {
            "example": {
                "room_id": "1",
                "sender_id": 10,
                "sender_nickname": "신촌컴공",
                "content": "미션 장소에 도착했습니다!",
                "type": "TEXT"
            }
        }

class ChatRoom(BaseModel):
    """
    채팅방의 메타데이터를 저장하기 위한 구조입니다.
    단체 채팅 시 참여자 목록을 관리할 수 있습니다.
    """
    id: str = Field(alias="_id", description="방 ID (Mission ID와 동일하게 설정)")
    room_name: str = Field(..., description="방 이름")
    participants: List[int] = Field(default=[], description="참여자 유저 ID 목록")
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        populate_by_name = True