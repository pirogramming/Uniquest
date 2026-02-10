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

async function handleSignup() {
    if (!checkPassword(document.getElementById('password').value , document.getElementById('password_check').value)) {
        return
    }

    const csrftoken = getCookie('csrftoken');
    
    const password_reset_token = localStorage.getItem('password_reset_token')

    const changeData = {
        password: document.getElementById('password').value,
        password_reset_token : password_reset_token,
    }

    const response = await fetch('/api/users/change_password/info/', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify(changeData)
    });

    if (response.ok) {
        localStorage.removeItem('password_reset_token')
        console.log("토큰 삭제 시도됨. 현재 토큰 상태:", localStorage.getItem('password_reset_token'));
        alert("비밀번호 변경 성공!");
        window.location.href = "/api/users/login/"; // 가입 후 로그인 페이지로 이동
    } else {
        const errorData = await response.json();
        console.error("에러 발생:", errorData);
        alert("변경 실패 ㅠㅠ: " + JSON.stringify(errorData));
    }
}

function checkPassword(password,confirmPassword){
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

    if (!passwordRegex.test(password)) {
    alert("비밀번호는 8자 이상이며, 영문과 숫자를 포함해야 합니다.");
    return false
    }

    if (password !== confirmPassword) {
    alert("비밀번호가 일치하지 않습니다.");
    return false
    }

    return true
}