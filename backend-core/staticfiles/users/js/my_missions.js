/**
 * static/users/js/my_missions.js
 * 
 * 📋 내 미션 전체보기 페이지
 * 
 * 역할:
 * - 내가 등록/참여한 미션 관리
 * - 필터링 및 정렬
 * - 스와이프로 채팅방 이동
 * 
 * 의존성: Auth, MissionRenderer
 */

(function () {
    let allMissions = [];
    let filteredMissions = [];
    
    // 현재 상태
    const currentState = {
        tab: 'all',              // all, created, joined
        statuses: ['WAITING', 'MATCHED'],  // 기본: 대기중 + 진행중
        categories: [],
        sort: 'latest'
    };

    // DOM 요소
    const container = document.getElementById('missions-container');

    // ==================== URL 파라미터 ====================
    
    /**
     * URL 파라미터에서 초기 필터 읽기
     * 예: /my-missions/?tab=created&status=WAITING
     */
    function loadInitialState() {
        const params = new URLSearchParams(window.location.search);
        
        if (params.has('tab')) {
            currentState.tab = params.get('tab');
        }
        
        if (params.has('status')) {
            const status = params.get('status');
            currentState.statuses = [status];
            
            // UI 업데이트
            document.querySelectorAll('input[name="status"]').forEach(input => {
                input.checked = (input.value === status);
            });
        }
    }

    // ==================== 데이터 로딩 ====================
    
    async function loadMyMissions() {
        try {
            const response = await Auth.getData('/api/users/api/my-missions/');
            
            if (response && response.results) {
                allMissions = response.results;
                updateCounts();
                applyFilters();
            }
        } catch (err) {
            console.error("미션 로드 실패:", err);
            if (container) {
                container.innerHTML = '<p class="empty-message">미션을 불러올 수 없습니다.</p>';
            }
        }
    }

    // ==================== 카운트 업데이트 ====================
    
    function updateCounts() {
        const all = allMissions.length;
        const created = allMissions.filter(m => m.is_creator).length;
        const joined = allMissions.filter(m => m.is_participant).length;
        
        const countAll = document.getElementById('count-all');
        const countCreated = document.getElementById('count-created');
        const countJoined = document.getElementById('count-joined');
        
        if (countAll) countAll.textContent = all;
        if (countCreated) countCreated.textContent = created;
        if (countJoined) countJoined.textContent = joined;
    }

    // ==================== 탭 전환 ====================
    
    function switchTab(tab) {
        currentState.tab = tab;
        
        // UI 업데이트
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        applyFilters();
    }

    // ==================== 필터링 및 정렬 ====================
    
    function applyFilters() {
        let result = [...allMissions];
        
        // 탭 필터
        const filters = {
            owner: currentState.tab === 'all' ? null : currentState.tab,
            statuses: currentState.statuses,
            categories: currentState.categories
        };
        
        result = MissionRenderer.filterMissions(result, filters);
        result = MissionRenderer.sortMissions(result, currentState.sort);
        
        filteredMissions = result;
        renderMissions();
    }

    function collectAndApplyFilters() {
        // 상태
        const statusInputs = document.querySelectorAll('input[name="status"]:checked');
        currentState.statuses = Array.from(statusInputs).map(input => input.value);
        
        // 카테고리
        const categoryInputs = document.querySelectorAll('input[name="category"]:checked');
        currentState.categories = Array.from(categoryInputs).map(input => input.value);
        
        // 정렬
        const sortInput = document.querySelector('input[name="sort"]:checked');
        if (sortInput) {
            currentState.sort = sortInput.value;
        }
        
        applyFilters();
        closeFilterPanel();
    }

    function resetFilters() {
        currentState.statuses = ['WAITING', 'MATCHED', 'COMPLETED'];
        currentState.categories = [];
        currentState.sort = 'latest';
        
        // UI 업데이트
        document.querySelectorAll('input[name="status"]').forEach(input => {
            input.checked =true;
        });
        document.querySelectorAll('input[name="category"]').forEach(input => {
            input.checked = false;
        });
        document.querySelectorAll('input[name="sort"]').forEach(input => {
            input.checked = (input.value === 'latest');
        });
        
        applyFilters();
        closeFilterPanel();
    }

    // ==================== 렌더링 ====================
    
    function renderMissions() {
        if (!container) return;
        
        if (filteredMissions.length === 0) {
            container.innerHTML = '<p class="empty-message">필터 조건에 맞는 미션이 없습니다.</p>';
            return;
        }
        
        MissionRenderer.renderMissions(container, filteredMissions, {
            type: 'default',
            showChat: true
        });
        
        // 스와이프 이벤트 등록
        initSwipeEvents();
    }

    // ==================== 스와이프 기능 ====================
    
    function initSwipeEvents() {
        const cards = document.querySelectorAll('.mission-card');
        
        cards.forEach(card => {
            let startX = 0;
            let currentX = 0;
            let isDragging = false;
            
            const content = card.querySelector('.mission-card-content');
            const chatBtn = card.querySelector('.chat-swipe');
            
            if (!content || !chatBtn) return;
            
            // 터치 시작
            card.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                isDragging = true;
            }, { passive: true });
            
            // 터치 이동
            card.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                
                currentX = e.touches[0].clientX;
                const deltaX = currentX - startX;
                
                // 왼쪽으로만 스와이프 허용
                if (deltaX < 0 && deltaX > -100) {
                    content.style.transform = `translateX(${deltaX}px)`;
                }
            }, { passive: true });
            
            // 터치 종료
            card.addEventListener('touchend', () => {
                if (!isDragging) return;
                isDragging = false;
                
                const deltaX = currentX - startX;
                
                // 50px 이상 스와이프 시 열기
                if (deltaX < -50) {
                    card.classList.add('swiping');
                    content.style.transform = 'translateX(-80px)';
                } else {
                    card.classList.remove('swiping');
                    content.style.transform = 'translateX(0)';
                }
                
                startX = 0;
                currentX = 0;
            });
            
            // 채팅 버튼 클릭
            chatBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 이벤트 버블링 방지
                
                const missionId = card.dataset.id;
                const chatRoomId = chatBtn.dataset.chatRoomId;
                
                if (chatRoomId) {
                    window.location.href = `/api/chat/room/${chatRoomId}/`;
                } else {
                    alert('채팅방이 아직 생성되지 않았습니다.');
                }
            });
        });
        
        // 카드 외부 클릭 시 닫기
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.mission-card')) {
                document.querySelectorAll('.mission-card').forEach(card => {
                    card.classList.remove('swiping');
                    const content = card.querySelector('.mission-card-content');
                    if (content) content.style.transform = 'translateX(0)';
                });
            }
        });
    }

    // ==================== 필터 패널 ====================
    
    function openFilterPanel() {
        const backdrop = document.getElementById('filter-backdrop');
        const panel = document.getElementById('filter-panel');
        const filterBtn = document.querySelector('.filter-btn');
        
        if (backdrop) {
            backdrop.style.display = 'block';
            setTimeout(() => backdrop.classList.add('show'), 10);
        }
        if (panel) {
            panel.style.display = 'block';
            setTimeout(() => panel.classList.add('open'), 10);
        }
        if (filterBtn) filterBtn.classList.add('active');
        
        if (backdrop) {
            backdrop.onclick = closeFilterPanel;
        }
    }

    function closeFilterPanel() {
        const backdrop = document.getElementById('filter-backdrop');
        const panel = document.getElementById('filter-panel');
        const filterBtn = document.querySelector('.filter-btn');
        
        if (backdrop) {
            backdrop.classList.remove('show');
            setTimeout(() => backdrop.style.display = 'none', 300);
        }
        if (panel) {
            panel.classList.remove('open');
            setTimeout(() => panel.style.display = 'none', 300);
        }
        if (filterBtn) filterBtn.classList.remove('active');
    }

    // ==================== 초기화 ====================
    
    async function init() {
        // URL 파라미터 로드
        loadInitialState();
        
        // 탭 UI 초기화
        switchTab(currentState.tab);
        
        // 미션 로드
        await loadMyMissions();
        
        console.log("✅ my_missions.js 초기화 완료");
    }

    // ==================== 전역 함수 노출 ====================
    
    window.switchTab = switchTab;
    window.openFilterPanel = openFilterPanel;
    window.closeFilterPanel = closeFilterPanel;
    window.applyFilters = collectAndApplyFilters;
    window.resetFilters = resetFilters;

    document.addEventListener("DOMContentLoaded", init);
})();