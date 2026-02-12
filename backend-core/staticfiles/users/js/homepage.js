/**
 * static/users/js/homepage.js
 * * 🏠 홈페이지 로직
 * * 수정 사항:
 * - 중괄호({}) 불일치 해결
 * - 중복 선언(usernameEl) 정리
 * - 조건문 흐름 최적화 (데이터 유무 확인 후 실행)
 */

(function () {
    // ==================== 데이터 로딩 ====================
    
    async function loadHomepageData() {
        const token = Auth.getAccessToken();

        if (!token) {
            window.location.href = '/api/users/homepage_guest/';
            return;
        }

        try {
            const userData = await Auth.getData('/api/users/api/homepage');
            console.log("유저 데이터", userData);

            // 1. 데이터 유효성 검사
            if (!userData || !userData.id) {
                throw new Error('사용자 데이터를 불러올 수 없습니다.');
            }

            // 2. DOM 요소 가져오기
            const usernameEl = document.getElementById('username');
            const imgEl = document.getElementById('userprofile');
            const matched = document.getElementById('matched');
            const waiting = document.getElementById('waiting');
            const completed = document.getElementById('completed');

            // 3. 사용자 정보 표시 (이름 및 프로필 사진)
            if (usernameEl) {
                usernameEl.textContent = userData.username;
            }

            if (imgEl) {
                if (userData.userphoto) {
                    imgEl.src = userData.userphoto;
                } else {
                    imgEl.src = '/static/users/images/profile.png';
                }
            }

            // 4. 미션 카운트 표시 (상단 숫자)
            if (matched) matched.innerHTML = userData.matched_count || 0;
            if (waiting) waiting.innerHTML = userData.waiting_count || 0;
            if (completed) completed.innerHTML = userData.completed_count || 0;

            // 5. 미션 현황 카드 이벤트 바인딩 (함수 내부에서 처리)
            updateMissionStatus(userData);

            // 6. 진행중인 미션 목록 하단 렌더링
            renderMissions(userData.missions || []);

            console.log("환영합니다, " + userData.username + "님!");

        } catch (error) {
            console.error("홈페이지 데이터 로드 실패:", error);
            
            // 인증 실패 시 로그인 페이지로
            if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
                if (typeof Auth.logout === 'function') {
                    Auth.logout('/api/users/login/');
                } else {
                    window.location.href = '/api/users/login/';
                }
            }
        }
    }

    // ==================== 미션 현황 카드 ====================
    
    function updateMissionStatus(userData) {
        // 클릭 이벤트 추가 (기능 유지)
        addStatusClickEvents();
    }

    /**
     * 상태 카드 클릭 시 전체보기로 이동
     */
    function addStatusClickEvents() {
        const waiting = document.getElementById('waiting');
        const matched = document.getElementById('matched');
        const completed = document.getElementById('completed');

        const statusConfig = [
            { el: waiting, status: 'WAITING' },
            { el: matched, status: 'MATCHED' },
            { el: completed, status: 'COMPLETED' }
        ];

        statusConfig.forEach(item => {
            if (item.el && item.el.parentElement) {
                const parent = item.el.parentElement;
                parent.style.cursor = 'pointer';
                // 기존 이벤트 제거 후 등록을 위해 복제하거나 단순 등록
                parent.onclick = () => {
                    window.location.href = `/api/users/my-missions/?tab=all&status=${item.status}`;
                };
            }
        });
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
        if (window.MissionRenderer) {
            MissionRenderer.renderMissions(container, activeMissions, {
                type: 'simple',
                emptyMessage: '진행중인 미션이 없습니다.'
            });
        } else {
            console.error("MissionRenderer를 찾을 수 없습니다.");
        }
    }

    // ==================== 초기화 ====================
    
    function init() {
        loadHomepageData();
        console.log("✅ homepage.js 초기화 완료");
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();