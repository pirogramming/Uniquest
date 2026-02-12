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

        // 프로필 보기
        const viewProfileBtn = document.getElementById('viewProfileBtn');
        if (viewProfileBtn) {
            viewProfileBtn.addEventListener('click', (e) => {
                const userId = viewProfileBtn.dataset.userId;
                moreDropdown.classList.remove('active');
                if (userId) this.showProfile(parseInt(userId, 10));
            });
        }

        const moreMenuBtn = document.getElementById('moreMenuBtn');
        const moreDropdown = document.getElementById('moreDropdown');
        if (moreMenuBtn && moreDropdown) {
            moreMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                moreDropdown.classList.toggle('active');
            });
            document.addEventListener('click', () => {
                moreDropdown.classList.remove('active');
            });
            moreDropdown.addEventListener('click', (e) => e.stopPropagation());
        }
        // 차단 버튼: 가장 먼저 등록 (sendBtn/messageInput 오류 시에도 동작)
        document.querySelectorAll('.btn-block, .btn-block-text').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.targetId;
                const username = e.currentTarget.dataset.username || '';
                if (targetId) this.blockUser(parseInt(targetId, 10), username, e.currentTarget);
            });
        });

        // 미션 수락 버튼
        const acceptBtn = document.getElementById('acceptMissionBtn');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => this.acceptMission());
        }

        // 메시지 전송 (null이면 리스너 생략)
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
        }

        // 채팅 히스토리 로드 후 WebSocket 연결
        this.loadHistory().then(() => {
            this.connect();
        });

        // 프로필 모달 닫기
        const profileModalClose = document.getElementById('profileModalClose');
        const profileModalBackdrop = document.getElementById('profileModalBackdrop');
        if (profileModalClose) profileModalClose.addEventListener('click', () => this.closeProfileModal());
        if (profileModalBackdrop) profileModalBackdrop.addEventListener('click', (e) => { if (e.target === profileModalBackdrop) this.closeProfileModal(); });
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
            alert('요청 중 오류가 발생했습니다.');
            acceptBtn.disabled = false;
        }
    }

    async blockUser(targetId, username, btnEl) {
        if (!btnEl) return;
        if (!confirm(`${username || '해당 유저'}를 차단하시겠습니까?`)) return;
        btnEl.disabled = true;
        try {
            // 차단 = 1) 차단 목록 추가 2) 채팅방에서 강퇴 (room_id 필요)
            const res = await fetch('/api/users/api/block_user/', {
                method: 'POST',
                credentials: 'include',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ target_id: targetId, room_id: this.roomId }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                alert(data.message || '차단되었습니다.');
                btnEl.textContent = '차단됨';
            } else {
                const msg = data.error || data.detail || (typeof data === 'object' ? JSON.stringify(data) : String(data)) || `차단 실패 (${res.status})`;
                console.warn('block_user 실패:', res.status, data);
                alert(msg);
                btnEl.disabled = false;
            }
        } catch (err) {
            console.error(err);
            alert('요청 중 오류가 발생했습니다.');
            btnEl.disabled = false;
        }
    }
    async showProfile(userId) {
        const backdrop = document.getElementById('profileModalBackdrop');
        if (!backdrop) return;
        try {
            const res = await fetch(`/api/users/api/profile/${userId}/`, {
                method: 'GET',
                credentials: 'include',
                headers: this.getAuthHeaders(),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && !data.error) {
                const photoEl = document.getElementById('profileModalPhoto');
                const photoPlaceholder = document.getElementById('profileModalPhotoPlaceholder');
                const nameEl = document.getElementById('profileModalName');
                const universityEl = document.getElementById('profileModalUniversity');
                const mannerEl = document.getElementById('profileModalManner');
                if (nameEl) nameEl.textContent = data.username || '';
                if (universityEl) universityEl.textContent = data.university ? `학교: ${data.university}` : '';
                if (mannerEl) mannerEl.textContent = data.manner_score != null ? `매너 온도 ${data.manner_score}°C` : '';
                if (data.userphoto && photoEl) {
                    photoEl.src = data.userphoto;
                    photoEl.style.display = '';
                    if (photoPlaceholder) photoPlaceholder.style.display = 'none';
                } else {
                    if (photoEl) photoEl.style.display = 'none';
                    if (photoPlaceholder) photoPlaceholder.style.display = 'flex';
                }
                backdrop.style.display = 'flex';
                backdrop.setAttribute('aria-hidden', 'false');
            } else {
                alert(data.error || '프로필을 불러올 수 없습니다.');
            }
        } catch (err) {
            console.error(err);
            alert('프로필을 불러오는 중 오류가 발생했습니다.');
        }
    }

    closeProfileModal() {
        const backdrop = document.getElementById('profileModalBackdrop');
        if (backdrop) {
            backdrop.style.display = 'none';
            backdrop.setAttribute('aria-hidden', 'true');
        }
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
                window.location.href = '/api/users/login/';
                return;
            }

            this.ws.send(JSON.stringify({
                type: 'AUTH',
                token: token,
                username: this.userNickname || ''
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
                // 강퇴됨: 알림 후 다른 페이지로 이동
                this.updateStatus('연결 종료됨', 'error');
                alert('차단되어 채팅방에서 나가셨습니다.');
                window.location.href = '/api/users/homepage/';
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
                window.location.href = '/api/users/homepage/';
                break;

            default:
                console.log('알 수 없는 메시지 타입:', msg);
        }
    }

    sendMessage() {
        if (!this.messageInput) return;
        const content = this.messageInput.value.trim();

        if (!content || !this.isAuthenticated) return;

        this.ws.send(content);
        this.messageInput.value = '';
        this.messageInput.focus();
    }

    displayMessage(msg) {
        if (!this.messagesContainer) return;
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
        if (!this.messagesContainer) return;
        const messageEl = document.createElement('div');
        messageEl.classList.add('message', 'system');
        messageEl.textContent = content;
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    updateStatus(text, className) {
        if (!this.statusEl) return;
        this.statusEl.textContent = text;
        this.statusEl.className = 'status';
        if (className) {
            this.statusEl.classList.add(className);
        }
    }

    setInputEnabled(enabled) {
        if (this.messageInput) this.messageInput.disabled = !enabled;
        if (this.sendBtn) this.sendBtn.disabled = !enabled;

        if (enabled && this.messageInput) {
            this.messageInput.focus();
        }
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

// 페이지 로드 시 채팅 클라이언트 초기화
function initChatClient() {
    if (typeof CHAT_CONFIG !== 'undefined') {
        window.chatClient = new ChatClient(CHAT_CONFIG);
    } else {
        console.error('CHAT_CONFIG가 정의되지 않았습니다.');
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatClient);
} else {
    initChatClient();
}
