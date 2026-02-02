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

async function handleSignup(){
    if(document.getElementById('password').value !== document.getElementById('password_check').value){
        document.getElementById('password_check').value = "";
        document.getElementById('password_check').focus();
        alert('비밀번호 불일치')
        return
    }

    const csrftoken = getCookie('csrftoken');

    const signupData = {
        username:document.getElementById('username').value,
        nickname:document.getElementById('nickname').value,
        password:document.getElementById('password').value,
        univ_email:document.getElementById('email').value,
        password_check:document.getElementById('password_check').value,
    }

    const response = await fetch('/api/users/signup/submit/', {
        method:'POST',
        headers:{
            'Content-Type' : 'application/json',
            'X-CSRFToken': csrftoken
        },
        body:JSON.stringify(signupData)
    });

    if (response.ok) {
        alert("회원가입 성공!");
        const data = await response.json();
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        window.location.href = "/login-page/"; // 가입 후 로그인 페이지로 이동
    } else {
        const errorData = await response.json();
        console.error("에러 발생:", errorData);
        alert("가입 실패: " + JSON.stringify(errorData));
}
}

async function send_number(){
    const email = document.getElementById('email').value
    const csrftoken = getCookie('csrftoken')

    if(!email){
        alert("이메일을 입력해주세요!")
        return
    }

    const response = await fetch('/api/users/verify-email/',{
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            'X-CSRFToken':csrftoken
        },
        body: JSON.stringify({
            email:email,
            action:'send_email'
        })
    });

    if (response.ok){
        const data = await response.json();
        document.getElementById('check_number_box').style.display = 'block'
        alert(data.message + data.university);
    } else{
        const data = await response.json();
        alert("발송 실패: " + (data.message || "오류가 발생했습니다."));
    }
}

async function check_number(){
    const email = document.getElementById('email').value
    const number = document.getElementById('number').value
    const csrftoken = getCookie('csrftoken')

    if(!email){
        alert("이메일을 입력해주세요!")
        return;
    } else if(!number){
        alert("인증번호를 입력해주세요!")
        return;
    }

    const response = await fetch('/api/users/verify-email/',{
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            'X-CSRFToken':csrftoken
        },
        body: JSON.stringify({
            email:email,
            number:number,
            action:'check_number'
        })
    });
    if (response.ok){
        const data = await response.json();
        if (data.is_varified){
            alert('메일 인증 성공!')
        }
    } else{
        const data = await response.json();
        alert("확인 실패: " + (data.message || "오류가 발생했습니다."));
    }
}