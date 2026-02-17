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
    const userData = await Auth.getData('/api/users/api/profile_modify/');
    if (userData) console.log("유저 정보 로드 성공:", userData);
    return userData;
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
    const username = document.getElementById('user-username').value;
    const userInput = document.getElementById('userphoto');
    const formData = new FormData();
    formData.append('username', username);
    if (userInput.files.length > 0) {
        formData.append('user_photo', userInput.files[0]);
    }

    const result = await Auth.patchData(
        '/api/users/api/profile_modify/',
        formData,
        true,
        { headers: { 'X-CSRFToken': getCookie('csrftoken') } }
    );
    if (result !== null) {
        alert("프로필이 성공적으로 변경되었습니다!");
        window.location.href = '/api/users/mypage/';
    } else {
        alert("수정 실패: 오류가 발생했습니다.");
    }
}

function logout() {
    alert('로그아웃 되었습니다');
    Auth.logout("/api/users/login/");
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