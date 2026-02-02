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
    // 1. 금고(로컬스토리지)에서 토큰 꺼내기
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        console.warn("로그인 토큰이 없습니다.");
        return null;
    }

    try {
        // 2. 백엔드 API에 토큰을 담아서 던지기 (fetch)
        const response = await fetch('/api/users/blocked_users/', { // 팀장님의 API 주소
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`, // 👈 이게 제일 중요!
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const userData = await response.json();
            console.log("유저 정보 로드 성공:", userData);
            return userData;
        } else {
            console.error("토큰이 만료되었거나 유효하지 않습니다.");
            alert('노 토큰')
            // window.location.href = '/users/login/';
            return null;
        }
    } catch (error) {
        console.error("네트워크 오류 발생:", error);
        return null;
    }
}

async function renderBlockUser() {
    const user = await getuserData();
    const blocked_user_box = document.getElementById('blocked-user-list');


    if(user.blocked_users && user){
        blocked_user_box.innerHTML = "" // 내부 HTML비우기

        user.blocked_users.forEach(({id,nickname}) => {
            blocked_user_box.innerHTML += `
            <div class="user-card">
                <div class="user-info">
                    <div class="avatar"></div>
                    <div class="user-text">
                        <p class="nickname">${nickname}</p>
                        <p class="date">차단일: 2026-01-20</p>
                    </div>
                </div>
                <button class="unblock-btn" onclick="transmit_user_id(${id})">차단 해제</button>
            </div>
            `
        });
    }
}

async function transmit_user_id(target_id){

    const token = localStorage.getItem('access_token');

    if (!token) {
        alert("로그인 정보가 없습니다.");
        return;
    }
    try {
        // 2. 백엔드 API에 토큰을 담아서 던지기 (fetch)
        const response = await fetch('/users/api/blocked_users/', { // 팀장님의 API 주소
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`, // 👈 이게 제일 중요!
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ "target_id": target_id })
        });

        if (response.ok) {
            const userData = await response.json();
            console.log("유저 정보 수정 성공:", userData);
            location.reload();
        } else {
            console.error("토큰이 만료되었거나 유효하지 않습니다.");
            alert('노 토큰')
            // window.location.href = '/users/login/';
            return null;
        }

    } catch (error) {
        console.error("네트워크 오류 발생:", error);
        return null;
    }
}

window.addEventListener('DOMContentLoaded',renderBlockUser);