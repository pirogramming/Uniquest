// static/js/auth_helper.js

// 1. 브라우저의 원래 fetch를 따로 보관해둡니다.
const originalFetch = window.fetch;

// 2. window.fetch를 새로운 기능으로 덮어씌웁니다.
window.fetch = async (...args) => {
    let [resource, config] = args;

    // config가 없으면 빈 객체로 생성
    if (!config) config = {};
    if (!config.headers) config.headers = {};

    // 3. 요청 전에 localStorage에서 access 토큰을 꺼내 헤더에 주입
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // 4. 원래의 fetch 실행
    let response = await originalFetch(resource, config);

    // 5. 서버 응답이 401(만료)인 경우 가로채기
    if (response.status === 401) {
        const refreshToken = localStorage.getItem('refresh_token');

        if (refreshToken) {
            console.log("Access 토큰 만료됨. 재발급 시도 중...");

            // 6. 재발급 API 호출 (무한루프 방지를 위해 보관해둔 originalFetch 사용)
            const refreshRes = await originalFetch('/api/users/token/refresh/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh: refreshToken })
            });

            if (refreshRes.ok) {
                const data = await refreshRes.json();
                const newAccess = data.access;

                // 7. 새 토큰 저장
                localStorage.setItem('access_token', newAccess);
                console.log("토큰 재발급 성공!");

                // 8. 새 토큰으로 헤더를 교체해서 원래 요청을 딱 한 번 더 시도
                config.headers['Authorization'] = `Bearer ${newAccess}`;
                return await originalFetch(resource, config);
            }
        }

        // 9. 리프레시 토큰도 없거나 재발급에 실패했다면? 로그아웃 처리
        console.warn("리프레시 토큰 만료 또는 없음. 로그인이 필요합니다.");
        // localStorage.clear();
        // window.location.href = "/users/login/";
    }

    return response;
};