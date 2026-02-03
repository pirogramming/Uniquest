function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');

    alert("로그아웃 되었습니다.");
    window.location.href = "/users/login/"; // 로그인 페이지로 이동
}