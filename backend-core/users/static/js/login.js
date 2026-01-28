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
    const csrftoken = getCookie('csrftoken');

    const email = document.getElementById('email').value
    const password = document.getElementById('password').value

    try {
        const response = await fetch('/users/login_logic/',{
            method:"POST",
            headers:{
                'Content-Type': 'application/json',
                'X-CSRFToken':csrftoken
            },
            body:JSON.stringify({
                email:email,
                password:password
            })
        })

        if (response.ok) {
            const data = await response.json();
            // 💡 핵심: 브라우저 금고(LocalStorage)에 토큰 보관
            localStorage.setItem('access_token', data.access);
            localStorage.setItem('refresh_token', data.refresh);
            console.log(data)
            alert("로그인 성공 야호!");
        } else {
            const errorData = await response.json();
            console.error("에러 발생:", errorData);
            alert("가입 실패: " + JSON.stringify(errorData));
        }
    } catch(error){
        console.error('네트워크 에러',error)
        alert('서버 통신 불가')
    }
}