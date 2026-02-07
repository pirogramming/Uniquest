(function () {
    let map;
    const API_LIST_URL = '/api/missions/api/list/';
    const SSE_URL = '/stream/missions/stream'; // ✨ nginx를 통해 FastAPI로 라우팅됨
    let eventSource = null;

    // mission_list.js

    async function loadMissions() {
        try {
            const response = await Auth.authFetchJson(API_LIST_URL);
            if (response && response.results) {
                addMissionMarkers(response.results); // 지도에 표시
                renderMissionList(response.results); // 👈 하단 목록에 표시
            }
        } catch (err) {
            console.error("API 요청 실패:", err);
        }
    }

    // 하단 목록을 동적으로 생성하는 함수
    function renderMissionList(missions) {
        const container = document.getElementById('mission-list-container');
        if (!container) return;
        if (missions.length === 0) {
            container.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">아직 주변에 미션이 없습니다.</p>';
            return;
        }

        // 상태/카테고리 매핑용 객체 (필요시 사용)
        const categoryMap = { 'ERRAND': '심부름', 'STUDY': '학업', 'RENTAL': '대여', 'LIFE': '생활' };

        container.innerHTML = missions.map(m => {
            // 실제 상세 페이지 URL (API 주소가 아님!)
            const detailViewUrl = `${m.id}/`;

            return `
        <div class="card mission-card" data-id="${m.id}" style="cursor:pointer;" onclick="location.href='${detailViewUrl}'">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div style="font-size:1.1rem; font-weight:bold; color:#333;">${m.title}</div>
                <div style="font-weight:700; color:#28a745;">${m.reward.toLocaleString()}원</div>
            </div>
            <div class="muted" style="margin-top:4px;">
                ${categoryMap[m.category] || m.category} · ${m.status} · ${new Date(m.created_at).toLocaleDateString()}
            </div>
            ${m.location_name ? `<div class="muted" style="margin-top:4px;">📍 ${m.location_name}</div>` : ''}
            <div style="margin-top:8px;">
                ${m.tags ? m.tags.map(t => `<span class="muted" style="background:#f0f0f0; padding:2px 8px; border-radius:4px; margin-right:4px;">#${t.name}</span>`).join('') : ''}
            </div>
        </div>
    `}).join('');
    }

    // ========== SSE 관련 함수 ==========
    
    // 새 미션 추가 (DOM 최상단에 추가)
    function addMissionToDOM(missionData) {
        const container = document.getElementById('mission-list-container');
        if (!container) return;

        // "미션 없음" 메시지 제거
        const emptyMsg = container.querySelector('p.muted');
        if (emptyMsg) {
            container.innerHTML = '';
        }

        const categoryMap = { 'ERRAND': '심부름', 'STUDY': '학업', 'RENTAL': '대여', 'LIFE': '생활' };
        const detailViewUrl = `${missionData.id}/`;

        const newCard = `
        <div class="card mission-card" data-id="${missionData.id}" style="cursor:pointer; animation: fadeIn 0.3s;" onclick="location.href='${detailViewUrl}'">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div style="font-size:1.1rem; font-weight:bold; color:#333;">${missionData.title}</div>
                <div style="font-weight:700; color:#28a745;">${missionData.reward.toLocaleString()}원</div>
            </div>
            <div class="muted" style="margin-top:4px;">
                ${categoryMap[missionData.category] || missionData.category} · ${missionData.status} · ${new Date(missionData.created_at).toLocaleDateString()}
            </div>
            ${missionData.location_name ? `<div class="muted" style="margin-top:4px;">📍 ${missionData.location_name}</div>` : ''}
            <div style="margin-top:8px;">
                ${missionData.tags ? missionData.tags.map(t => `<span class="muted" style="background:#f0f0f0; padding:2px 8px; border-radius:4px; margin-right:4px;">#${t.name}</span>`).join('') : ''}
            </div>
        </div>`;

        container.insertAdjacentHTML('afterbegin', newCard);

        // 지도 마커도 추가
        addSingleMarker(missionData);
    }

    // 기존 미션 업데이트
    function updateMissionInDOM(missionData) {
        const existingCard = document.querySelector(`.mission-card[data-id="${missionData.id}"]`);
        if (!existingCard) return;

        const categoryMap = { 'ERRAND': '심부름', 'STUDY': '학업', 'RENTAL': '대여', 'LIFE': '생활' };
        const detailViewUrl = `${missionData.id}/`;

        existingCard.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div style="font-size:1.1rem; font-weight:bold; color:#333;">${missionData.title}</div>
                <div style="font-weight:700; color:#28a745;">${missionData.reward.toLocaleString()}원</div>
            </div>
            <div class="muted" style="margin-top:4px;">
                ${categoryMap[missionData.category] || missionData.category} · ${missionData.status} · ${new Date(missionData.created_at).toLocaleDateString()}
            </div>
            ${missionData.location_name ? `<div class="muted" style="margin-top:4px;">📍 ${missionData.location_name}</div>` : ''}
            <div style="margin-top:8px;">
                ${missionData.tags ? missionData.tags.map(t => `<span class="muted" style="background:#f0f0f0; padding:2px 8px; border-radius:4px; margin-right:4px;">#${t.name}</span>`).join('') : ''}
            </div>`;

        existingCard.onclick = () => location.href = detailViewUrl;
    }

    // 미션 삭제
    function removeMissionFromDOM(missionId) {
        const card = document.querySelector(`.mission-card[data-id="${missionId}"]`);
        if (card) {
            card.style.animation = 'fadeOut 0.3s';
            setTimeout(() => card.remove(), 300);
        }

        // 지도 마커도 제거 (필요시 구현)
    }

    // SSE 연결 시작
    function connectSSE() {
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.warn('토큰이 없어 SSE 연결을 건너뜁니다.');
            return;
        }
        console.log("SSE용 토큰:", SSE_URL);

        try{
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

    // ========== 지도 관련 함수 ==========

    function addMissionMarkers(missions) {
        if (!missions || missions.length === 0) return;

        const bounds = new kakao.maps.LatLngBounds();
        const imageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png";
        const imageSize = new kakao.maps.Size(24, 35);
        const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

        missions.forEach(mission => {
            // DRF Response의 필드명(location_lat, location_lng) 확인
            const lat = parseFloat(mission.location_lat);
            const lng = parseFloat(mission.location_lng);

            if (isNaN(lat) || isNaN(lng)) {
                console.warn(`좌표 누락된 미션 발견 (ID: ${mission.id})`);
                return;
            }

            const position = new kakao.maps.LatLng(lat, lng);
            const marker = new kakao.maps.Marker({
                map: map,
                position: position,
                image: markerImage,
                title: mission.title
            });

            const detailViewUrl = `${mission.id}/`;
            const content = `
            <div style="padding:10px; min-width:160px; font-size: 14px; line-height:1.5;">
                <div style="font-weight:bold; color:#333;">${mission.title}</div>
                <div style="color:#28a745; font-size:12px; margin-bottom:5px;">보상: ${mission.reward.toLocaleString()}원</div>
                <a href="${detailViewUrl}" style="color:#007bff; text-decoration:none; font-weight:bold; font-size:12px;">상세보기 →</a>
            </div>`;

            const infowindow = new kakao.maps.InfoWindow({
                content: content,
                removable: true
            });

            kakao.maps.event.addListener(marker, 'click', () => infowindow.open(map, marker));
            bounds.extend(position);
        });

        map.setBounds(bounds);
    }

    // 단일 마커 추가 (SSE로 새 미션 생성 시)
    function addSingleMarker(mission) {
        if (!map) return;

        const lat = parseFloat(mission.location_lat);
        const lng = parseFloat(mission.location_lng);

        if (isNaN(lat) || isNaN(lng)) {
            console.warn(`좌표 누락된 미션 (ID: ${mission.id})`);
            return;
        }

        const imageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png";
        const imageSize = new kakao.maps.Size(24, 35);
        const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

        const position = new kakao.maps.LatLng(lat, lng);
        const marker = new kakao.maps.Marker({
            map: map,
            position: position,
            image: markerImage,
            title: mission.title
        });

        const detailViewUrl = `${mission.id}/`;
        const content = `
        <div style="padding:10px; min-width:160px; font-size: 14px; line-height:1.5;">
            <div style="font-weight:bold; color:#333;">${mission.title}</div>
            <div style="color:#28a745; font-size:12px; margin-bottom:5px;">보상: ${mission.reward.toLocaleString()}원</div>
            <a href="${detailViewUrl}" style="color:#007bff; text-decoration:none; font-weight:bold; font-size:12px;">상세보기 →</a>
        </div>`;

        const infowindow = new kakao.maps.InfoWindow({
            content: content,
            removable: true
        });

        kakao.maps.event.addListener(marker, 'click', () => infowindow.open(map, marker));
    }

    function initApp() {
        const container = document.getElementById('map');
        if (!container) return;

        // autoload=false일 때 명시적으로 load 호출
        kakao.maps.load(function () {
            console.log("카카오 지도 로드 완료");
            const options = {
                center: new kakao.maps.LatLng(37.5665, 126.9780),
                level: 3
            };
            map = new kakao.maps.Map(container, options);

            loadMissions();
            initUserLocation();
            connectSSE(); // ✨ SSE 연결 시작
        });
    }

    function initUserLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const loc = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
                displayMarker(loc, '<div style="padding:5px; font-size:12px;">내 위치</div>');
            });
        }
    }

    function displayMarker(loc, msg) {
        new kakao.maps.Marker({ map, position: loc });
        const iw = new kakao.maps.InfoWindow({ content: msg, removable: true });
        iw.open(map);
    }

    // 페이지 떠날 때 SSE 연결 종료
    window.addEventListener('beforeunload', () => {
        if (eventSource) {
            eventSource.close();
        }
    });

    document.addEventListener("DOMContentLoaded", initApp);
})();