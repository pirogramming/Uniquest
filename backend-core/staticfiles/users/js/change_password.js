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

function getResetToken() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
}

document.addEventListener('DOMContentLoaded', function() {
    if (!getResetToken()) {
        alert('유효한 링크가 아닙니다. 비밀번호 찾기부터 진행해주세요.');
        window.location.href = '/api/users/check_password/';
    }
});

async function handleSignup() {
    if (!checkPassword(document.getElementById('password').value, document.getElementById('password_check').value)) {
        return;
    }

    const token = getResetToken();
    if (!token) {
        alert('유효한 링크가 아닙니다. 비밀번호 찾기부터 다시 진행해주세요.');
        window.location.href = '/api/users/check_password/';
        return;
    }

    const csrftoken = getCookie('csrftoken');
    const changeData = {
        token: token,
        password: document.getElementById('password').value,
    };

    const response = await fetch('/api/users/change_password/info/', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify(changeData)
    });

    if (response.ok) {
        alert("비밀번호 변경 성공!");
        window.location.href = "/api/users/login/";
    } else {
        const errorData = await response.json();
        console.error("에러 발생:", errorData);
        alert("변경 실패: " + (errorData.error || JSON.stringify(errorData)));
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