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
        alert('로그인 토큰이 없어용');
        const response = await fetch ('/api/users/api/homepage_unlogin');
        const data = await response.json();
        const welcome_header = document.getElementById('header-top');
        welcome_header.innerHTML = `<section class="welcome-header">
                                        <div class="logo-circle">U</div>
                                        <h1 class="brand-name">Uniquest</h1>
                                        <p class="brand-subtitle">대학생 미션 중개 플랫폼</p>
                                    </section>`;

        const quick_menu = document.getElementById('quick-menu');
        quick_menu.style.display = "none"

        const mission_status_card = document.getElementById('mission-status-card');
        mission_status_card.style.display = 'none'

        const welcome_intro = document.getElementById('mission-list-section');
        // welcome_intro.innerHTML = `<section class="welcome-intro">
        //         <h2>캠퍼스 라이프를 더 쉽게</h2>
        //         <p>작은 부탁부터 과제 도움까지,<br>학생들끼리 서로 돕는 미션 플랫폼</p>
        //     </section>`;
        welcome_intro.innerHTML = `<div class="section-title">
                <h2>진행 중인 미션</h2>
                <a href="{% url 'missions:mission_list'%}" class="view-all">전체보기</a>
            </div>`
        data.missions.forEach(({ id, title, status, descriptions, category, reward, location_name }) => {
            welcome_intro.innerHTML += `<div class="mission-card" onclick="location.href='/api/missions/${id}/'">
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


        console.log(data)
        return null;
    } else {
        try {
            const response = await fetch('/api/users/api/homepage');

            const userData = await response.json();
            console.log(userData)
            if (!response.ok) {
                throw new Error(`서버 응답 오류: ${response.status}`);
            }

            const quick_menu = document.getElementById('quick-menu');
            quick_menu.style.display = "block"
            const mission_status_card = document.getElementById('mission-status-card');
            mission_status_card.style.display = 'block'

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

}

window.addEventListener('DOMContentLoaded', renderHomepage);