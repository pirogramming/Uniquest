/**
 * static/missions/js/mission_detail.js
 * 
 * 📄 미션 상세 페이지 로직
 * 
 * 역할:
 * - 미션 상세 정보 로드
 * - 지도에 미션 위치 표시
 * - 작성자 여부에 따른 버튼 렌더링
 * - 삭제 기능
 * 
 * 의존성: Auth, KakaoMapManager
 */

(function () {
    let mapManager;

    // URL에서 mission_id 추출
    const pathParts = window.location.pathname.split('/').filter(p => p !== "");
    const missionId = pathParts[pathParts.length - 1];

    const API_DETAIL_URL = `/api/missions/api/${missionId}/detail/`;
    const API_DELETE_URL = `/api/missions/api/${missionId}/delete/`;

    // ==================== 지도 초기화 ====================
    
    /**
     * 미션 위치를 지도에 표시
     */
    async function initMap(lat, lng) {
        const container = document.getElementById('map');
        if (!container) return;

        try {
            // 1. 지도 초기화
            mapManager = new KakaoMapManager('map', {
                center: { lat, lng },
                level: 3
            });

            await mapManager.init();

            // 2. 커스텀 마커 (별 모양) 추가
            const marker = mapManager.addCustomMarker(lat, lng, {
                title: "거래 희망 장소"
            });

            // 3. 인포윈도우 표시
            mapManager.openInfoWindow(
                marker,
                '<div style="padding:5px; font-size:12px; font-weight:bold;">거래 장소</div>'
            );

            // 4. 지도 범위 조정
            mapManager.fitBoundsToLocations([{ lat, lng }]);
            mapManager.setLevel(3); // 너무 확대되는 것 방지

            console.log("✅ 지도 초기화 완료");
        } catch (err) {
            console.error("지도 초기화 실패:", err);
        }
    }

    // ==================== 미션 삭제 ====================
    
    async function deleteMission() {
        if (!confirm('정말로 이 미션을 삭제하시겠습니까?\n삭제된 미션은 복구할 수 없습니다.')) {
            return;
        }

        try {
            const response = await Auth.authFetch(API_DELETE_URL, {
                method: 'DELETE'
            });

            if (response && response.ok) {
                const data = await response.json();
                alert(data.message || '미션이 삭제되었습니다.');
                // 미션 목록 페이지로 이동
                window.location.href = '/api/missions/';
            } else {
                const error = response ? await response.json() : {};
                alert(error.error || '삭제에 실패했습니다.');
            }
        } catch (err) {
            console.error('미션 삭제 오류:', err);
            alert('삭제 중 오류가 발생했습니다.');
        }
    }

    // ==================== 데이터 로드 ====================
    
    /**
     * 미션 상세 정보 로드 및 렌더링
     */
    async function loadMissionDetail() {
        try {
            const mission = await Auth.authFetchJson(API_DETAIL_URL);

            if (!mission) {
                console.error("미션 데이터를 가져올 수 없습니다.");
                document.getElementById('action-area').innerHTML = 
                    `<p class="muted">로그인이 필요하거나 삭제된 미션입니다.</p>`;
                return;
            }

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
            renderActionButtons(mission);

        } catch (err) {
            console.error("상세 데이터 로드 실패:", err);
            document.getElementById('action-area').innerHTML = 
                `<p class="muted">로그인이 필요하거나 삭제된 미션입니다.</p>`;
        }
    }

    /**
     * 액션 버튼 렌더링
     */
    function renderActionButtons(mission) {
        const actionArea = document.getElementById('action-area');
        if (!actionArea) return;

        if (mission.is_author) {
            // 작성자: 채팅하기, 수정하기, 삭제하기
            actionArea.innerHTML = `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
                    <p style="margin: 0 0 10px 0; font-size: 14px;">본인이 등록한 미션입니다.</p>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <a href="/api/missions/${mission.id}/chat/start/" 
                           class="btn btn-primary" 
                           style="flex: 1; min-width: 120px; padding: 10px 20px; text-decoration: none; color: white; border-radius: 8px; text-align: center;">
                            채팅하기
                        </a>
                        <button onclick="location.href='/api/missions/${mission.id}/edit/'" 
                                class="btn btn-secondary" 
                                style="flex: 1; min-width: 120px;">
                            수정하기
                        </button>
                        <button onclick="window.deleteMission()" 
                                class="btn btn-danger" 
                                style="flex: 1; min-width: 120px; background-color: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                            삭제하기
                        </button>
                    </div>
                </div>
            `;
        } else {
            // 비작성자: 채팅하기만
            actionArea.innerHTML = `
                <a href="/api/missions/${mission.id}/chat/start/" 
                   class="btn btn-primary" 
                   style="display: inline-block; width: 100%; max-width: 500px; height: 50px; font-size: 16px; line-height: 50px; text-align: center; text-decoration: none; color: white; border-radius: 8px;">
                    채팅하기
                </a>
            `;
        }
    }

    // ==================== 초기화 ====================
    
    // deleteMission을 전역으로 노출 (인라인 onclick에서 호출 가능하도록)
    window.deleteMission = deleteMission;

    document.addEventListener("DOMContentLoaded", loadMissionDetail);
})();