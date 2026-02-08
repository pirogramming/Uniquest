/**
 * static/missions/js/mission_list.js
 * 
 * 📋 미션 목록 페이지 로직
 * 
 * 역할:
 * - 미션 목록 DOM 렌더링
 * - SSE 실시간 업데이트 처리
 * - 지도 및 마커 통합 관리 (KakaoMapManager 사용)
 * 
 * 의존성: Auth, KakaoMapManager
 */

(function () {
    let mapManager;
    let eventSource = null;
    
    const API_LIST_URL = '/api/missions/api/list/';
    const SSE_URL = '/stream/missions/stream';

    // 카테고리 매핑
    const CATEGORY_MAP = {
        'ERRAND': '심부름',
        'STUDY': '학업',
        'RENTAL': '대여',
        'RECRUIT': '구인',
        'LIFE': '생활',
        'OTHER': '기타'
    };

    // ==================== 미션 목록 로딩 ====================
    
    async function loadMissions() {
        try {
            const response = await Auth.getData(API_LIST_URL);
            if (response && response.results) {
                addMissionMarkers(response.results);
                renderMissionList(response.results);
            }
        } catch (err) {
            console.error("미션 목록 로드 실패:", err);
        }
    }

    // ==================== DOM 렌더링 ====================
    
    /**
     * 하단 미션 목록 렌더링
     */
    function renderMissionList(missions) {
        const container = document.getElementById('mission-list-container');
        if (!container) return;
        
        if (missions.length === 0) {
            container.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">아직 주변에 미션이 없습니다.</p>';
            return;
        }

        container.innerHTML = missions.map(createMissionCardHTML).join('');
    }

    /**
     * 미션 카드 HTML 생성
     */
    function createMissionCardHTML(mission) {
        const detailViewUrl = `${mission.id}/`;
        
        return `
            <div class="card mission-card" data-id="${mission.id}" style="cursor:pointer;" onclick="location.href='${detailViewUrl}'">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div style="font-size:1.1rem; font-weight:bold; color:#333;">${mission.title}</div>
                    <div style="font-weight:700; color:#28a745;">${mission.reward.toLocaleString()}원</div>
                </div>
                <div class="muted" style="margin-top:4px;">
                    ${CATEGORY_MAP[mission.category] || mission.category} · ${mission.status} · ${new Date(mission.created_at).toLocaleDateString()}
                </div>
                ${mission.location_name ? `<div class="muted" style="margin-top:4px;">📍 ${mission.location_name}</div>` : ''}
                <div style="margin-top:8px;">
                    ${mission.tags ? mission.tags.map(t => 
                        `<span class="muted" style="background:#f0f0f0; padding:2px 8px; border-radius:4px; margin-right:4px;">#${t.name}</span>`
                    ).join('') : ''}
                </div>
            </div>
        `;
    }

    /**
     * 인포윈도우 HTML 생성
     */
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
    
    /**
     * 전체 미션 마커 추가
     */
    function addMissionMarkers(missions) {
        if (!missions || missions.length === 0) return;

        const validLocations = [];

        missions.forEach(mission => {
            const lat = parseFloat(mission.location_lat);
            const lng = parseFloat(mission.location_lng);

            if (isNaN(lat) || isNaN(lng)) {
                console.warn(`좌표 누락된 미션 (ID: ${mission.id})`);
                return;
            }

            // 커스텀 마커 추가 (별 모양)
            const marker = mapManager.addCustomMarker(lat, lng, {
                title: mission.title
            });

            // 마커 클릭 시 인포윈도우 표시
            mapManager.onMarkerClick(marker, () => {
                mapManager.openInfoWindow(marker, createInfoWindowHTML(mission));
            });

            validLocations.push({ lat, lng });
        });

        // 모든 마커를 포함하도록 지도 범위 조정
        if (validLocations.length > 0) {
            mapManager.fitBoundsToLocations(validLocations);
        }
    }

    /**
     * 단일 미션 마커 추가 (SSE 실시간 추가용)
     */
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
    
    /**
     * 새 미션 DOM에 추가
     */
    function addMissionToDOM(missionData) {
        const container = document.getElementById('mission-list-container');
        if (!container) return;

        // "미션 없음" 메시지 제거
        const emptyMsg = container.querySelector('p.muted');
        if (emptyMsg) {
            container.innerHTML = '';
        }

        // 새 카드를 최상단에 추가
        const newCard = createMissionCardHTML(missionData).replace(
            'mission-card',
            'mission-card" style="cursor:pointer; animation: fadeIn 0.3s;'
        );
        
        container.insertAdjacentHTML('afterbegin', newCard);

        // 지도에도 마커 추가
        addSingleMarker(missionData);
    }

    /**
     * 기존 미션 DOM 업데이트
     */
    function updateMissionInDOM(missionData) {
        const existingCard = document.querySelector(`.mission-card[data-id="${missionData.id}"]`);
        if (!existingCard) return;

        const detailViewUrl = `${missionData.id}/`;

        existingCard.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div style="font-size:1.1rem; font-weight:bold; color:#333;">${missionData.title}</div>
                <div style="font-weight:700; color:#28a745;">${missionData.reward.toLocaleString()}원</div>
            </div>
            <div class="muted" style="margin-top:4px;">
                ${CATEGORY_MAP[missionData.category] || missionData.category} · ${missionData.status} · ${new Date(missionData.created_at).toLocaleDateString()}
            </div>
            ${missionData.location_name ? `<div class="muted" style="margin-top:4px;">📍 ${missionData.location_name}</div>` : ''}
            <div style="margin-top:8px;">
                ${missionData.tags ? missionData.tags.map(t => 
                    `<span class="muted" style="background:#f0f0f0; padding:2px 8px; border-radius:4px; margin-right:4px;">#${t.name}</span>`
                ).join('') : ''}
            </div>`;

        existingCard.onclick = () => location.href = detailViewUrl;
    }

    /**
     * 미션 DOM에서 제거
     */
    function removeMissionFromDOM(missionId) {
        const card = document.querySelector(`.mission-card[data-id="${missionId}"]`);
        if (card) {
            card.style.animation = 'fadeOut 0.3s';
            setTimeout(() => card.remove(), 300);
        }
    }

    /**
     * SSE 연결 시작
     */
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
                
                // 3초 후 재연결 시도
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

            // 2. 사용자 위치 표시 (실패해도 계속 진행)
            try {
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

    // 페이지 떠날 때 SSE 연결 종료
    window.addEventListener('beforeunload', () => {
        if (eventSource) {
            eventSource.close();
        }
    });

    document.addEventListener("DOMContentLoaded", init);
})();