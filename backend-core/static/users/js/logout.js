function logout() {
    // 저장할 때 썼던 키 이름을 그대로 입력해야 합니다.
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');

    alert("로그아웃 되었습니다.");
    window.location.href = "/users/login/"; // 로그인 페이지로 이동
}