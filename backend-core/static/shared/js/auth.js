// static/shared/js/auth.js

(function () {
  const ACCESS_KEY = "access_token";
  const REFRESH_KEY = "refresh_token";

  function getAccessToken() {
    return localStorage.getItem(ACCESS_KEY);
  }

  function getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY);
  }

  function clearTokens() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  /**
   * Authorization 헤더 자동 첨부 fetch
   * - JSON 요청 기본 세팅
   * - 토큰 없으면 null 반환(또는 redirect)
   * - 401/403이면 null 반환(또는 redirect)
   */
  async function authFetch(url, options = {}, config = {}) {
    const token = getAccessToken();

    if (!token) {
      console.warn("로그인 토큰이 없습니다.");
      if (config.onNoToken === "redirect" && config.redirectTo) {
        window.location.href = config.redirectTo;
      }
      return null;
    }

    const headers = { ...(options.headers || {}) };

    // FormData면 Content-Type을 브라우저가 자동 설정해야 하므로 건드리지 않음
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(url, { ...options, headers });

      if (!res.ok) {
        // 토큰 만료/무효(대부분 401/403)
        if (res.status === 401 || res.status === 403) {
          console.error("토큰이 만료되었거나 유효하지 않습니다.");
          if (config.onUnauthorized === "redirect" && config.redirectTo) {
            window.location.href = config.redirectTo;
          }
          return null;
        }
      }

      return res;
    } catch (err) {
      console.error("네트워크 오류 발생:", err);
      return null;
    }
  }

  /**
   * authFetch + JSON 파싱까지 한 번에
   * - 204(No Content)도 안전 처리
   */
  async function authFetchJson(url, options = {}, config = {}) {
    const res = await authFetch(url, options, config);
    if (!res) return null;

    // ok 아니면 에러 메시지 가능하면 파싱해서 던져도 되지만,
    // 지금은 기존 로직(페이지에서 null 처리) 유지 위해 null 반환
    if (!res.ok) return null;

    const text = await res.text();
    if (!text) return {}; // 204 대응
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * 페이지별로 URL만 주면 유저 정보 가져오기
   */
  async function getUserData(url, config = {}) {
    return authFetchJson(url, { method: "GET" }, config);
  }

  function logout(redirectTo = "/users/login/") {
    clearTokens();
    alert("로그아웃 되었습니다.");
    window.location.href = redirectTo;
  }

  // 전역으로 노출 (script 태그 방식)
  window.Auth = {
    getAccessToken,
    getRefreshToken,
    clearTokens,
    authFetch,
    authFetchJson,
    getUserData,
    logout,
  };
})();
