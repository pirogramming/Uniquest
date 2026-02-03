/**
 * mission_detail.js
 */
(function () {
    let map;
    
    // URL에서 mission_id 추출
    const pathParts = window.location.pathname.split('/').filter(p => p !== "");
    const missionId = pathParts[pathParts.length - 1];
    
    const API_DETAIL_URL = `/api/missions/api/${missionId}/detail/`;

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

    // --- [2] 데이터 로드 및 버튼 처리 ---
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

                // 3. 버튼 렌더링
                const actionArea = document.getElementById('action-area');
                if (actionArea) {
                    if (mission.is_author) {
                        actionArea.innerHTML = `
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
                                <p style="margin: 0 0 10px 0; font-size: 14px;">본인이 등록한 미션입니다.</p>
                                <button onclick="location.href='/api/missions/${mission.id}/edit/'" class="btn btn-secondary">
                                    미션 정보 수정하기
                                </button>
                            </div>
                        `;
                    } else if (mission.status === "WAITING") {
                        actionArea.innerHTML = `
                            <button id="btn-accept" class="btn btn-primary" style="width: 100%; max-width: 500px; height: 50px; font-size: 16px;">
                                채팅하며 미션 수락하기
                            </button>
                        `;
                        document.getElementById('btn-accept').onclick = () => acceptMission(mission.id);
                    } else {
                        actionArea.innerHTML = `<span class="muted">이미 매칭되었거나 완료된 미션입니다.</span>`;
                    }
                }
            }
        } catch (err) {
            console.error("상세 데이터 로드 실패:", err);
            document.getElementById('action-area').innerHTML = `<p class="muted">로그인이 필요하거나 삭제된 미션입니다.</p>`;
        }
    }

    // --- [3] 미션 수락 API 호출 ---
    async function acceptMission(id) {
        if (!confirm("이 미션을 수락하시겠습니까?\n수락 시 취소가 어려울 수 있으며 바로 채팅방으로 연결됩니다.")) return;
        
        try {
            const result = await Auth.postData(`/api/missions/api/${id}/accept/`, {});
            if (result.success) {
                alert("매칭 성공! 작성자와 대화를 시작하세요.");
                window.location.href = `/chat/room/${id}/`; 
            } else {
                alert(result.error || "수락 처리에 실패했습니다.");
            }
        } catch (err) {
            alert("서버 통신 오류가 발생했습니다.");
        }
    }

    document.addEventListener("DOMContentLoaded", loadMissionDetail);
})();