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

function setSendingUI(sending) {
    const send = document.getElementById('send-btn');
    const transmitting = document.getElementById('transmitting');
    if (send) {
        send.disabled = sending; //인증번호 발송 버튼 무력화
        send.style.display = sending ? 'none' : 'block'; //인증번호 버튼 없애기
        if (!sending) send.innerText = send.getAttribute('data-sent') === '1' ? '인증번호 재발송' : '인증번호 발송'; //인증번호 발송 텍스트 바꾸기
    }
    if (transmitting) transmitting.style.display = sending ? 'flex' : 'none'; //인증번호 버튼 나타나게 하기
}

async function send_number() {
    const send = document.getElementById('send-btn');
    const email = document.getElementById('email').value?.trim();
    const transmitting = document.getElementById('transmitting');
    const csrftoken = getCookie('csrftoken');

    if (!email) {
        alert("이메일을 입력해주세요!");
        return;
    }
    if (send && send.disabled) return;

    setSendingUI(true);

    try {
        const response = await fetch('/api/users/verify-email-check/', {
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
            const data = await response.json().catch(() => ({}));
            // if (data.token) sessionStorage.setItem('password_reset_token', data.token);
            const box = document.getElementById('check_number_box');
            if (box) box.style.display = 'block';
            startTimer(300);
            alert((data.message || ''));
            if (send) send.setAttribute('data-sent', '1');
        } else {
            const data = await response.json().catch(() => ({}));
            alert("발송 실패: " + (data.message || "오류가 발생했습니다."));
        }
    } catch (e) {
        console.error('인증번호 발송 오류:', e);
        alert("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
        setSendingUI(false);
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

    const response = await fetch('/api/users/verify-email-check/', {
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
        const check_box = document.getElementById('check_number_box');
        const check_box_certified = document.getElementById('check_number_box_certified');
        const complete = document.getElementById('complete');
        const next_btn = document.getElementById('next-btn');
        const send = document.getElementById('send-btn');

        if (data.token) sessionStorage.setItem('password_reset_token', data.token); //토큰을 세션 저장소에 넣기

        if (data.is_varified) {
            if (check_box) check_box.style.display = 'none';
            if (check_box_certified) check_box_certified.style.display = 'block';
            if (send) send.style.display = 'none';
            if (complete) complete.style.display = 'block';
            if (next_btn) next_btn.style.display = 'block';
            alert('메일 인증 성공! 아래 "다음" 버튼을 눌러 비밀번호를 재설정하세요.');
        }
    } else {
        const data = await response.json();
        alert("확인 실패: " + (data.message || "오류가 발생했습니다."));
    }
}

function goToChangePassword() {
    const token = sessionStorage.getItem('password_reset_token');
    if (token) {
        window.location.href = '/api/users/change_password/?token=' + encodeURIComponent(token);
    } else {
        alert('인증번호 발송부터 다시 진행해주세요.');
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