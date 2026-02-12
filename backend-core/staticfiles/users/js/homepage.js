/**
 * static/users/js/homepage.js
 * 
 * 🏠 홈페이지 로직
 * 
 * 역할:
 * - 사용자 정보 표시
 * - 미션 현황 카드
 * - 진행중인 미션 목록
 * 
 * 의존성: Auth, MissionRenderer
 */

(function () {
    // ==================== 데이터 로딩 ====================
    
    async function loadHomepageData() {
        const token = Auth.getAccessToken();

        if (!token) {
            window.location.href = '/api/users/homepage_guest/';
            return;
        }

<<<<<<< HEAD
        try {
            const userData = await Auth.getData('/api/users/api/homepage');
=======
        console.log("유저 데이터",userData);

        if (userData && userData.id) {
            const usernameElement = document.getElementById('username');
            const missionElement = document.getElementById('mission_cards');
            const matched = document.getElementById('matched');
            const waiting = document.getElementById('waiting');
            const completed = document.getElementById('completed');
            const imgEl = document.getElementById('userprofile');
>>>>>>> de7b78e8ca7c6e03333ff328a86ff5d72bcbf30f

            if (!userData || !userData.id) {
                throw new Error('사용자 데이터를 불러올 수 없습니다.');
            }
<<<<<<< HEAD

            // 사용자 이름 표시
            const usernameEl = document.getElementById('username');
            if (usernameEl) {
                usernameEl.textContent = userData.username;
=======
            if (matched && waiting && completed) {
                matched.innerHTML = userData.matched_count
                waiting.innerHTML = userData.waiting_count
                completed.innerHTML = userData.completed_count
                if (imgEl) {
                    if (userData.userphoto) {
                        imgEl.src = userData.userphoto;   // 백엔드에서 준 URL 그대로
                    } else {
                        imgEl.src = '/static/users/images/profile.png';  // 기본 이미지 (경로는 프로젝트에 맞게)
                    }
                }
>>>>>>> de7b78e8ca7c6e03333ff328a86ff5d72bcbf30f
            }

            // 미션 현황 카드
            updateMissionStatus(userData);

            // 진행중인 미션 목록
            renderMissions(userData.missions || []);

            console.log("환영합니다, " + userData.username + "님!");
        } catch (error) {
            console.error("홈페이지 데이터 로드 실패:", error);
            
            // 인증 실패 시 로그인 페이지로
            if (error.message.includes('401') || error.message.includes('403')) {
                Auth.logout('/api/users/login/');
            }
        }
    }

    // ==================== 미션 현황 카드 ====================
    
    function updateMissionStatus(userData) {
        const matched = document.getElementById('matched');
        const waiting = document.getElementById('waiting');
        const completed = document.getElementById('completed');

        if (matched) matched.textContent = userData.matched_count || 0;
        if (waiting) waiting.textContent = userData.waiting_count || 0;
        if (completed) completed.textContent = userData.completed_count || 0;

        // 클릭 이벤트 추가
        addStatusClickEvents();
    }

    /**
     * 상태 카드 클릭 시 전체보기로 이동
     */
    function addStatusClickEvents() {
        const waiting = document.getElementById('waiting');
        const matched = document.getElementById('matched');
        const completed = document.getElementById('completed');

        if (waiting) {
            waiting.parentElement.style.cursor = 'pointer';
            waiting.parentElement.addEventListener('click', () => {
                window.location.href = '/api/users/my-missions/?tab=all&status=WAITING';
            });
        }

        if (matched) {
            matched.parentElement.style.cursor = 'pointer';
            matched.parentElement.addEventListener('click', () => {
                window.location.href = '/api/users/my-missions/?tab=all&status=MATCHED';
            });
        }

        if (completed) {
            completed.parentElement.style.cursor = 'pointer';
            completed.parentElement.addEventListener('click', () => {
                window.location.href = '/api/users/my-missions/?tab=all&status=COMPLETED';
            });
        }
    }

    // ==================== 미션 목록 렌더링 ====================
    
    function renderMissions(missions) {
        const container = document.getElementById('mission_cards');
        if (!container) return;

        // 진행중인 미션만 필터링 (대기중 + 진행중)
        const activeMissions = missions.filter(m => 
            m.status === 'WAITING' || m.status === 'MATCHED'
        );

        if (activeMissions.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#98A2B3; padding:20px;">진행중인 미션이 없습니다.</p>';
            return;
        }

        // MissionRenderer 사용
        MissionRenderer.renderMissions(container, activeMissions, {
            type: 'simple',
            emptyMessage: '진행중인 미션이 없습니다.'
        });
    }

    // ==================== 초기화 ====================
    
    function init() {
        loadHomepageData();
        console.log("✅ homepage.js 초기화 완료");
    }

    window.addEventListener('DOMContentLoaded', init);
})();