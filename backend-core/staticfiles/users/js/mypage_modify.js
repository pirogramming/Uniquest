function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

async function getUserData() {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        console.warn("로그인 토큰이 없습니다.");
        return null;
    }

    try {
        const response = await fetch('/api/users/api/profile_modify/');

        if (response.ok) {
            const userData = await response.json();
            console.log("유저 정보 로드 성공:", userData);
            return userData;
        } else {
            alert('토큰이 만료되었거나 유효하지 않습니다.')
            console.error("토큰이 만료되었거나 유효하지 않습니다.");
            window.location.href = '/api/users/login/';
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
        // HTML에 해당 ID를 가진 태그가 있을 때만 꽂아줌
        const usernameElement = document.getElementById('user-username');
        const userEmail = document.getElementById('user-email');
        const university = document.getElementById('user-univ');
        const userphoto = document.getElementById('profile-preview');

        if (usernameElement) usernameElement.value = user.username;
        if (userEmail) userEmail.innerText = user.univ_email;
        if (university) university.innerText = user.university;
        if (userphoto) {
            if (user.userphoto) {
                userphoto.src = user.userphoto;   // 백엔드에서 준 URL 그대로
            } else {
                userphoto.src = '/static/users/images/profile.png';  // 기본 이미지 (경로는 프로젝트에 맞게)
            }
        }

    } else {
        window.location.href = '/api/users/login/';
    }
}

async function patchProfile() {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        alert("로그인이 만료되었습니다. 다시 로그인해주세요.");
        window.location.href = '/api/users/login/';
        return;
    }

    const username = document.getElementById('user-username').value;
    const userInput = document.getElementById('userphoto')
    const formData = new FormData();

    formData.append('username',username)
    if (userInput.files.length > 0) {
        formData.append('user_photo', userInput.files[0]);
    }

    try {
        // 2. 백엔드 PATCH API 호출
        const response = await fetch('/api/users/api/profile_modify/', {
            method: 'PATCH',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: formData
        });

        if (response.ok) {
            alert("프로필이 성공적으로 변경되었습니다! ✨");
            window.location.href = '/api/users/mypage/'; // 저장 후 마이페이지로 이동
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

function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            // 이미지 태그의 src를 선택한 파일의 데이터로 변경
            document.getElementById('profile-preview').src = e.target.result;
        };
        
        reader.readAsDataURL(input.files[0]);
    }
}

// 페이지가 로드되면 자동으로 실행
window.addEventListener('DOMContentLoaded', renderProfile);