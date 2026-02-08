/**
 * mission_detail.js
 */
(function () {
    let map;

    // URL에서 mission_id 추출
    const pathParts = window.location.pathname.split('/').filter(p => p !== "");
    const missionId = pathParts[pathParts.length - 1];

    const API_DETAIL_URL = `/api/missions/api/${missionId}/detail/`;
    const API_DELETE_URL = `/api/missions/api/${missionId}/delete/`;

    // --- [1] 지도 마커 표시 (커스텀 별 마커 적용) ---
    function initMap(lat, lng) {
        const container = document.getElementById('map');
        if (!container) return;

        kakao.maps.load(() => {
            const position = new kakao.maps.LatLng(lat, lng);

            // 1. 지도 초기화
            map = new kakao.maps.Map(container, {
                center: position,
                level: 3
            });

            // 2. 별 모양 커스텀 마커 설정
            const imageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png";
            const imageSize = new kakao.maps.Size(24, 35);
            const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

            // 3. 마커 생성 및 지도 표시
            const marker = new kakao.maps.Marker({
                map: map,
                position: position,
                title: "거래 희망 장소",
                image: markerImage // 커스텀 이미지 적용
            });

            // 4. 인포윈도우 (선택 사항)
            const infowindow = new kakao.maps.InfoWindow({
                content: '<div style="padding:5px; font-size:12px; font-weight:bold;">거래 장소</div>'
            });
            infowindow.open(map, marker);

            // 5. 범위 재설정 (마커가 화면 중앙에 잘 오도록 함)
            const bounds = new kakao.maps.LatLngBounds();
            bounds.extend(position);
            map.setBounds(bounds);

            // 너무 확대되는 것을 방지하기 위해 레벨 조정 (옵션)
            map.setLevel(3);
        });
    }

    // --- [2] 미션 삭제 함수 ---
    async function deleteMission() {
        if (!confirm('정말로 이 미션을 삭제하시겠습니까?\n삭제된 미션은 복구할 수 없습니다.')) {
            return;
        }

        try {
            const response = await Auth.authFetch(API_DELETE_URL, {
                method: 'DELETE'
            });

            if (response.ok) {
                const data = await response.json();
                alert(data.message || '미션이 삭제되었습니다.');
                // 미션 목록 페이지로 이동
                window.location.href = '/api/missions/';
            } else {
                const error = await response.json();
                alert(error.error || '삭제에 실패했습니다.');
            }
        } catch (err) {
            console.error('미션 삭제 오류:', err);
            alert('삭제 중 오류가 발생했습니다.');
        }
    }

    // --- [3] 데이터 로드 및 버튼 처리 ---
    async function loadMissionDetail() {
        try {
            const mission = await Auth.authFetchJson(API_DETAIL_URL);

            if (mission) {
                // 1. 지도 표시 (좌표가 있을 때만)
                if (mission.location_lat && mission.location_lng) {
                    initMap(mission.location_lat, mission.location_lng);
                }

                // 2. 작성자 정보 업데이트
                const authorEl = document.getElementById('mission-author');
                if (authorEl && mission.author_username) {
                    authorEl.textContent = mission.author_username;
                }

                // 3. 버튼 렌더링 (작성자는 채팅하기 없음, 다른 사람이 채팅 시작 시 채팅 목록에 표시됨)
                const actionArea = document.getElementById('action-area');
                if (actionArea) {
                    if (mission.is_author) {
                        actionArea.innerHTML = `
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
                                <p style="margin: 0 0 10px 0; font-size: 14px;">본인이 등록한 미션입니다. 다른 사람이 채팅을 시작하면 채팅 목록에 표시됩니다.</p>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <button onclick="location.href='/api/missions/${mission.id}/edit/'" class="btn btn-secondary" style="flex: 1; min-width: 120px;">
                                        수정하기
                                    </button>
                                    <button onclick="window.deleteMission()" class="btn btn-danger" style="flex: 1; min-width: 120px; background-color: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                                        삭제하기
                                    </button>
                                </div>
                            </div>
                        `;
                    } else {
                        actionArea.innerHTML = `
                            <a href="/api/missions/${mission.id}/chat/start/" class="btn btn-primary" style="display: inline-block; width: 100%; max-width: 500px; height: 50px; font-size: 16px; line-height: 50px; text-align: center; text-decoration: none; color: white; border-radius: 8px;">
                                채팅하기
                            </a>
                        `;
                    }
                }
            }
        } catch (err) {
            console.error("상세 데이터 로드 실패:", err);
            document.getElementById('action-area').innerHTML = `<p class="muted">로그인이 필요하거나 삭제된 미션입니다.</p>`;
        }
    }

    // deleteMission을 전역으로 노출 (인라인 onclick에서 호출 가능하도록)
    window.deleteMission = deleteMission;

    document.addEventListener("DOMContentLoaded", loadMissionDetail);
})();