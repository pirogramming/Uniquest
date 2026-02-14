/**
 * static/users/js/homepage.js
 * 
 * 🏠 홈페이지 로직
 * 
 * 백워드 호환:
 * - 새 API 형식 (created_mission, joined_mission) 지원
 * - 기존 API 형식 (missions 배열) 지원
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

            // 3. 사용자 정보 표시
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

            // 4. 미션 카운트 표시
            if (matched) matched.innerHTML = userData.matched_count || 0;
            if (waiting) waiting.innerHTML = userData.waiting_count || 0;
            if (completed) completed.innerHTML = userData.completed_count || 0;

            // 5. 미션 현황 카드 이벤트 바인딩
            addStatusClickEvents();

            // 6. 미션 목록 렌더링
            // ✨ 새 API 형식과 기존 형식 모두 지원
            if (userData.created_mission !== undefined || userData.joined_mission !== undefined) {
                // 새 API 형식 (각각 1개)
                console.log("✅ 새 API 형식 사용");
                renderCreatedMission(userData.created_mission);
                renderJoinedMission(userData.joined_mission);
            } else if (userData.missions && Array.isArray(userData.missions)) {
                // 기존 API 형식 (배열) - 백워드 호환
                console.log("⚠️ 기존 API 형식 사용 (백워드 호환)");
                const activeMissions = userData.missions.filter(m => 
                    m.status === 'WAITING' || m.status === 'MATCHED'
                );
                
                // 내가 등록한 미션 찾기
                const createdMission = activeMissions.find(m => {
                return m.is_author === true || m.author === userData.id;
                }) || null;
                renderCreatedMission(createdMission);
                
                // 내가 참여한 미션 찾기
                const joinedMission = activeMissions.find(m => {
                return m.is_author === false || (m.author !== undefined && m.author !== userData.id);
                }) || null;
                renderJoinedMission(joinedMission);
            } else {
                console.error("❌ API 응답 형식이 올바르지 않습니다.");
            }

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
                parent.onclick = () => {
                    window.location.href = `/api/users/my-missions/?tab=all&status=${item.status}`;
                };
            }
        });
    }

    // ==================== 미션 목록 렌더링 ====================
    
    /**
     * 내가 등록한 미션 렌더링 (1개)
     */
    function renderCreatedMission(mission) {
        const container = document.getElementById('created-mission-container');
        if (!container) {
            console.warn("created-mission-container를 찾을 수 없습니다.");
            return;
        }

        if (!mission) {
            container.innerHTML = '<p class="empty-message">등록한 미션이 없습니다.</p>';
            return;
        }

        // MissionRenderer 사용
        if (window.MissionRenderer) {
            MissionRenderer.renderMissions(container, [mission], {
                type: 'simple'
            });
        } else {
            console.error("MissionRenderer를 찾을 수 없습니다.");
        }
    }

    /**
     * 내가 참여한 미션 렌더링 (1개)
     */
    function renderJoinedMission(mission) {
        const container = document.getElementById('joined-mission-container');
        if (!container) {
            console.warn("joined-mission-container를 찾을 수 없습니다.");
            return;
        }

        if (!mission) {
            container.innerHTML = '<p class="empty-message">참여한 미션이 없습니다.</p>';
            return;
        }

        // MissionRenderer 사용
        if (window.MissionRenderer) {
            MissionRenderer.renderMissions(container, [mission], {
                type: 'simple'
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