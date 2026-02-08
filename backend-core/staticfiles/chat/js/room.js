class ChatClient {
    constructor(config) {
        this.roomId = config.roomId;
        this.missionId = config.missionId != null ? config.missionId : config.roomId;
        this.userId = config.userId;
        this.userNickname = config.userNickname;
        this.wsUrl = config.wsUrl;
        this.canAccept = config.canAccept === true;
        this.isAuthor = config.isAuthor === true;
        this.kickableUsers = Array.isArray(config.kickableUsers) ? config.kickableUsers : [];
        this.csrfToken = config.csrfToken || '';

        this.ws = null;
        this.isAuthenticated = false;

        // DOM 요소
        this.messagesContainer = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.statusEl = document.querySelector('.status');

        this.init();
    }

    getToken() {
        return localStorage.getItem('access_token') || localStorage.getItem('access') || '';
    }

    getCsrfToken() {
        if (this.csrfToken) return this.csrfToken;
        const match = document.cookie.match(/csrftoken=([^;]+)/);
        return match ? match[1].trim() : '';
    }

    getAuthHeaders() {
        const token = this.getToken();
        const csrf = this.getCsrfToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        };
        if (csrf) headers['X-CSRFToken'] = csrf;
        return headers;
    }

    init() {
        // 더보기 메뉴(점 세개) 토글 로직 추가
        const moreBtn = document.getElementById('moreMenuBtn');
        const dropdown = document.getElementById('moreDropdown');
        if (moreBtn && dropdown) {
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
            });
            document.addEventListener('click', () => dropdown.classList.remove('active'));
        }

        // 차단 버튼 로직
        document.querySelectorAll('.btn-block-text').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.targetId;
                if (targetId) this.blockUser(parseInt(targetId, 10), '사용자', e.currentTarget);
            });
        });

        // 미션 수락 버튼
        const acceptBtn = document.getElementById('acceptMissionBtn');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => this.acceptMission());
        }

        // 메시지 전송 버튼 제어
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
        }
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            // 입력창에 글자가 있을 때만 전송 버튼 활성화 시각화
            this.messageInput.addEventListener('input', () => {
                if (this.messageInput.value.trim().length > 0) {
                    this.sendBtn.style.background = "#4DA6FF";
                } else {
                    this.sendBtn.style.background = "#D0D5DD";
                }
            });
        }

        this.loadHistory().then(() => {
            this.connect();
        });
    }

    async acceptMission() {
        const acceptBtn = document.getElementById('acceptMissionBtn');
        if (!acceptBtn || !this.canAccept) return;
        acceptBtn.disabled = true;
        try {
            const res = await fetch(`/api/missions/api/${this.missionId}/accept/`, {
                method: 'POST',
                credentials: 'include',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ room_id: this.roomId }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                alert(data.message || '미션 수락이 완료되었습니다.');
                acceptBtn.remove();
                this.canAccept = false;
            } else {
                alert(data.error || '미션 수락에 실패했습니다.');
                acceptBtn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            acceptBtn.disabled = false;
        }
    }

    async blockUser(targetId, nickname, btnEl) {
        if (!confirm(`사용자를 차단하시겠습니까?`)) return;
        try {
            const res = await fetch('/api/users/api/block_user/', {
                method: 'POST',
                credentials: 'include',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ target_id: targetId, room_id: this.roomId }),
            });
            if (res.ok) {
                alert('차단되었습니다.');
                window.location.href = '/api/users/homepage/';
            }
        } catch (err) {
            console.error(err);
        }
    }

    async loadHistory() {
        try {
            const response = await fetch(`/ws/history/${this.roomId}`);
            const history = await response.json();
            history.forEach(msg => {
                this.displayMessage({
                    sender_id: msg.sender_id,
                    content: msg.content,
                    time: msg.time
                });
            });
            this.scrollToBottom();
        } catch (error) {
            console.error('히스토리 로드 실패:', error);
        }
    }

    connect() {
        this.updateStatus('연결 중...', '');
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
            const token = this.getToken();
            if (!token) {
                this.updateStatus('인증 필요', 'error');
                return;
            }
            this.ws.send(JSON.stringify({ type: 'AUTH', token: token }));
        };

        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
        };

        this.ws.onclose = (event) => {
            this.isAuthenticated = false;
            this.setInputEnabled(false);
            if (event.code === 4000) {
                alert('차단되어 채팅방에서 나가셨습니다.');
                window.location.href = '/api/users/homepage/';
            } else {
                this.updateStatus('연결 끊김', 'error');
                setTimeout(() => this.connect(), 5000);
            }
        };
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'AUTH_SUCCESS':
                this.isAuthenticated = true;
                this.setInputEnabled(true);
                this.updateStatus('연결됨', 'connected');
                break;
            case 'TALK':
                this.displayMessage(msg);
                break;
            case 'SYSTEM':
                this.displaySystemMessage(msg.content);
                break;
            case 'KICK':
                window.location.href = '/api/users/homepage/';
                break;
        }
    }

    sendMessage() {
        if (!this.messageInput) return;
        const content = this.messageInput.value.trim();
        if (!content || !this.isAuthenticated) return;
        this.ws.send(content);
        this.messageInput.value = '';
        this.sendBtn.style.background = "#D0D5DD"; // 초기화
    }

    // ✅ 시안 디자인(ChatScreen (1).png)에 맞게 렌더링 구조 수정
    displayMessage(msg) {
        if (!this.messagesContainer) return;
        const isMine = msg.sender_id === this.userId;
        
        const msgGroup = document.createElement('div');
        msgGroup.classList.add('msg-group', isMine ? 'mine' : 'other');

        // 시간을 HH:MM 형식으로 변환 (서버 데이터에 따라 조정 필요)
        const displayTime = msg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msgGroup.innerHTML = `
            <div class="bubble">${this.escapeHtml(msg.content)}</div>
            <span class="time">${displayTime}</span>
        `;

        this.messagesContainer.appendChild(msgGroup);
        this.scrollToBottom();
    }

    displaySystemMessage(content) {
        if (!this.messagesContainer) return;
        const sysMsg = document.createElement('div');
        sysMsg.style.cssText = "text-align: center; font-size: 12px; color: #98A2B3; margin: 10px 0; width: 100%;";
        sysMsg.textContent = content;
        this.messagesContainer.appendChild(sysMsg);
        this.scrollToBottom();
    }

    updateStatus(text, className) {
        if (!this.statusEl) return;
        this.statusEl.textContent = text;
        this.statusEl.style.color = className === 'connected' ? '#4DA6FF' : '#98A2B3';
    }

    setInputEnabled(enabled) {
        if (this.messageInput) this.messageInput.disabled = !enabled;
        if (this.sendBtn) this.sendBtn.disabled = !enabled;
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 초기화 로직 유지
function initChatClient() {
    if (typeof CHAT_CONFIG !== 'undefined') {
        window.chatClient = new ChatClient(CHAT_CONFIG);
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatClient);
} else {
    initChatClient();
}