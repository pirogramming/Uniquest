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
    if (!checkPassword(document.getElementById('password').value , document.getElementById('password_check').value)){
        alert('비밀번호 형식 오류')
        return
    }

    const csrftoken = getCookie('csrftoken');

    const signupData = {
        username: document.getElementById('username').value,
        nickname: document.getElementById('nickname').value,
        password: document.getElementById('password').value,
        univ_email: document.getElementById('email').value,
        password_check: document.getElementById('password_check').value,
    }

    const response = await fetch('/api/users/signup/submit/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify(signupData)
    });

    if (response.ok) {
        alert("회원가입 성공!");
        const data = await response.json();
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        window.location.href = "/api/users/homepage/"; // 가입 후 로그인 페이지로 이동
    } else {
        const errorData = await response.json();
        console.error("에러 발생:", errorData);
        alert("가입 실패: " + JSON.stringify(errorData));
    }
}

async function send_number() {
    const send = document.getElementById('send-btn')
    const email = document.getElementById('email').value
    const transmitting = document.getElementById('transmitting')
    const csrftoken = getCookie('csrftoken')

    if (!email) {
        alert("이메일을 입력해주세요!")
        return
    }

    // 전송중 버튼 띄우기
    send.style.display = 'none'
    transmitting.style.display = 'block'

    const response = await fetch('/api/users/verify-email/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify({
            email: email,
            action: 'send_email'
        })
    });

    if (response.ok) {
        const data = await response.json();
        document.getElementById('check_number_box').style.display = 'block' // 인증번호란 오픈
        startTimer(300);
        alert(data.message + data.university);
        send.style.display = 'block'
        send.innerText = '인증번호 재발송'
        transmitting.style.display = 'none'
    } else {
        const data = await response.json();
        alert("발송 실패: " + (data.message || "오류가 발생했습니다."));
    }
}

async function check_number() {
    const email = document.getElementById('email').value
    const number = document.getElementById('number').value
    const csrftoken = getCookie('csrftoken')

    if (!email) {
        alert("이메일을 입력해주세요!")
        return;
    } else if (!number) {
        alert("인증번호를 입력해주세요!")
        return;
    }

    const response = await fetch('/api/users/verify-email/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify({
            email: email,
            number: number,
            action: 'check_number'
        })
    });
    if (response.ok) {
        const data = await response.json();
        const check_box = document.getElementById('check_number_box')
        const check_box_certified = document.getElementById('check_number_box_certified')
        const complete = document.getElementById('complete')
        const send = document.getElementById('send-btn')
        if (data.is_varified) {
            check_box.style.display = 'none'
            check_box_certified.style.display = 'block'
            send.style.display = 'none'
            complete.style.display = 'block'
            alert('메일 인증 성공!')
        }

    } else {
        const data = await response.json();
        alert("확인 실패: " + (data.message || "오류가 발생했습니다."));
    }
}

let timerInterval;
function startTimer(seconds) {
    // 혹시 이미 실행 중인 타이머가 있다면 초기화
    clearInterval(timerInterval);
    const display = document.getElementById('timer-display');
    let timeLeft = seconds;

    timerInterval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;

        display.innerText = `남은 시간: ${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (--timeLeft < 0) {
            clearInterval(timerInterval);
            display.innerText = "인증 시간이 만료되었습니다. 다시 시도해주세요.";
            display.style.color = "red";
        }
    }, 1000);
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