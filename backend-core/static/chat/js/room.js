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
        const moreDropdown = document.getElementById('moreDropdown');
        if (viewProfileBtn) {
            viewProfileBtn.addEventListener('click', (e) => {
                const userId = viewProfileBtn.dataset.userId;
                if (moreDropdown) moreDropdown.classList.remove('active');
                if (userId) this.showProfile(parseInt(userId, 10));
            });
        }

        // 미션 완료 버튼 (등록자)
        const completeMissionBtn = document.getElementById('completeMissionBtn');
        if (completeMissionBtn) {
            completeMissionBtn.addEventListener('click', () => this.completeMission());
        }

        // 수행자 확정 버튼 (등록자)
        const confirmPerformerBtn = document.getElementById('confirmPerformerBtn');
        if (confirmPerformerBtn) {
            confirmPerformerBtn.addEventListener('click', () => this.confirmPerformer());
        }
        // 수행자 거부 버튼 (등록자)
        const rejectPerformerBtn = document.getElementById('rejectPerformerBtn');
        if (rejectPerformerBtn) {
            rejectPerformerBtn.addEventListener('click', () => this.rejectPerformer());
        }

        const moreMenuBtn = document.getElementById('moreMenuBtn');
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

        // 차단 버튼
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

        // 메시지 전송
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
        if (profileModalBackdrop) profileModalBackdrop.addEventListener('click', (e) => { 
            if (e.target === profileModalBackdrop) this.closeProfileModal(); 
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
            alert('요청 중 오류가 발생했습니다.');
            acceptBtn.disabled = false;
        }
    }

    async confirmPerformer() {
        const btn = document.getElementById('confirmPerformerBtn');
        if (!btn) return;
        btn.disabled = true;
        try {
            const res = await fetch(`/api/missions/api/${this.missionId}/confirm/`, {
                method: 'POST',
                credentials: 'include',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ room_id: this.roomId }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                alert(data.message || '수행자가 확정되었습니다.');
                if (btn) btn.remove();
                const rejectBtn = document.getElementById('rejectPerformerBtn');
                if (rejectBtn) rejectBtn.remove();

                const chatActions = document.getElementById('chatActions');
                if (chatActions && !document.getElementById('completeMissionBtn')) {
                    const completeBtn = document.createElement('button');
                    completeBtn.type = 'button';
                    completeBtn.className = 'btn-action-gray';
                    completeBtn.id = 'completeMissionBtn';
                    completeBtn.textContent = '미션 완료';
                    completeBtn.addEventListener('click', () => this.completeMission());
                    chatActions.appendChild(completeBtn);
                }
            } else {
                alert(data.error || '확정에 실패했습니다.');
                btn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            alert('요청 중 오류가 발생했습니다.');
            btn.disabled = false;
        }
    }

    async rejectPerformer() {
        const btn = document.getElementById('rejectPerformerBtn');
        if (!btn) return;
        if (!confirm('수행자 수락을 거절하시겠습니까?')) return;
        btn.disabled = true;
        try {
            const res = await fetch(`/api/missions/api/${this.missionId}/reject/`, {
                method: 'POST',
                credentials: 'include',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ room_id: this.roomId }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                alert(data.message || '수락을 거절했습니다.');
                if (btn) btn.remove();
                const confirmBtn = document.getElementById('confirmPerformerBtn');
                if (confirmBtn) confirmBtn.remove();
            } else {
                alert(data.error || '거절에 실패했습니다.');
                btn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            alert('요청 중 오류가 발생했습니다.');
            btn.disabled = false;
        }
    }

    async completeMission() {
        const btn = document.getElementById('completeMissionBtn');
        if (!btn) return;
        if (!confirm('미션을 완료 처리하시겠습니까?')) return;
        btn.disabled = true;
        try {
            const res = await fetch(`/api/missions/api/${this.missionId}/complete/`, {
                method: 'POST',
                credentials: 'include',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ room_id: this.roomId }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                alert(data.message || '미션이 완료되었습니다.');
                if (btn) btn.remove();
            } else {
                alert(data.error || '미션 완료에 실패했습니다.');
                btn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            alert('요청 중 오류가 발생했습니다.');
            btn.disabled = false;
        }
    }

    async blockUser(targetId, username, btnEl) {
        if (!btnEl) return;
        if (!confirm(`${username || '해당 유저'}를 차단하시겠습니까?`)) return;
        btnEl.disabled = true;
        try {
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
                alert(data.error || '차단 실패');
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
            const token = this.getToken();
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
        this.ws.onerror = (error) => {
            console.error('WebSocket 에러:', error);
            this.updateStatus('연결 오류', 'error');
        };
    }

    showConfirmButtons() {
        const chatActions = document.getElementById('chatActions');
        if (!chatActions) return;
        if (document.getElementById('confirmPerformerBtn')) return;

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'btn-action-outline';
        confirmBtn.id = 'confirmPerformerBtn';
        confirmBtn.innerHTML = '<i class="fa-regular fa-circle-check"></i> 수행자 확정';
        confirmBtn.addEventListener('click', () => this.confirmPerformer());
        chatActions.appendChild(confirmBtn);

        const rejectBtn = document.createElement('button');
        rejectBtn.type = 'button';
        rejectBtn.className = 'btn-action-gray';
        rejectBtn.id = 'rejectPerformerBtn';
        rejectBtn.textContent = '수행자 거부';
        rejectBtn.addEventListener('click', () => this.rejectPerformer());
        chatActions.appendChild(rejectBtn);
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
                if (msg.action === 'mission_accepted' && this.isAuthor) {
                    this.showConfirmButtons();
                }
                break;
            case 'KICK':
                alert(msg.content || '방장에 의해 강퇴되었습니다.');
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
        this.messageInput.focus();
    }

    // [수정] 좌우 배치 및 시간 아래 출력을 위한 메시지 렌더링 함수
    displayMessage(msg) {
        if (!this.messagesContainer) return;
        const messageEl = document.createElement('div');
        messageEl.classList.add('message');

        // 내 메시지인지 상대방 메시지인지 구분
        const isMine = String(msg.sender_id) === String(this.userId);
        messageEl.classList.add(isMine ? 'mine' : 'other');

        let html = '';
        // 상대방일 경우 닉네임 표시
        if (!isMine && msg.sender_nickname) {
            html += `<div class="sender">${this.escapeHtml(msg.sender_nickname)}</div>`;
        }

        // 말풍선과 시간 레이아웃 (시간이 말풍선 아래로 가도록)
        const timeStr = msg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        html += `
            <div class="content">${this.escapeHtml(msg.content)}</div>
            <div class="time">${timeStr}</div>
        `;

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