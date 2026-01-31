async function getUserData() {
    // 1. 금고(로컬스토리지)에서 토큰 꺼내기
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        console.warn("로그인 토큰이 없습니다.");
        return null;
    }

    try {
        // 2. 백엔드 API에 토큰을 담아서 던지기 (fetch)
        const response = await fetch('/users/api/profile/', { // 팀장님의 API 주소
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
            window.location.href = '/users/login/';
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
        const my_missions = user.missions
        const blockers = user.blocked_people

        const nicknameElement = document.getElementById('user-nickname');
        const univElement = document.getElementById('user-univ');
        const mannerScore = document.getElementById('user-score');
        const register_missions = document.getElementById('my-registered-missions');
        const performed_missions = document.getElementById('my-performed-missions');


        if (nicknameElement) nicknameElement.innerText = user.nickname;
        if (univElement) univElement.innerText = user.university;
        if (mannerScore) mannerScore.innerText = user.manner_score;
        blockers.forEach(({id,nickname}) => {
            console.log(`${id} : ${nickname}`)
            if (register_missions) register_missions.innerHTML += `${id} : ${nickname}`;
        });
        // if (register_missions) register_missions.innerHTML = ;
        // if (performed_missions) performed_missions.innerHTML = ;
        console.log('나의 미션들',my_missions)
        console.log('블락 인원들',blockers)

    } else {
        // 토큰이 없거나 문제가 있다면 로그인 페이지로 보낼 수도 있습니다.
        // window.location.href = '/users/login/';
    }
}

function logout() { // 로그아웃 로직
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    alert("로그아웃 되었습니다.");
    window.location.href = "/users/login/"; // 로그인 페이지로 이동
}

// 페이지가 로드되면 자동으로 실행
window.addEventListener('DOMContentLoaded', renderProfile);