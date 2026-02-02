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

async function handleLogin() {
    const csrftoken = getCookie('csrftoken');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('이메일과 비밀번호를 입력해주세요.');
        return;
    }

    try {
        const response = await fetch('/api/users/login/submit/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('access_token', data.access);
            localStorage.setItem('refresh_token', data.refresh);
            alert('로그인 성공!');
            window.location.href = '/api/users/mypage/';
        } else {
            const msg = data.detail || data.error || JSON.stringify(data);
            alert('로그인 실패: ' + msg);
        }
    } catch (error) {
        console.error('네트워크 에러', error);
        alert('서버 통신 불가');
    }
}