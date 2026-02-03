// 카카오 지도 스크립트
var map; 

kakao.maps.load(function () {
    var container = document.getElementById('map');
    
    // 1. data-lat, data-lng 값 읽기 (HTML 요소로부터 직접 읽음)
    var missionLat = parseFloat(container.dataset.lat);
    var missionLng = parseFloat(container.dataset.lng);
    
    // 2. 지도 초기화 (거래 희망 장소가 있다면 그곳을 중심으로, 없으면 기본값)
    var defaultCenter = new kakao.maps.LatLng(33.450701, 126.570667);
    var startPosition = (missionLat && missionLng) 
                        ? new kakao.maps.LatLng(missionLat, missionLng) 
                        : defaultCenter;

    var options = {
        center: startPosition,
        level: 3
    };

    map = new kakao.maps.Map(container, options);

    // 3. [미션 위치 마커] 거래 희망 장소 표시 (값이 있을 때만)
    if (missionLat && missionLng) {
        var imageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png"; 
        var imageSize = new kakao.maps.Size(24, 35);
        var markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);
        var missionPosition = new kakao.maps.LatLng(missionLat, missionLng);
        
        var missionMarker = new kakao.maps.Marker({
            map: map,
            position: missionPosition,
            title: "거래 희망 장소",
            image: markerImage
        });

        var missionInfowindow = new kakao.maps.InfoWindow({
            content: '<div style="padding:5px; font-size:12px;">거래 희망 장소</div>',
            removable: true
        });
        missionInfowindow.open(map, missionMarker);
        map.setCenter(missionPosition);
    }

    // 4. [현재 위치 마커] Geolocation 실행
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            var lat = position.coords.latitude;
            var lon = position.coords.longitude;
            var currentLocPosition = new kakao.maps.LatLng(lat, lon);
            
            displayMarker(currentLocPosition, '<div style="padding:5px; font-size:12px;">현재 위치</div>');
            
            // 만약 미션 위치가 없다면 현재 위치를 지도의 중심으로 이동
            if (!missionLat || !missionLng) {
                map.setCenter(currentLocPosition);
            }
        }, function () {
            console.log("Geolocation 실패");
        });
    }
});

// 공통 마커 표시 함수
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