function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // 지정된 이름(csrftoken)으로 시작하는 쿠키를 찾습니다.
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

async function getuserData() {
    const userData = await Auth.getData('/api/users/api/blocked_users/');
    if (userData) console.log("유저 정보 로드 성공:", userData);
    return userData;
}

async function renderBlockUser() {
    const user = await getuserData();
    const blocked_user_box = document.getElementById('blocked-user-list');
    const countEl = document.getElementById('block-count');

    if (!user || !blocked_user_box) {
        if (countEl) countEl.textContent = '0';
        if (blocked_user_box) blocked_user_box.innerHTML = '<p class="empty-message">로그인이 필요합니다.</p>';
        return;
    }

    const list = user.blocked_users || [];
    if (countEl) countEl.textContent = String(list.length);

    if (list.length > 0) {
        blocked_user_box.innerHTML = "" // 내부 HTML비우기

        list.forEach(({ id, username }) => {
            blocked_user_box.innerHTML += `
            <div class="user-card">
                <div class="user-info">
                    <div class="avatar"></div>
                    <div class="user-text">
                        <p class="nickname">${username || '(알 수 없음)'}</p>
                        <p class="date">차단 해제 버튼을 누르면 목록에서 제거됩니다.</p>
                    </div>
                </div>
                <button class="unblock-btn" onclick="transmit_user_id(${id})">차단 해제</button>
            </div>
            `;
        });
    } else {
        blocked_user_box.innerHTML = '<p class="empty-message">차단한 사용자가 없습니다.</p>';
    }
}

async function transmit_user_id(target_id) {
    const response_json = await Auth.postData(
        '/api/users/api/blocked_users/',
        { target_id: target_id },
        false,
        { headers: { 'X-CSRFToken': getCookie('csrftoken') } }
    );
    if (response_json && response_json.message) {
        alert(response_json.message);
        location.reload();
    }
}

window.addEventListener('DOMContentLoaded',renderBlockUser);