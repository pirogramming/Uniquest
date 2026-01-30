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
            window.location.href = '/users/login/';
            return null;
        }
    } catch (error) {
        console.error("네트워크 오류 발생:", error);
        return null;
    }
}

/**
 * 화면의 특정 ID를 가진 요소에 유저 데이터를 꽂아주는 함수
 */
async function renderProfile() {
    const user = await getUserData();
    
    if (user) {
        // HTML에 해당 ID를 가진 태그가 있을 때만 꽂아줌
        const nicknameElement = document.getElementById('user-nickname');
        const univElement = document.getElementById('user-univ');
        const mannerScore = document.getElementById('user-score');

        if (nicknameElement) nicknameElement.innerText = user.nickname;
        if (univElement) univElement.innerText = user.university;
        if (mannerScore) mannerScore.innerText = user.manner_score;

    } else {
        // 토큰이 없거나 문제가 있다면 로그인 페이지로 보낼 수도 있습니다.
        // window.location.href = '/users/login/';
    }
}

async function logout(){
    
}

// 페이지가 로드되면 자동으로 실행
window.addEventListener('DOMContentLoaded', renderProfile);