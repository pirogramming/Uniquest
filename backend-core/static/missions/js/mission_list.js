(function () {
    let map;
    const API_LIST_URL = '/api/missions/api/list/';

    // mission_list.js

async function loadMissions() {
    try {
        const response = await Auth.authFetchJson(API_LIST_URL);
        if (response && response.results) {
            addMissionMarkers(response.results); // 지도에 표시
            renderMissionList(response.results); // 👈 하단 목록에 표시 (추가)
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
        <div class="card" data-id="${m.id}" style="cursor:pointer;" onclick="location.href='${detailViewUrl}'">
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

            const detailViewUrl = `${mission.id}/`; // 👈 여기도 수정
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

    document.addEventListener("DOMContentLoaded", initApp);
})();