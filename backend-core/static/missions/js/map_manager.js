//카카오 지도에 현재 위치 표시하는 스크립트
        var map; // ✅ 전역으로 선언

        kakao.maps.load(function () {
            var container = document.getElementById('map');
            var options = {
                center: new kakao.maps.LatLng(33.450701, 126.570667),
                level: 3
            };

            map = new kakao.maps.Map(container, options);

            // ✅ 지도 생성 이후에 geolocation 실행
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function (position) {
                    var lat = position.coords.latitude;
                    var lon = position.coords.longitude;

                    var locPosition = new kakao.maps.LatLng(lat, lon);
                    var message = '<div style="padding:5px;">현재 위치</div>';

                    displayMarker(locPosition, message);
                    map.center = locPosition;
                }, function () {
                    fallback();
                });
            } else {
                fallback();
            }
        });

        function fallback() {
            var locPosition = new kakao.maps.LatLng(33.450701, 126.570667);
            var message = 'GPS를 지원하지 않습니다';
            displayMarker(locPosition, message);
        }

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
            map.setCenter(locPosition);
        }

