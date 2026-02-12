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

        console.log("유저 데이터",userData);

        if (userData && userData.id) {
            const usernameElement = document.getElementById('username');
            const missionElement = document.getElementById('mission_cards');
            const matched = document.getElementById('matched');
            const waiting = document.getElementById('waiting');
            const completed = document.getElementById('completed');
            const imgEl = document.getElementById('userprofile');

            if (usernameElement) usernameElement.innerText = userData.username;
            if (missionElement) {
                console.log('yeah')
                userMission = userData.missions
                missionElement.innerHTML = ""
                
                // [수정 부분] 카테고리 및 상태 배지 동적 클래스 적용
                userData.missions.forEach(({ id, title, status, descriptions, category, reward, location_name }) => {
                    
                    // 1. 상태 배지 클래스 (소문자 변환하여 CSS와 매칭)
                    const statusClass = status ? status.toLowerCase() : '';

                    // 2. 카테고리 클래스 매칭 (한글/영문 코드 모두 지원하도록 보완)
                    const categoryMap = {
                        '심부름': 'errand', 'ERRAND': 'errand',
                        '학업': 'study',   'STUDY': 'study',
                        '대여': 'rent',    'RENT': 'rent',
                        '구인': 'job',     'JOB': 'job',
                        '생활': 'life',    'LIFE': 'life',
                        '기타': 'etc',     'ETC': 'etc'
                    };
                    
                    // 데이터 앞뒤 공백 제거 후 매핑 확인
                    const categoryKey = category ? category.trim() : '기타';
                    const categoryClass = categoryMap[categoryKey] || 'etc';

                    missionElement.innerHTML += `<div class="mission-card" onclick="location.href='/api/missions/${id}/'" style="cursor:pointer;">
                        <div class="card-header">
                            <h3 class="title">${title}</h3>
                            <span class="tag-status ${statusClass}">${status}</span>
                        </div>
                        <p class="description">${descriptions}</p>
                        <div class="card-footer">
                            <div class="info">
                                <span class="tag-category category-${categoryClass}">${category}</span>
                                <span class="location">${location_name || '장소 미정'}</span>
                            </div>
                            <span class="price">${Number(reward).toLocaleString()}원</span>
                        </div>
                    </div>`;
                });
            }
            if (matched && waiting && completed) {
                matched.innerHTML = userData.matched_count
                waiting.innerHTML = userData.waiting_count
                completed.innerHTML = userData.completed_count
                if (imgEl) {
                    if (userData.userphoto) {
                        imgEl.src = userData.userphoto;   // 백엔드에서 준 URL 그대로
                    } else {
                        imgEl.src = '/static/users/images/profile.png';  // 기본 이미지 (경로는 프로젝트에 맞게)
                    }
                }
            }

            console.log("환영합니다, " + userData.username + "님!");
        }
    } catch (error) {
        console.error("네트워크 오류 감지", error);
        return null;
    }
}

window.addEventListener('DOMContentLoaded', renderHomepage);