class ChatClient {
    constructor(config) {
        this.roomId = config.roomId;
        this.userId = config.userId;
        this.userNickname = config.userNickname;
        this.wsUrl = config.wsUrl;

        this.ws = null;
        this.isAuthenticated = false;

        // DOM 요소
        this.messagesContainer = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.statusEl = document.querySelector('.status');

        this.init();
    }

    init() {
        // 이벤트 리스너 등록
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 채팅 히스토리 로드 후 WebSocket 연결
        this.loadHistory().then(() => {
            this.connect();
        });
    }

    async loadHistory() {
        try {
            const response = await fetch(`/ws/history/${this.roomId}`);
            const history = await response.json();

            history.forEach(msg => {
                this.displayMessage({
                    type: msg.type || 'TALK',
                    sender_id: msg.sender_id,
                    sender_nickname: msg.sender_nickname,
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
            console.log('WebSocket 연결됨, 인증 시도...');
            this.updateStatus('인증 중...', '');

            // ✅ 첫 메시지로 AUTH 전송
            const token = localStorage.getItem('access_token') || localStorage.getItem('access');

            if (!token) {
                this.updateStatus('토큰 없음', 'error');
                alert('로그인이 필요합니다.');
                window.location.href = '/users/login/';
                return;
            }

            this.ws.send(JSON.stringify({
                type: 'AUTH',
                token: token
            }));
        };

        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
        };

        this.ws.onclose = (event) => {
            console.log('WebSocket 종료:', event.code);
            this.isAuthenticated = false;
            this.setInputEnabled(false);

            if (event.code === 4001) {
                this.updateStatus('인증 실패', 'error');
            } else if (event.code === 4000) {
                // 강퇴됨
                this.updateStatus('연결 종료됨', 'error');
            } else {
                this.updateStatus('연결 끊김', 'error');
                // 5초 후 재연결 시도
                setTimeout(() => this.connect(), 5000);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket 에러:', error);
            this.updateStatus('연결 오류', 'error');
        };
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'AUTH_SUCCESS':
                console.log('✅ 인증 성공:', msg.user_id);
                this.isAuthenticated = true;
                this.setInputEnabled(true);
                this.updateStatus('연결됨', 'connected');
                break;

            case 'ERROR':
                console.error('❌ 에러:', msg.content);
                this.displaySystemMessage(msg.content);
                break;

            case 'TALK':
                this.displayMessage(msg);
                break;

            case 'SYSTEM':
                this.displaySystemMessage(msg.content);
                break;

            case 'KICK':
                alert(msg.content || '방장에 의해 강퇴되었습니다.');
                window.location.href = '/';
                break;

            default:
                console.log('알 수 없는 메시지 타입:', msg);
        }
    }

    sendMessage() {
        const content = this.messageInput.value.trim();

        if (!content || !this.isAuthenticated) return;

        this.ws.send(content);
        this.messageInput.value = '';
        this.messageInput.focus();
    }

    displayMessage(msg) {
        const messageEl = document.createElement('div');
        messageEl.classList.add('message');

        const isMine = msg.sender_id === this.userId;
        messageEl.classList.add(isMine ? 'mine' : 'other');

        let html = '';

        if (!isMine && msg.sender_nickname) {
            html += `<div class="sender">${this.escapeHtml(msg.sender_nickname)}</div>`;
        }

        html += `<div class="content">${this.escapeHtml(msg.content)}</div>`;

        if (msg.time) {
            html += `<div class="time">${msg.time}</div>`;
        }

        messageEl.innerHTML = html;
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    displaySystemMessage(content) {
        const messageEl = document.createElement('div');
        messageEl.classList.add('message', 'system');
        messageEl.textContent = content;
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    updateStatus(text, className) {
        this.statusEl.textContent = text;
        this.statusEl.className = 'status';
        if (className) {
            this.statusEl.classList.add(className);
        }
    }

    setInputEnabled(enabled) {
        this.messageInput.disabled = !enabled;
        this.sendBtn.disabled = !enabled;

        if (enabled) {
            this.messageInput.focus();
        }
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 페이지 로드 시 채팅 클라이언트 초기화
document.addEventListener('DOMContentLoaded', () => {
    if (typeof CHAT_CONFIG !== 'undefined') {
        window.chatClient = new ChatClient(CHAT_CONFIG);
    } else {
        console.error('CHAT_CONFIG가 정의되지 않았습니다.');
    }
});