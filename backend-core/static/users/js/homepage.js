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

async function renderHomepage() {
    const token = localStorage.getItem('access_token');

    if (!token) {
        window.location.href = '/api/users/homepage_guest/';
        return;
    }

    try {
        const response = await fetch('/api/users/api/homepage', {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const userData = await response.json();
        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }

        const quick_menu = document.getElementById('quick-menu');
        const mission_status_card = document.getElementById('mission-status-card');
        if (quick_menu) quick_menu.style.display = 'block';
        if (mission_status_card) mission_status_card.style.display = 'block';

        if (userData && userData.id) {
            const nicknameElement = document.getElementById('nickname');
            const missionElement = document.getElementById('mission_cards');
            const matched = document.getElementById('matched');
            const waiting = document.getElementById('waiting');
            const completed = document.getElementById('completed');

            if (nicknameElement) nicknameElement.innerText = userData.nickname;
            if (missionElement) {
                missionElement.innerHTML = '';
                (userData.missions || []).forEach(({ id, title, status, descriptions, category, reward, location_name }) => {
                    missionElement.innerHTML += `<div class="mission-card" onclick="location.href='/api/missions/${id}/'">
                        <div class="card-header">
                            <h3 class="title">${title}</h3>
                            <span class="tag-status">${status}</span>
                        </div>
                        <p class="description">${descriptions}</p>
                        <div class="card-footer">
                            <div class="info">
                                <span class="tag-category category-delivery">${category}</span>
                                <span class="location">${location_name}</span>
                            </div>
                            <span class="price">${reward}</span>
                        </div>
                    </div>`;
                });
            }
            if (matched) matched.innerText = userData.matched_count ?? 0;
            if (waiting) waiting.innerText = userData.waiting_count ?? 0;
            if (completed) completed.innerText = userData.completed_count ?? 0;
        }
    } catch (error) {
        console.error("네트워크 오류 감지", error);
        return null;
    }
}

window.addEventListener('DOMContentLoaded', renderHomepage);