/**
 * static/missions/js/map_manager.js
 * 
 * 🗺️ 카카오 지도 통합 관리 모듈
 * 
 * 기능:
 * - 지도 초기화
 * - 사용자 현재 위치 가져오기 및 표시
 * - 마커 생성 (일반/커스텀) - CustomOverlay 사용
 * - 인포윈도우 관리
 * - 지도 범위 조정
 * 
 * 사용처: mission_list, mission_detail, mission_form 등
 * 
 * 수정 사항:
 * - getUserLocation(): 3단계 폴백 전략
 * - 커스텀 마커: CSS 스타일 사용 (파란색 핀/노란색 핀)
 */

class KakaoMapManager {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.map = null;
        this.markers = [];
        this.overlays = []; // CustomOverlay 저장
        
        // 기본 옵션
        this.options = {
            center: { lat: 37.5665, lng: 126.9780 }, // 서울 시청
            level: 3,
            ...options
        };
        
        // 커스텀 마커 이미지 기본값 (별 모양) - 하위 호환성
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
     * 사용자 현재 위치 가져오기 (개선된 3단계 폴백)
     * 
     * 전략:
     * 1차 시도: 빠른 위치 (Wi-Fi/IP 기반) - 5초 timeout
     * 2차 시도: 정확한 위치 (GPS 기반) - 20초 timeout
     * 3차 시도: 기본 위치 (서울 시청) - 항상 성공
     * 
     * @returns {Promise<{lat: number, lng: number}>}
     */
    async getUserLocation() {
        // 1차 시도: 빠른 위치 (Wi-Fi/IP 기반)
        try {
            const location = await this._getLocationWithOptions({
                enableHighAccuracy: false,  // Wi-Fi/IP 사용 (빠름)
                timeout: 5000,              // 5초
                maximumAge: 300000          // 5분 이내 캐시 허용
            });
            console.log("✅ 사용자 위치 (빠른 모드):", location);
            return location;
        } catch (fastError) {
            console.warn("⚠️ 빠른 위치 가져오기 실패:", fastError.message);
            
            // 2차 시도: 정확한 위치 (GPS 기반)
            try {
                const location = await this._getLocationWithOptions({
                    enableHighAccuracy: true,   // GPS 사용
                    timeout: 20000,             // 20초로 증가
                    maximumAge: 0
                });
                console.log("✅ 사용자 위치 (GPS 모드):", location);
                return location;
            } catch (accurateError) {
                console.warn("⚠️ 정확한 위치 가져오기 실패:", accurateError.message);
                
                // 3차 시도: 기본 위치 (서울 시청)
                const defaultLocation = {
                    lat: 37.5665,
                    lng: 126.9780
                };
                console.log("ℹ️ 기본 위치 사용 (서울 시청):", defaultLocation);
                return defaultLocation;
            }
        }
    }

    /**
     * 위치 가져오기 내부 헬퍼
     * @private
     * @param {object} options Geolocation API 옵션
     * @returns {Promise<{lat: number, lng: number}>}
     */
    _getLocationWithOptions(options) {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation을 지원하지 않는 브라우저입니다."));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    let errorMsg = '위치 가져오기 실패';
                    switch (error.code) {
                        case 1:
                            errorMsg = '위치 권한이 거부되었습니다.';
                            break;
                        case 2:
                            errorMsg = '위치를 사용할 수 없습니다.';
                            break;
                        case 3:
                            errorMsg = '위치 요청 시간이 초과되었습니다.';
                            break;
                    }
                    reject(new Error(errorMsg));
                },
                options
            );
        });
    }

    /**
     * 마커 추가 (일반 - 기본 카카오 마커)
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
     * 커스텀 마커 추가 (CSS 스타일 사용 - 노란색 핀)
     * @param {number} lat 
     * @param {number} lng 
     * @param {object} options { status: 'WAITING'|'MATCHED'|'COMPLETED', onClick: fn }
     * @returns {kakao.maps.CustomOverlay}
     */
    addCustomMarker(lat, lng, options = {}) {
        if (!this.map) {
            console.error("지도가 초기화되지 않았습니다.");
            return null;
        }

        const position = new kakao.maps.LatLng(lat, lng);
        
        // CSS 마커 DOM 생성
        const markerEl = document.createElement('div');
        markerEl.className = 'mission-marker';
        
        // 상태별 클래스 추가
        if (options.status) {
            markerEl.classList.add(options.status.toLowerCase());
        }
        
        // CustomOverlay 생성
        const customOverlay = new kakao.maps.CustomOverlay({
            position: position,
            content: markerEl,
            yAnchor: 1,
            zIndex: 10
        });
        
        customOverlay.setMap(this.map);
        
        // 클릭 이벤트
        if (options.onClick) {
            markerEl.addEventListener('click', (e) => {
                e.stopPropagation();
                options.onClick(customOverlay);
            });
        }
        
        this.overlays.push(customOverlay);
        
        return customOverlay;
    }

    /**
     * 인포윈도우 생성 및 열기
     * @param {kakao.maps.Marker|kakao.maps.CustomOverlay} marker 
     * @param {string} content HTML 내용
     * @param {boolean} removable 닫기 버튼 표시 여부
     * @returns {kakao.maps.InfoWindow}
     */
    openInfoWindow(marker, content, removable = true) {
        const infowindow = new kakao.maps.InfoWindow({
            content: content,
            removable: removable
        });

        // CustomOverlay인 경우 position 가져오기
        const position = marker.getPosition ? marker.getPosition() : marker.a;
        
        if (marker.setMap) {
            // 일반 Marker
            infowindow.open(this.map, marker);
        } else {
            // CustomOverlay
            infowindow.setPosition(position);
            infowindow.open(this.map);
        }
        
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
        if (!this.map || (this.markers.length === 0 && this.overlays.length === 0)) return;

        const bounds = new kakao.maps.LatLngBounds();
        
        // 일반 마커
        this.markers.forEach(marker => {
            bounds.extend(marker.getPosition());
        });
        
        // CustomOverlay
        this.overlays.forEach(overlay => {
            bounds.extend(overlay.getPosition());
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
        // 일반 마커 제거
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];
        
        // CustomOverlay 제거
        this.overlays.forEach(overlay => overlay.setMap(null));
        this.overlays = [];
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
     * @param {kakao.maps.Marker|kakao.maps.CustomOverlay} marker 
     * @param {Function} callback 
     */
    onMarkerClick(marker, callback) {
        // CustomOverlay는 생성 시 이벤트 등록
        // 일반 Marker만 여기서 처리
        if (marker.setMap && !marker.a) {
            kakao.maps.event.addListener(marker, 'click', callback);
        }
    }
}

// ==================== 유틸리티 함수 ====================

/**
 * 사용자 위치를 지도에 표시하는 헬퍼 함수 (개선된 버전)
 * CSS 마커 사용 (파란색 핀)
 * 
 * @param {KakaoMapManager} mapManager 
 * @returns {Promise<{lat: number, lng: number}>}
 */
async function displayUserLocation(mapManager) {
    try {
        const location = await mapManager.getUserLocation();
        
        // CSS 마커 생성 (파란색 핀)
        const markerEl = document.createElement('div');
        markerEl.className = 'user-location-marker';
        
        const position = new kakao.maps.LatLng(location.lat, location.lng);
        
        const customOverlay = new kakao.maps.CustomOverlay({
            position: position,
            content: markerEl,
            yAnchor: 1,
            zIndex: 100
        });
        
        customOverlay.setMap(mapManager.map);
        
        // 지도 중심을 현재 위치로 이동
        mapManager.setCenter(location.lat, location.lng);
        
        console.log("✅ 사용자 위치 표시 완료:", location);
        return location;
        
    } catch (err) {
        // getUserLocation()이 항상 기본 위치라도 반환하므로
        // 이 catch는 이론상 실행되지 않지만, 안전장치로 유지
        console.warn("⚠️ 사용자 위치 표시 실패 (기본 위치 사용):", err);
        
        const defaultLocation = { lat: 37.5665, lng: 126.9780 };
        mapManager.setCenter(defaultLocation.lat, defaultLocation.lng);
        
        return defaultLocation;
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