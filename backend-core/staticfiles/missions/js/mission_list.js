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
 * 
 * 의존성: Auth, KakaoMapManager
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
        sort: 'latest',           // latest, distance, reward
        categories: [],            // ERRAND, STUDY, etc.
        statuses: ['WAITING'],     // WAITING, MATCHED
        view: 'both'              // both, list
    };

    // 카테고리 매핑
    const CATEGORY_MAP = {
        'ERRAND': '심부름',
        'STUDY': '학업',
        'RENTAL': '대여',
        'RECRUIT': '구인',
        'LIFE': '생활',
        'OTHER': '기타'
    };

    // 상태 매핑
    const STATUS_MAP = {
        'WAITING': { text: '대기중', class: 'waiting' },
        'MATCHED': { text: '진행중', class: 'matched' },
        'COMPLETED': { text: '완료', class: 'completed' }
    };

    // ==================== 거리 계산 ====================
    
    /**
     * Haversine 공식으로 두 좌표 간 거리 계산 (km)
     */
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // 지구 반지름 (km)
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // ==================== 필터링 및 정렬 ====================
    
    /**
     * 필터 적용
     */
    function applyFilters() {
        let result = [...allMissions];

        // 카테고리 필터
        if (currentFilters.categories.length > 0) {
            result = result.filter(m => currentFilters.categories.includes(m.category));
        }

        // 상태 필터
        if (currentFilters.statuses.length > 0) {
            result = result.filter(m => currentFilters.statuses.includes(m.status));
        }

        // 정렬
        switch (currentFilters.sort) {
            case 'latest':
                result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            
            case 'distance':
                if (userLocation) {
                    result.forEach(m => {
                        if (m.location_lat && m.location_lng) {
                            m._distance = calculateDistance(
                                userLocation.lat,
                                userLocation.lng,
                                m.location_lat,
                                m.location_lng
                            );
                        } else {
                            m._distance = Infinity;
                        }
                    });
                    result.sort((a, b) => a._distance - b._distance);
                }
                break;
            
            case 'reward':
                result.sort((a, b) => b.reward - a.reward);
                break;
            case 'deadline':
                result.sort((a, b) => {
                    // 마감 기한이 없는 데이터는 뒤로 보냄
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline) - new Date(b.deadline);
                });
                break;
        }

        filteredMissions = result;
        renderMissionList(filteredMissions);
        updateMapMarkers(filteredMissions);
    }

    /**
     * 필터 초기화
     */
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

    /**
     * 필터 수집 및 적용
     */
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
        const statusInputs = document.querySelectorAll('input[name="status"]:checked');
        currentFilters.statuses = Array.from(statusInputs).map(input => input.value);

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
        
        // 백드롭 클릭 시 닫기
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
        const floatingBtn = document.querySelector('.floating-map-btn');
        const viewBtns = document.querySelectorAll('.view-btn');

        // 버튼 활성화 상태 업데이트
        viewBtns.forEach(btn => {
            if (btn.dataset.view === viewType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (viewType === 'list') {
            // 리스트만 보기
            if (mapEl) mapEl.classList.add('hidden');
            if (floatingBtn) floatingBtn.classList.remove('hidden');
        } else {
            // 지도+미션 보기
            if (mapEl) mapEl.classList.remove('hidden');
            if (floatingBtn) floatingBtn.classList.add('hidden');
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
        if (contentContainer) contentContainer.style.display = 'none'; // ✨ content 숨김

        // 전체화면 지도 초기화
        if (!fullscreenMapManager) {
            try {
                fullscreenMapManager = new KakaoMapManager('fullscreen-map', {
                    center: userLocation || { lat: 37.5665, lng: 126.9780 },
                    level: 3
                });
                
                await fullscreenMapManager.init();
                
                // 사용자 위치 표시
                if (userLocation) {
                    await MapUtils.displayUserLocation(fullscreenMapManager);
                }
                
                // 현재 필터된 미션들의 마커 추가
                updateFullscreenMapMarkers(filteredMissions);
            } catch (err) {
                console.error("전체화면 지도 초기화 실패:", err);
            }
        } else {
            // 이미 초기화된 경우 마커만 업데이트
            updateFullscreenMapMarkers(filteredMissions);
        }
    }

    function closeFullscreenMap() {
        const container = document.getElementById('fullscreen-map-container');
        const backBtn = document.getElementById('back-to-list-btn');
        const contentContainer = document.querySelector('.content-container');
        
        if (container) {
            container.style.display = 'none';
        }
        if (backBtn) backBtn.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'block'; // ✨ content 다시 표시
    }

    function updateFullscreenMapMarkers(missions) {
        if (!fullscreenMapManager || !fullscreenMapManager.map) return;

        fullscreenMapManager.clearMarkers();

        const validLocations = [];

        missions.forEach(mission => {
            const lat = parseFloat(mission.location_lat);
            const lng = parseFloat(mission.location_lng);

            if (isNaN(lat) || isNaN(lng)) return;

            const marker = fullscreenMapManager.addCustomMarker(lat, lng, {
                title: mission.title
            });

            fullscreenMapManager.onMarkerClick(marker, () => {
                fullscreenMapManager.openInfoWindow(marker, createInfoWindowHTML(mission));
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

    // ==================== DOM 렌더링 ====================
    
    function renderMissionList(missions) {
        const container = document.getElementById('mission-list-container');
        if (!container) return;
        
        if (missions.length === 0) {
            container.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">필터 조건에 맞는 미션이 없습니다.</p>';
            return;
        }

        container.innerHTML = missions.map(createMissionCardHTML).join('');
    }

    function createMissionCardHTML(mission) {
        const detailViewUrl = `${mission.id}/`;
        
        // 상태 정보
        const statusInfo = STATUS_MAP[mission.status] || { text: mission.status, class: 'waiting' };
        
        // 거리 표시 (거리순 정렬 시)
        let distanceText = '';
        if (currentFilters.sort === 'distance' && mission._distance !== undefined && mission._distance !== Infinity) {
            distanceText = mission._distance < 1 
                ? `<span style="color:#28a745; font-size:12px; margin-left:8px;">${(mission._distance * 1000).toFixed(0)}m</span>`
                : `<span style="color:#28a745; font-size:12px; margin-left:8px;">${mission._distance.toFixed(1)}km</span>`;
        }
        
        return `
            <div class="card mission-card" data-id="${mission.id}" style="cursor:pointer;" onclick="location.href='${detailViewUrl}'">
                <div class="mission-card-header">
                    <div class="mission-title-row cols">
                        <div class="col1">
                        <span class="mission-title">${mission.title}</span>
                        ${distanceText}</div>
                        <div class="col2">
                        <span class="mission-status ${statusInfo.class}">${statusInfo.text}</span>
                        </div>
                    </div>
                </div>
                    
                <div class="mission-meta cols">
                    <div class="col1">
                    <span class="mission-category">${CATEGORY_MAP[mission.category] || mission.category}</span>
                    ${mission.location_name ? `<span class="mission-location"> ${mission.location_name}</span>` : ''}</div>
                    <div class="col2"><span class="mission-reward">${mission.reward.toLocaleString()}원</span></div>
                </div>
                
                ${mission.tags && mission.tags.length > 0 ? `
                <div class="mission-tags">
                    ${mission.tags.map(t => `<span class="mission-tag">#${t.name}</span>`).join('')}
                </div>
                ` : ''}
            </div>
        `;
    }

    function createInfoWindowHTML(mission) {
        const detailViewUrl = `${mission.id}/`;
        
        return `
            <div style="padding:10px; min-width:160px; font-size:14px; line-height:1.5;">
                <div style="font-weight:bold; color:#333;">${mission.title}</div>
                <div style="color:#28a745; font-size:12px; margin-bottom:5px;">
                    보상: ${mission.reward.toLocaleString()}원
                </div>
                <a href="${detailViewUrl}" style="color:#007bff; text-decoration:none; font-weight:bold; font-size:12px;">
                    상세보기 →
                </a>
            </div>
        `;
    }

    // ==================== 지도 마커 ====================
    
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

            const marker = mapManager.addCustomMarker(lat, lng, {
                title: mission.title
            });

            mapManager.onMarkerClick(marker, () => {
                mapManager.openInfoWindow(marker, createInfoWindowHTML(mission));
            });

            validLocations.push({ lat, lng });
        });

        if (validLocations.length > 0) {
            mapManager.fitBoundsToLocations(validLocations);
        }
    }

    function addSingleMarker(mission) {
        if (!mapManager || !mapManager.map) return;

        const lat = parseFloat(mission.location_lat);
        const lng = parseFloat(mission.location_lng);

        if (isNaN(lat) || isNaN(lng)) {
            console.warn(`좌표 누락된 미션 (ID: ${mission.id})`);
            return;
        }

        const marker = mapManager.addCustomMarker(lat, lng, {
            title: mission.title
        });

        mapManager.onMarkerClick(marker, () => {
            mapManager.openInfoWindow(marker, createInfoWindowHTML(mission));
        });
    }

    // ==================== SSE 실시간 업데이트 ====================
    
    function addMissionToDOM(missionData) {
        // allMissions에 추가
        allMissions.unshift(missionData);
        
        // 필터 재적용
        applyFilters();
    }

    function updateMissionInDOM(missionData) {
        // allMissions 업데이트
        const index = allMissions.findIndex(m => m.id === missionData.id);
        if (index !== -1) {
            allMissions[index] = missionData;
        }
        
        // 필터 재적용
        applyFilters();
    }

    function removeMissionFromDOM(missionId) {
        // allMissions에서 제거
        allMissions = allMissions.filter(m => m.id !== missionId);
        
        // 필터 재적용
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
            // 1. 지도 초기화
            mapManager = new KakaoMapManager('map', {
                center: { lat: 37.5665, lng: 126.9780 },
                level: 3
            });
            
            await mapManager.init();
            console.log("✅ 카카오 지도 로드 완료");

            // 2. 사용자 위치 표시
            try {
                const location = await mapManager.getUserLocation();
                userLocation = location;
                console.log("✅ 사용자 위치:", userLocation);
                await MapUtils.displayUserLocation(mapManager);
            } catch (err) {
                console.warn("사용자 위치 표시 실패:", err);
            }

            // 3. 미션 목록 로드
            await loadMissions();

            // 4. SSE 연결
            connectSSE();
            
        } catch (err) {
            console.error("초기화 실패:", err);
        }
    }

    // ==================== 전역 함수 노출 ====================
    
    window.openFilterPanel = openFilterPanel;
    window.closeFilterPanel = closeFilterPanel;
    window.applyFilters = collectAndApplyFilters;
    window.resetFilters = resetFilters;
    window.switchView = switchView;
    window.openFullscreenMap = openFullscreenMap;
    window.closeFullscreenMap = closeFullscreenMap;

    // 페이지 떠날 때 SSE 연결 종료
    window.addEventListener('beforeunload', () => {
        if (eventSource) {
            eventSource.close();
        }
    });

    document.addEventListener("DOMContentLoaded", init);
})();