/**
 * static/missions/js/mission_list.js
 * 
 * 📋 미션 목록 페이지 로직
 * 
 * 역할:
 * - 미션 목록 DOM 렌더링
 * - SSE 실시간 업데이트 처리
 * - 지도 및 마커 통합 관리
 * - 필터링 및 정렬
 * - 뷰 전환 (지도+리스트 / 리스트만)
 * - 전체화면 지도
 * - 마커 클릭 이벤트 처리 ✨
 * 
 * 의존성: Auth, MissionRenderer, KakaoMapManager
 */

(function () {
    let mapManager;
    let fullscreenMapManager;
    let eventSource = null;
    let allMissions = [];
    let filteredMissions = [];
    let userLocation = null;
    
    const API_LIST_URL = '/api/missions/api/list/';
    const SSE_URL = '/stream/missions/stream';

    // 현재 필터 상태
    const currentFilters = {
        sort: 'latest',           // latest, distance, reward, deadline
        categories: [],            // ERRAND, STUDY, etc.
        statuses: ['WAITING'],     // WAITING, MATCHED
        view: 'both'              // both, list
    };

    // ==================== 필터링 및 정렬 ====================
    
    function applyFilters() {
        let result = [...allMissions];
        const selectedCategory = document.querySelector('.category-chip.active'); // 필터 패널 내 선택된 칩
        const filterBtn = document.querySelector('.filter-btn');

        if (selectedCategory && selectedCategory.dataset.value !== 'all') {
            // '전체'가 아닌 특정 카테고리가 선택된 경우
            filterBtn.classList.add('active'); 
        } else {
            filterBtn.classList.remove('active');
        }
        // MissionRenderer 사용
        result = MissionRenderer.filterMissions(result, {
            categories: currentFilters.categories,
            statuses: currentFilters.statuses
        });
        
        result = MissionRenderer.sortMissions(result, currentFilters.sort, userLocation);

        filteredMissions = result;
        renderMissionList(filteredMissions);
        updateFullscreenMapMarkers(filteredMissions);
        updateMapMarkers(filteredMissions);
    }

    function resetFilters() {
        currentFilters.sort = 'latest';
        currentFilters.categories = [];
        currentFilters.statuses = ['WAITING'];

        // UI 업데이트
        document.querySelectorAll('input[name="sort"]').forEach(input => {
            input.checked = (input.value === 'latest');
        });
        document.querySelectorAll('input[name="category"]').forEach(input => {
            input.checked = false;
        });
        document.querySelectorAll('input[name="status"]').forEach(input => {
            input.checked = (input.value === 'WAITING');
        });

        applyFilters();
        closeFilterPanel();
    }

    function collectAndApplyFilters() {
        // 정렬
        const sortInput = document.querySelector('input[name="sort"]:checked');
        if (sortInput) {
            currentFilters.sort = sortInput.value;
        }

        // 카테고리
        const categoryInputs = document.querySelectorAll('input[name="category"]:checked');
        currentFilters.categories = Array.from(categoryInputs).map(input => input.value);

        // 상태
        const statusInput = document.querySelector('input[name="status"]:checked');
        if (statusInput) {
            currentFilters.statuses = [statusInput.value];  // 배열에 하나만 담김
        }

        applyFilters();
        closeFilterPanel();
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

    // ==================== 뷰 전환 ====================
    
    function switchView(viewType) {
        currentFilters.view = viewType;
        
        const mapEl = document.getElementById('map');
        const mapWrapper = document.querySelector('.map-wrapper');  // ✅ 추가
        const mapControls = document.querySelector('.map-controls');  // ✅ 추가
        const viewBtns = document.querySelectorAll('.view-btn');

        viewBtns.forEach(btn => {
            if (btn.dataset.view === viewType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (viewType === 'list') {
            // 리스트 뷰: 지도 숨김, 버튼들 숨김
            if (mapWrapper) mapWrapper.style.display = 'none';
        } else {
            // 지도+리스트 뷰: 지도 보임, 버튼들 보임
            if (mapWrapper) mapWrapper.style.display = 'block';  // ✅ map-wrapper 표시
        }
    }

    // ==================== 전체화면 지도 ====================
    
    async function openFullscreenMap() {
        const container = document.getElementById('fullscreen-map-container');
        const backBtn = document.getElementById('back-to-list-btn');
        const contentContainer = document.querySelector('.content-container');

        
        if (!container) return;

        container.style.display = 'block';
        if (backBtn) backBtn.style.display = 'flex';
        if (contentContainer) contentContainer.style.display = 'none';

        if (!fullscreenMapManager) {
            try {
                fullscreenMapManager = new KakaoMapManager('fullscreen-map', {
                    center: userLocation || { lat: 37.5665, lng: 126.9780 },
                    level: 3
                });
                
                await fullscreenMapManager.init();
                
                if (userLocation) {
                    await MapUtils.displayUserLocation(fullscreenMapManager);
                }
                updateFullscreenMapMarkers(filteredMissions);
            } catch (err) {
                console.error("전체화면 지도 초기화 실패:", err);
            }
        } 
        updateFullscreenMapMarkers(filteredMissions);
        // 처음 열릴 때만 마커들에 맞춰 지도 범위 조정 (선택 사항)
        const validLocations = filteredMissions.map(m => ({
            lat: parseFloat(m.location_lat),
            lng: parseFloat(m.location_lng)
        })).filter(loc => !isNaN(loc.lat));

        if (validLocations.length > 0) {
            fullscreenMapManager.fitBoundsToLocations(validLocations);
        }
    }

    function closeFullscreenMap() {
        const container = document.getElementById('fullscreen-map-container');
        const backBtn = document.getElementById('back-to-list-btn');
        const contentContainer = document.querySelector('.content-container');

        if (container) container.style.display = 'none';
        if (backBtn) backBtn.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'block';
    }

    function updateFullscreenMapMarkers(missions) {
        if (!fullscreenMapManager || !fullscreenMapManager.map) return;

        fullscreenMapManager.clearMarkers();

        const validLocations = [];

        missions.forEach(mission => {
            const lat = parseFloat(mission.location_lat);
            const lng = parseFloat(mission.location_lng);

            if (isNaN(lat) || isNaN(lng)) return;

            // ✨ category 전달 → 카테고리별 색상 자동 적용
            fullscreenMapManager.addCustomMarker(lat, lng, {
                category: mission.category,
                status: mission.status,
                onClick: () => {
                    window.location.href = `/api/missions/${mission.id}/`;
                }
            });

            validLocations.push({ lat, lng });
        });

        if (validLocations.length > 0) {
            fullscreenMapManager.fitBoundsToLocations(validLocations);
        }
    }

    // ==================== 미션 목록 로딩 ====================
    
    async function loadMissions() {
        try {
            const response = await Auth.getData(API_LIST_URL);
            if (response && response.results) {
                allMissions = response.results;
                applyFilters();
            }
        } catch (err) {
            console.error("미션 목록 로드 실패:", err);
        }
    }

    // ==================== DOM 렌더링 (MissionRenderer 사용) ====================
    
    function renderMissionList(missions) {
        const container = document.getElementById('mission-list-container');
        if (!container) return;
        
        if (missions.length === 0) {
            container.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">필터 조건에 맞는 미션이 없습니다.</p>';
            return;
        }

        // ✨ MissionRenderer 사용
        MissionRenderer.renderMissions(container, missions, {
            type: 'default',
            showDistance: (currentFilters.sort === 'distance'),
            userLocation: userLocation
        });
    }

    // ==================== 지도 마커 업데이트 ====================
    
    /**
     * 지도 마커 업데이트
     * - map_manager: 마커 생성/표시 (카테고리별 색상 적용)
     * - mission_list: 클릭 시 상세페이지 이동
     */
    function updateMapMarkers(missions) {
        if (!mapManager || !mapManager.map) return;

        mapManager.clearMarkers();

        const validLocations = [];

        missions.forEach(mission => {
            const lat = parseFloat(mission.location_lat);
            const lng = parseFloat(mission.location_lng);

            if (isNaN(lat) || isNaN(lng)) {
                console.warn(`좌표 누락된 미션 (ID: ${mission.id})`);
                return;
            }

            // ✨ category 전달 → 카테고리별 색상 자동 적용
            mapManager.addCustomMarker(lat, lng, {
                category: mission.category,
                status: mission.status,
                onClick: () => {
                    window.location.href = `/api/missions/${mission.id}/`;
                }
            });

            validLocations.push({ lat, lng });
        });

        if (validLocations.length > 0) {
            mapManager.fitBoundsToLocations(validLocations);
        }
    }

    // ==================== SSE 실시간 업데이트 ====================
    
    function addMissionToDOM(missionData) {
        allMissions.unshift(missionData);
        applyFilters();
    }

    function updateMissionInDOM(missionData) {
        const index = allMissions.findIndex(m => m.id === missionData.id);
        if (index !== -1) {
            allMissions[index] = missionData;
        }
        applyFilters();
    }

    function removeMissionFromDOM(missionId) {
        allMissions = allMissions.filter(m => m.id !== missionId);
        applyFilters();
    }

    function connectSSE() {
        const token = Auth.getAccessToken();
        if (!token) {
            console.warn('토큰이 없어 SSE 연결을 건너뜁니다.');
            return;
        }

        try {
            eventSource = new EventSource(`${SSE_URL}?token=${token}`);

            eventSource.onopen = () => {
                console.log('✅ SSE 연결 성공');
            };

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 SSE 수신:', data);

                    switch (data.action) {
                        case 'CREATE':
                            addMissionToDOM(data.data);
                            break;
                        case 'UPDATE':
                            updateMissionInDOM(data.data);
                            break;
                        case 'DELETE':
                            removeMissionFromDOM(data.mission_id);
                            break;
                        case 'CONNECTED':
                            console.log('SSE 연결 확인');
                            break;
                    }
                } catch (err) {
                    console.error('SSE 메시지 파싱 오류:', err);
                }
            };

            eventSource.onerror = (error) => {
                console.error('❌ SSE 오류:', error);
                eventSource.close();
                
                setTimeout(() => {
                    console.log('🔄 SSE 재연결 시도...');
                    connectSSE();
                }, 3000);
            };
        } catch (err) {
            console.error('❌ EventSource 생성 실패:', err);
        }
    }

    // ==================== 초기화 ====================
    
    async function init() {
        const container = document.getElementById('map');
        if (!container) return;

        try {
            mapManager = new KakaoMapManager('map', {
                center: { lat: 37.5665, lng: 126.9780 },
                level: 3
            });
            
            await mapManager.init();
            console.log("✅ 카카오 지도 로드 완료");

            try {
                const location = await mapManager.getUserLocation();
                userLocation = location;
                console.log("✅ 사용자 위치:", userLocation);
                await MapUtils.displayUserLocation(mapManager);
            } catch (err) {
                console.warn("사용자 위치 표시 실패:", err);
            }

            await loadMissions();
            connectSSE();
            
        } catch (err) {
            console.error("초기화 실패:", err);
        }
    }

    window.moveToCurrentLocation = async function(isFullscreen = false) {
        const targetManager = isFullscreen ? fullscreenMapManager : mapManager;
        
        if (!targetManager) return;
        
        console.log(isFullscreen ? "전체화면 현위치 탐색..." : "일반 지도 현위치 탐색...");
        
        try {
            // KakaoMapManager 내부의 getUserLocation 활용
            const loc = await targetManager.getUserLocation();
            
            // 해당 지도의 중심 이동
            targetManager.setCenter(loc.lat, loc.lng);
            targetManager.setLevel(3);
            
            // 내 위치 마커 표시 (MapUtils 활용)
            await MapUtils.displayUserLocation(targetManager);
            
        } catch (err) {
            console.error("현위치 이동 실패:", err);
            alert("위치 정보를 가져올 수 없습니다.");
        }
    };

    // ==================== 전역 함수 노출 ====================
    
    window.openFilterPanel = openFilterPanel;
    window.closeFilterPanel = closeFilterPanel;
    window.applyFilters = collectAndApplyFilters;
    window.resetFilters = resetFilters;
    window.switchView = switchView;
    window.openFullscreenMap = openFullscreenMap;
    window.closeFullscreenMap = closeFullscreenMap;
    window.moveToCurrentLocation = moveToCurrentLocation;

    window.addEventListener('beforeunload', () => {
        if (eventSource) {
            eventSource.close();
        }
    });

    document.addEventListener("DOMContentLoaded", init);
})();