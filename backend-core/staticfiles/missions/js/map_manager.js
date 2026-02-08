/**
 * static/missions/js/map_manager.js
 * 
 * 🗺️ 카카오 지도 통합 관리 모듈
 * 
 * 기능:
 * - 지도 초기화
 * - 사용자 현재 위치 가져오기 및 표시
 * - 마커 생성 (일반/커스텀)
 * - 인포윈도우 관리
 * - 지도 범위 조정
 * 
 * 사용처: mission_list, mission_detail, mission_form 등
 */

class KakaoMapManager {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.map = null;
        this.markers = [];
        
        // 기본 옵션
        this.options = {
            center: { lat: 37.5665, lng: 126.9780 }, // 서울 시청
            level: 3,
            ...options
        };
        
        // 커스텀 마커 이미지 기본값 (별 모양)
        this.customMarkerImage = {
            src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
            size: { width: 24, height: 35 }
        };
    }

    /**
     * 지도 초기화
     * @returns {Promise<kakao.maps.Map>}
     */
    async init() {
        return new Promise((resolve, reject) => {
            const container = document.getElementById(this.containerId);
            if (!container) {
                reject(new Error(`지도 컨테이너를 찾을 수 없습니다: #${this.containerId}`));
                return;
            }

            kakao.maps.load(() => {
                const options = {
                    center: new kakao.maps.LatLng(
                        this.options.center.lat,
                        this.options.center.lng
                    ),
                    level: this.options.level
                };

                this.map = new kakao.maps.Map(container, options);
                console.log(`✅ 카카오 지도 초기화 완료: #${this.containerId}`);
                resolve(this.map);
            });
        });
    }

    /**
     * 사용자 현재 위치 가져오기
     * @returns {Promise<{lat: number, lng: number}>}
     */
    async getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation을 지원하지 않는 브라우저입니다."));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    console.log("✅ 사용자 위치:", location);
                    resolve(location);
                },
                (error) => {
                    console.error("위치 가져오기 실패:", error);
                    reject(error);
                },
                {
                    enableHighAccuracy: true, // GPS 정확도 높이기
                    timeout: 5000,            // 5초 제한
                    maximumAge: 0             // 캐시 사용 안 함
                }
            );
        });
    }

    /**
     * 마커 추가 (일반)
     * @param {number} lat 위도
     * @param {number} lng 경도
     * @param {object} options 추가 옵션
     * @returns {kakao.maps.Marker}
     */
    addMarker(lat, lng, options = {}) {
        if (!this.map) {
            console.error("지도가 초기화되지 않았습니다.");
            return null;
        }

        const position = new kakao.maps.LatLng(lat, lng);
        const marker = new kakao.maps.Marker({
            map: this.map,
            position: position,
            ...options
        });

        this.markers.push(marker);
        return marker;
    }

    /**
     * 커스텀 마커 추가 (별 모양)
     * @param {number} lat 
     * @param {number} lng 
     * @param {object} options 
     * @returns {kakao.maps.Marker}
     */
    addCustomMarker(lat, lng, options = {}) {
        const imageSize = new kakao.maps.Size(
            this.customMarkerImage.size.width,
            this.customMarkerImage.size.height
        );
        const markerImage = new kakao.maps.MarkerImage(
            this.customMarkerImage.src,
            imageSize
        );

        return this.addMarker(lat, lng, {
            image: markerImage,
            ...options
        });
    }

    /**
     * 인포윈도우 생성 및 열기
     * @param {kakao.maps.Marker} marker 
     * @param {string} content HTML 내용
     * @param {boolean} removable 닫기 버튼 표시 여부
     * @returns {kakao.maps.InfoWindow}
     */
    openInfoWindow(marker, content, removable = true) {
        const infowindow = new kakao.maps.InfoWindow({
            content: content,
            removable: removable
        });

        infowindow.open(this.map, marker);
        return infowindow;
    }

    /**
     * 지도 중심 이동
     */
    setCenter(lat, lng) {
        if (!this.map) return;
        const position = new kakao.maps.LatLng(lat, lng);
        this.map.setCenter(position);
    }

    /**
     * 지도 레벨(줌) 설정
     */
    setLevel(level) {
        if (!this.map) return;
        this.map.setLevel(level);
    }

    /**
     * 모든 마커를 포함하도록 지도 범위 조정
     */
    fitBounds() {
        if (!this.map || this.markers.length === 0) return;

        const bounds = new kakao.maps.LatLngBounds();
        this.markers.forEach(marker => {
            bounds.extend(marker.getPosition());
        });

        this.map.setBounds(bounds);
    }

    /**
     * 특정 위치들을 모두 포함하도록 범위 조정
     * @param {Array<{lat: number, lng: number}>} locations 
     */
    fitBoundsToLocations(locations) {
        if (!this.map || locations.length === 0) return;

        const bounds = new kakao.maps.LatLngBounds();
        locations.forEach(loc => {
            bounds.extend(new kakao.maps.LatLng(loc.lat, loc.lng));
        });

        this.map.setBounds(bounds);
    }

    /**
     * 모든 마커 제거
     */
    clearMarkers() {
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];
    }

    /**
     * 지도에 클릭 이벤트 리스너 추가
     * @param {Function} callback 
     */
    onClick(callback) {
        if (!this.map) return;
        kakao.maps.event.addListener(this.map, 'click', callback);
    }

    /**
     * 마커에 클릭 이벤트 리스너 추가
     * @param {kakao.maps.Marker} marker 
     * @param {Function} callback 
     */
    onMarkerClick(marker, callback) {
        kakao.maps.event.addListener(marker, 'click', callback);
    }
}

// ==================== 유틸리티 함수 ====================

/**
 * 사용자 위치를 지도에 표시하는 헬퍼 함수
 * @param {KakaoMapManager} mapManager 
 * @returns {Promise<{lat: number, lng: number}>}
 */
async function displayUserLocation(mapManager) {
    try {
        const location = await mapManager.getUserLocation();
        
        // 현재 위치 마커 추가
        const marker = mapManager.addMarker(location.lat, location.lng);
        
        // 인포윈도우 표시
        mapManager.openInfoWindow(
            marker,
            '<div style="padding:5px; font-size:12px; font-weight:bold;">내 위치</div>'
        );
        
        // 지도 중심을 현재 위치로 이동
        mapManager.setCenter(location.lat, location.lng);
        
        return location;
    } catch (err) {
        console.warn("사용자 위치 표시 실패:", err);
        // 기본 위치(서울 시청)는 이미 설정되어 있음
        return null;
    }
}

/**
 * 카카오맵 로드 대기 헬퍼
 * @returns {Promise<void>}
 */
function waitForKakaoMaps() {
    return new Promise((resolve) => {
        if (typeof kakao !== 'undefined' && kakao.maps) {
            kakao.maps.load(resolve);
        } else {
            console.error('카카오맵 SDK가 로드되지 않았습니다.');
            resolve();
        }
    });
}

// ==================== 전역 노출 ====================

window.KakaoMapManager = KakaoMapManager;
window.MapUtils = {
    displayUserLocation,
    waitForKakaoMaps
};

console.log("✅ KakaoMapManager 로드 완료");