async function getUserData() {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        console.warn("로그인 토큰이 없습니다.");
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
        console.error("네트워크 오류 발생:", error);
        return null;
    }
}

async function renderProfile() {
    const user = await getUserData();
    
    if (user) {
        const my_missions = user.missions;
        const blockers = user.blocked_people;

        const nicknameElement = document.getElementById('user-nickname');
        const univElement = document.getElementById('user-univ');
        const mannerScore = document.getElementById('user-score'); // 점수 텍스트
        const register_missions = document.getElementById('my-registered-missions');
        const performed_missions = document.getElementById('my-performed-missions');

        // 1. 기본 정보 반영
        if (nicknameElement) nicknameElement.innerText = user.nickname;
        if (univElement) univElement.innerText = user.university;

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
        if (register_missions) {
            register_missions.innerHTML = ""; // 초기화
            blockers.forEach(({id, nickname}) => {
                register_missions.innerHTML += `<div>${id} : ${nickname}</div>`;
            });
        }

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
            localStorage.clear();
            alert("회원 탈퇴 완료");
            window.location.href = "/api/users/login/";
        }
    } catch (error) {
        console.error("오류 발생:", error);
    }
}

window.addEventListener('DOMContentLoaded', renderProfile);