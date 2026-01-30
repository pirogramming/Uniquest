var map;

kakao.maps.load(function () {
    var container = document.getElementById('map');
    if (!container) {
        console.error("지도 컨테이너(#map)를 찾을 수 없습니다.");
        return;
    }

    var options = {
        center: new kakao.maps.LatLng(37.5665, 126.9780),
        level: 3
    };
    map = new kakao.maps.Map(container, options);

    // 1. JSON 데이터 가져오기
    var dataElement = document.getElementById('mission-data');
    var missionList = [];
    if (dataElement) {
        try {
            missionList = JSON.parse(dataElement.textContent);
        } catch (e) {
            console.error("데이터 파싱 에러:", e);
        }
    }

    var bounds = new kakao.maps.LatLngBounds();
    var markersCount = 0;

    // 미션 마커 이미지 (별 모양)
    var imageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png"; 
    var imageSize = new kakao.maps.Size(24, 35);
    var markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

    // 2. 루프 돌며 미션 마커 생성
    missionList.forEach(function (mission) {
        var lat = parseFloat(mission.lat);
        var lng = parseFloat(mission.lng);
        if (isNaN(lat) || isNaN(lng)) return;

        var position = new kakao.maps.LatLng(lat, lng);
        var marker = new kakao.maps.Marker({
            map: map,
            position: position,
            image: markerImage,
            title: mission.title
        });

        var content = `
            <div style="padding:10px; min-width:150px; font-size: 14px;">
                <div style="font-weight:bold; margin-bottom:5px;">${mission.title}</div>
                <a href="${mission.url}" style="color:blue; text-decoration:none;">상세보기 →</a>
            </div>`;

        var infowindow = new kakao.maps.InfoWindow({
            content: content,
            removable: true
        });

        kakao.maps.event.addListener(marker, 'click', function() {
            infowindow.open(map, marker);
        });

        bounds.extend(position);
        markersCount++;
    });

    // 3. 미션 마커가 있다면 범위 조정
    if (markersCount > 0) {
        map.setBounds(bounds);
    }

    // 4. 현위치 파악 (Geolocation)
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            var lat = position.coords.latitude;
            var lon = position.coords.longitude;
            var locPosition = new kakao.maps.LatLng(lat, lon);
            var message = '<div style="padding:5px; font-size:12px;">내 위치</div>';

            displayMarker(locPosition, message);
            
            // 미션 마커가 없을 때만 내 위치를 중심으로 이동
            if (markersCount === 0) {
                map.setCenter(locPosition);
            }
        }, function (error) {
            console.warn("Geolocation 에러: " + error.message);
            fallback();
        });
    } else {
        fallback();
    }
});

// ✅ 마커 표시 공통 함수
function displayMarker(locPosition, message) {
    var marker = new kakao.maps.Marker({
        map: map,
        position: locPosition
    });

    var infowindow = new kakao.maps.InfoWindow({
        content: message,
        removable: true
    });

    infowindow.open(map, marker);
}

// ✅ GPS 실패 시 기본 위치
function fallback() {
    var locPosition = new kakao.maps.LatLng(37.5665, 126.9780); // 서울시청
    var message = '<div style="padding:5px; font-size:12px;">GPS 이용 불가</div>';
    displayMarker(locPosition, message);
}