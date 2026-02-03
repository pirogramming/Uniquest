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
        console.warn('로그인 토큰이 없어용');
        window.location.href = '/api/users/login/';
        return null;
    }

    try {
        const response = await fetch('/api/users/api/homepage');

        const userData = await response.json();
        console.log(userData)
        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }

        // 데이터 렌더링 로직을 try 블록 안으로 이동
        if (userData && userData.id) {
            const nicknameElement = document.getElementById('nickname');
            const missionElement = document.getElementById('mission_cards');
            const matched = document.getElementById('matched');
            const waiting = document.getElementById('waiting');
            const completed = document.getElementById('completed');

            if (nicknameElement) {
                nicknameElement.innerText = userData.nickname;
            }
            if (missionElement) {
                console.log('yeah')
                userMission = userData.missions
                missionElement.innerHTML = ""
                userData.missions.forEach(({ id, title, status, descriptions, category, reward, location_name }) => {
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
                    </div>`
                });
            }
            if (matched && waiting && completed) {
                matched.innerHTML = userData.matched_count
                waiting.innerHTML = userData.waiting_count
                completed.innerHTML = userData.completed_count

            }


            // 미션 관련 로직도 여기에 추가 가능
            console.log("환영합니다, " + userData.nickname + "님!");
        }
    } catch (error) {
        console.error("네트워크 오류 감지", error);
        return null;
    }

}

window.addEventListener('DOMContentLoaded', renderHomepage);