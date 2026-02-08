/**
 * static/shared/js/auth.js
 * 
 * 🔐 JWT 인증 통합 모듈
 * 
 * 기능:
 * - 토큰 저장/조회/삭제
 * - 자동 토큰 갱신 (401 응답 시)
 * - Authorization 헤더 자동 추가
 * - 인증 필요한 API 요청 래퍼 함수들
 * 
 * 사용처: users/, missions/ 등 모든 앱에서 공통 사용
 */

(function () {
    // ==================== 상수 ====================
    const ACCESS_KEY = "access_token";
    const REFRESH_KEY = "refresh_token";

    // ==================== 토큰 관리 ====================
    
    const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
    const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

    function setTokens(access, refresh) {
        if (access) localStorage.setItem(ACCESS_KEY, access);
        if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    }

    function clearTokens() {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
    }

    // ==================== 설정 ====================
    
    const DEFAULT_CONFIG = {
        onNoToken: "redirect",        // 토큰 없을 때: 'redirect' | 'ignore'
        onUnauthorized: "redirect",   // 401/403일 때: 'redirect' | 'ignore'
        redirectTo: "/api/users/login/",
        autoRefresh: true,            // 자동 토큰 갱신 활성화
    };

    // ==================== 토큰 갱신 ====================
    
    /**
     * Access Token 재발급
     * @returns {string|null} 새로운 access token 또는 null
     */
    async function refreshAccessToken() {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            console.warn("Refresh 토큰이 없습니다.");
            return null;
        }

        try {
            const response = await fetch('/api/users/token/refresh/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh: refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                const newAccess = data.access;
                
                localStorage.setItem(ACCESS_KEY, newAccess);
                console.log("✅ Access 토큰 재발급 성공");
                
                return newAccess;
            } else {
                console.error("토큰 재발급 실패:", response.status);
                return null;
            }
        } catch (err) {
            console.error("토큰 재발급 네트워크 에러:", err);
            return null;
        }
    }

    // ==================== 인증 fetch 래퍼 ====================
    
    /**
     * Authorization 헤더가 자동으로 포함된 fetch
     * 401 응답 시 자동으로 토큰 갱신 후 재시도
     * 
     * @param {string} url 
     * @param {object} options fetch options
     * @param {object} customConfig 커스텀 설정
     * @returns {Response|null}
     */
    async function authFetch(url, options = {}, customConfig = {}) {
        const config = { ...DEFAULT_CONFIG, ...customConfig };
        let token = getAccessToken();

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
            // 3. 첫 번째 요청
            let response = await fetch(url, { ...options, headers });

            // 4. 401 응답 시 토큰 갱신 후 재시도
            if (response.status === 401 && config.autoRefresh) {
                console.log("Access 토큰 만료됨. 재발급 시도 중...");
                
                const newToken = await refreshAccessToken();
                
                if (newToken) {
                    // 새 토큰으로 재시도
                    headers["Authorization"] = `Bearer ${newToken}`;
                    response = await fetch(url, { ...options, headers });
                    
                    if (response.ok) {
                        console.log("✅ 토큰 갱신 후 요청 성공");
                        return response;
                    }
                }
                
                // 갱신 실패 또는 여전히 401
                if (config.onUnauthorized === "redirect") {
                    console.warn("인증 실패. 로그인 페이지로 이동합니다.");
                    clearTokens();
                    window.location.href = config.redirectTo;
                }
                return null;
            }

            // 5. 403 또는 기타 인증 오류
            if (response.status === 403 && config.onUnauthorized === "redirect") {
                console.error("권한 없음(403).");
                clearTokens();
                window.location.href = config.redirectTo;
                return null;
            }

            return response;
            
        } catch (err) {
            console.error("네트워크 에러:", err);
            return null;
        }
    }

    /**
     * JSON 응답 전용 fetch
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

    // ==================== 편의 메서드 ====================
    
    /**
     * GET 요청
     */
    async function getData(apiUrl, config = {}) {
        return authFetchJson(apiUrl, { method: "GET" }, config);
    }

    /**
     * POST 요청 (JSON 또는 FormData)
     */
    async function postData(apiUrl, body, isFormData = false, config = {}) {
        const options = {
            method: "POST",
            body: isFormData ? body : JSON.stringify(body),
        };
        return authFetchJson(apiUrl, options, config);
    }

    /**
     * PATCH 요청
     */
    async function patchData(apiUrl, body, isFormData = false, config = {}) {
        const options = {
            method: "PATCH",
            body: isFormData ? body : JSON.stringify(body),
        };
        return authFetchJson(apiUrl, options, config);
    }

    /**
     * DELETE 요청
     */
    async function deleteData(apiUrl, config = {}) {
        return authFetchJson(apiUrl, { method: "DELETE" }, config);
    }

    /**
     * 로그아웃
     */
    function logout(redirectTo = "/api/users/login/") {
        clearTokens();
        window.location.href = redirectTo;
    }

    /**
     * 로그인 여부 확인
     */
    function isAuthenticated() {
        return !!getAccessToken();
    }

    // ==================== 전역 노출 ====================
    
    window.Auth = {
        // 토큰 관리
        getAccessToken,
        getRefreshToken,
        setTokens,
        clearTokens,
        refreshAccessToken,
        
        // 인증 fetch
        authFetch,
        authFetchJson,
        
        // 편의 메서드
        getData,
        postData,
        patchData,
        deleteData,
        
        // 유틸리티
        logout,
        isAuthenticated,
    };

    console.log("✅ Auth 모듈 로드 완료");
})();