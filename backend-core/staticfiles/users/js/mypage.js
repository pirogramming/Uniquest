async function getUserData() {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        console.warn("로그인 토큰이 없습니다.");
        window.location.href = "/api/users/login/"
        return null;
    }

    try {
        const response = await fetch('/api/users/api/profile/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const userData = await response.json();
            console.log("유저 정보 로드 성공:", userData);
            return userData;
        } else {
            console.error("토큰이 만료되었거나 유효하지 않습니다.");
            return null;
        }
    } catch (error) {
        alert("네트워크 오류 발생:");
        window.location,href = "/api/users/login/"
        return null;
    }
}

async function renderProfile() {
    const user = await getUserData();
    
    if (user) {
        const my_missions = user.missions;
        const blockers = user.blocked_people;

        const usernameElement = document.getElementById('user-username');
        const univElement = document.getElementById('user-univ');
        const mannerScore = document.getElementById('user-score'); // 점수 텍스트
        const register_missions = document.getElementById('my-registered-missions');
        const performed_missions = document.getElementById('my-performed-missions');
        const score_bar_fill = document.getElementById('score_bar_fill');

        score_bar_fill.style = `width : ${user.manner_score}%;`

        // 1. 기본 정보 반영
        if (usernameElement) usernameElement.innerText = user.username;
        if (univElement) univElement.innerText = user.university;
        if (mannerScore) mannerScore.innerText = user.manner_score;

        if (user.missions.length > 0) {
            const missionHTML = user.missions.map(({id, title, reward, status, descriptions,category,location_name}) => {
                
                // reward가 숫자인지 확인 후 포맷팅
                const formattedReward = typeof reward === 'number' ? reward.toLocaleString() : reward;

                return `
                    <a class="mission-card" href="/api/missions/${id}" style="text-decoration: none; color: inherit; display: block;">
                        <div class="card-header">
                            <h3 class="title">${title}</h3>
                            <span class="status-badge waiting">${status}</span>
                        </div>
                        <div class="description-box">
                            <p class="mission-content">${descriptions}</p>
                        </div>
                        

                        <div class="card-footer">
                            <div class="info">
                                <span class="tag-category category-etc">${category}</span>
                                <span class="location">${location_name}</span>
                            </div>
                            <span class="price">${reward}원</span>
                        </div>
                    </a>`;
            }).join(''); // 배열을 하나의 문자열로 합침

            console.log(missionHTML)

            register_missions.innerHTML = missionHTML;
        }

        if (user.accepted_missions.length > 0){
            performed_missions.innerHTML = ""
            user.accepted_missions.forEach(({id,title,reward,status,descriptions}) => {
                performed_missions.innerHTML += `<div class="mission-card">
                                                    <div class="card-header">
                                                        <span class="status-badge waiting">${status}</span>
                                                    </div>
                                                    
                                                    <div class="card-body">
                                                        <h3 class="mission-title">${title}</h3>
                                                        <p class="mission-content">${descriptions}</p>
                                                    </div>
                                                    
                                                    <div class="card-footer">
                                                        <div class="reward-info">
                                                            <span class="label">보상</span>
                                                            <span class="reward-amount">${reward}</span>
                                                        </div>
                                                    </div>
                                                </div>`
            });
        }
        // console.log('나의 미션들',my_missions)
        // console.log('블락 인원들',blockers)

        // 2. 점수 텍스트 및 막대 그래프 업데이트 [핵심 수정 부분]
        if (mannerScore) {
            // 서버 점수를 반영 (예: 85점)
            mannerScore.innerText = `${user.manner_score}점`; 

            // 막대 그래프 너비(width)를 점수와 동일하게 설정
            const scoreBar = document.querySelector('.score-bar-fill');
            if (scoreBar) {
                scoreBar.style.width = `${user.manner_score}%`;
            }
        }

        // 차단 관리/미션 리스트 로직 (필요 시 수정)
        // if (register_missions) {
        //     register_missions.innerHTML = ""; // 초기화
        //     blockers.forEach(({id, nickname}) => {
        //         register_missions.innerHTML += `<div>${id} : ${nickname}</div>`;
        //     });
        // }

    }
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    alert("로그아웃 되었습니다.");
    window.location.href = "/api/users/login/";
}


async function signout() {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
        const res = await fetch('/api/users/api/signout/', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            console.error("회원 탈퇴 완료");
            window.location.href = "/api/users/login/"
            return
        } else {
            console.error("탈퇴 중 에러발생");
            alert('에러')
            return null;
        }
    } catch (error) {
        console.error("오류 발생:", error);
    }
}

window.addEventListener('DOMContentLoaded', renderProfile);
