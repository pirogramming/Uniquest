(function () {
    let map;
    const API_LIST_URL = '/api/missions/api/list/';

    async function loadMissions() {
        try {
            console.log("미션 목록 요청 중...");
            const response = await Auth.authFetchJson(API_LIST_URL);
            
            // 데이터가 어떻게 들어오는지 콘솔에서 확인하세요!
            console.log("서버 응답 데이터:", response);

            if (response && response.results) {
                addMissionMarkers(response.results);
            } else {
                console.warn("데이터 형식이 맞지 않거나 결과가 없습니다.");
            }
        } catch (err) {
            console.error("API 요청 실패:", err);
        }
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

            const detailUrl = `/api/missions/${mission.id}/`;
            const content = `
                <div style="padding:10px; min-width:150px; font-size: 14px;">
                    <div style="font-weight:bold; margin-bottom:5px;">${mission.title}</div>
                    <div style="color:#666; font-size:11px; margin-bottom:5px;">보상: ${mission.reward}원</div>
                    <a href="${detailUrl}" style="color:blue; text-decoration:none; font-weight:bold;">상세보기 →</a>
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