(function () {
  const ACCESS_KEY = "access_token";
  const REFRESH_KEY = "refresh_token";

  const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
  const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

  function clearTokens() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  /**
   * 전역 설정 기본값
   */
  const DEFAULT_CONFIG = {
    onNoToken: "redirect",        // 토큰 없을 때: 'redirect' 또는 'ignore'
    onUnauthorized: "redirect",   // 401/403일 때: 'redirect' 또는 'ignore'
    redirectTo: "/api/users/login/",  // 이동할 페이지
  };

  /**
   * Authorization 헤더 자동 첨부 fetch
   */
  async function authFetch(url, options = {}, customConfig = {}) {
    const config = { ...DEFAULT_CONFIG, ...customConfig };
    const token = getAccessToken();

    // 1. 토큰 체크
    if (!token) {
      if (config.onNoToken === "redirect") {
        console.warn("인증 토큰이 없어 로그인 페이지로 이동합니다.");
        window.location.href = config.redirectTo;
      }
      return null;
    }

    // 2. 헤더 설정
    const headers = { 
      ...(options.headers || {}),
      "Authorization": `Bearer ${token}`
    };

    // FormData가 아닐 때만 기본 JSON 헤더 추가
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    try {
      const res = await fetch(url, { ...options, headers });

      // 3. 응답 상태 처리
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          console.error("인증 실패(401/403).");
          
          // [추후 확장 포인트]: 여기서 Refresh Token으로 새로운 Access Token을 요청하는 로직을 넣으면 더 좋습니다.
          
          if (config.onUnauthorized === "redirect") {
            clearTokens(); // 유효하지 않은 토큰 삭제
            window.location.href = config.redirectTo;
          }
          return null;
        }
        // 400, 500번대 에러 등은 호출한 곳에서 처리할 수 있게 res 자체를 반환
      }

      return res;
    } catch (err) {
      console.error("네트워크 에러:", err);
      return null;
    }
  }

  /**
   * JSON 전용 fetch (authFetch + 파싱)
   */
  async function authFetchJson(url, options = {}, config = {}) {
    const res = await authFetch(url, options, config);
    if (!res || !res.ok) return null;

    const text = await res.text();
    if (!text) return {}; // 204 No Content 대응

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("JSON 파싱 에러:", e);
      return null;
    }
  }

  /**
   * 유저 데이터 가져오기 (GET)
   */
  async function getUserData(apiUrl, config = {}) {
    return authFetchJson(apiUrl, { method: "GET" }, config);
  }

  /**
   * 미션 생성/수정 등 POST/PATCH 전용 함수 추가 (편의성)
   */
  async function postData(apiUrl, body, isFormData = false, config = {}) {
    const options = {
      method: "POST",
      body: isFormData ? body : JSON.stringify(body),
    };
    return authFetchJson(apiUrl, options, config);
  }

  function logout(redirectTo = "/users/login/") {
    clearTokens();
    window.location.href = redirectTo;
  }

  // 전역 노출
  window.Auth = {
    getAccessToken,
    getRefreshToken,
    clearTokens,
    authFetch,
    authFetchJson,
    getUserData,
    postData,
    logout,
  };
})();