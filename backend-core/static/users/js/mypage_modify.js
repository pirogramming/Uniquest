async function getUserData() {
    // 1. 금고(로컬스토리지)에서 토큰 꺼내기
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        console.warn("로그인 토큰이 없습니다.");
        return null;
    }

    try {
        // 2. 백엔드 API에 토큰을 담아서 던지기 (fetch)
        const response = await fetch('/users/api/profile_modify/', { // 팀장님의 API 주소
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
        const name = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');
        const university = document.getElementById('user-univ');

        if (nicknameElement) nicknameElement.value = user.nickname;
        if (name) name.value = user.username;
        if (userEmail) userEmail.innerText = user.univ_email;
        if (university) university.innerText = user.university;

    } else {
        // 토큰이 없거나 문제가 있다면 로그인 페이지로 보낼 수도 있습니다.
        // window.location.href = '/users/login/';
    }
}

async function patchProfile() {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        alert("로그인이 만료되었습니다. 다시 로그인해주세요.");
        window.location.href = '/users/login/';
        return;
    }

    // 1. 시안에 있는 닉네임과 이름 데이터 수집
    const nickname = document.getElementById('user-nickname').value;
    const username = document.getElementById('user-name').value;

    const updatedData = {
        nickname: nickname,
        username: username
    };

    try {
        // 2. 백엔드 PATCH API 호출
        const response = await fetch('/users/api/profile_modify/', {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedData)
        });

        if (response.ok) {
            alert("프로필이 성공적으로 변경되었습니다! ✨");
            window.location.href = '/users/mypage/'; // 저장 후 마이페이지로 이동
        } else {
            const errorData = await response.json();
            alert("수정 실패: " + (errorData.detail || "오류가 발생했습니다."));
        }
    } catch (error) {
        console.error("네트워크 오류:", error);
        alert("서버 연결에 실패했습니다. 인터넷 연결을 확인해주세요.");
    }
};

function logout(){
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    alert('로그아웃 되었습니다');
    window.location.href = "/users/login/";
}

// 페이지가 로드되면 자동으로 실행
window.addEventListener('DOMContentLoaded', renderProfile);