/**
 * static/missions/js/mission_detail.js
 * 
 * 📄 미션 상세 페이지 로직
 * 
 * 역할:
 * - 미션 상세 정보 로드
 * - 지도에 미션 위치 표시 (상태별 색상)
 * - 이미지 갤러리 렌더링 및 모달
 * - 햄버거 메뉴 토글 (작성자만)
 * - 삭제 기능
 * 
 * 의존성: Auth, KakaoMapManager
 */

(function () {
    let mapManager;
    let missionStatus = null;  // ✨ 미션 상태 저장

    // URL에서 mission_id 추출
    const pathParts = window.location.pathname.split('/').filter(p => p !== "");
    const missionId = pathParts[pathParts.length - 1];

    const API_DETAIL_URL = `/api/missions/api/${missionId}/detail/`;
    const API_DELETE_URL = `/api/missions/api/${missionId}/delete/`;

    // ==================== 지도 초기화 ====================
    
    /**
     * 지도 초기화 (상태별 마커 색상)
     */
    async function initMap(lat, lng, status) {
        const container = document.getElementById('map');
        if (!container) return;

        try {
            mapManager = new KakaoMapManager('map', {
                center: { lat, lng },
                level: 3
            });

            await mapManager.init();

            // ✨ 상태별 마커 생성 (InfoWindow 제거)
            const marker = mapManager.addCustomMarker(lat, lng, {
                status: status  // WAITING/MATCHED/COMPLETED
            });

            mapManager.fitBoundsToLocations([{ lat, lng }]);
            mapManager.setLevel(3);
            
            console.log("✅ 지도 초기화 완료 (상태:", status, ")");
        } catch (err) {
            console.error("지도 초기화 실패:", err);
        }
    }

    /**
     * 위치 정보 없음 메시지 표시
     */
    function showNoLocationMessage() {
        const container = document.getElementById('map');
        if (!container) return;

        container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 300px;
                background-color: #f8f9fa;
                border-radius: 8px;
                color: #6c757d;
                gap: 12px;
            ">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" class="bi bi-geo-alt-fill" viewBox="0 0 16 16">
                    <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6"/>
                </svg>
                <div style="font-size: 16px; font-weight: 500;">장소 설정 없음</div>
            </div>
        `;
    }

    // ==================== 이미지 갤러리 ====================
    
    /**
     * 이미지 갤러리 렌더링
     */
    function renderImages(images) {
        const section = document.getElementById('mission-images-section');
        if (!section) return;

        if (!images || images.length === 0) {
            section.innerHTML = '<div class="no-images">등록된 이미지가 없습니다.</div>';
            return;
        }

        const imagesHTML = images.map(img => {
            // 이미지 경로 처리
            let src = img.image;
            if (src && !src.startsWith('http') && !src.startsWith('/')) {
                src = '/' + src; 
            }

            return `
                <div class="image-item" onclick="window.openImageModal('${src}')">
                    <img src="${src}" alt="미션 이미지" 
                         onerror="this.src='/static/shared/img/default_image.png'; this.onerror=null;" 
                         loading="lazy">
                </div>
            `;
        }).join('');

        section.innerHTML = `
            <div class="mission-images">
                ${imagesHTML}
            </div>
        `;
    }

    /**
     * 이미지 모달 열기
     */
    function openImageModal(imgSrc) {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        
        if (modal && modalImg) {
            modal.style.display = 'block';
            modalImg.src = imgSrc;
        }
    }

    /**
     * 이미지 모달 닫기
     */
    function closeImageModal() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // ==================== 햄버거 메뉴 ====================
    
    /**
     * 햄버거 메뉴 토글
     */
    function toggleMenu() {
        const menu = document.getElementById('dropdown-menu');
        const backdrop = document.getElementById('menu-backdrop');
        
        if (menu && backdrop) {
            const isOpen = menu.classList.contains('show');
            
            if (isOpen) {
                closeMenu();
            } else {
                menu.classList.add('show');
                backdrop.classList.add('show');
            }
        }
    }

    /**
     * 메뉴 닫기
     */
    function closeMenu() {
        const menu = document.getElementById('dropdown-menu');
        const backdrop = document.getElementById('menu-backdrop');
        
        if (menu) menu.classList.remove('show');
        if (backdrop) backdrop.classList.remove('show');
    }

    /**
     * 햄버거 버튼 표시 (작성자만)
     */
    function showMenuButton(isAuthor) {
        const menuButton = document.getElementById('menu-button');
        
        if (menuButton && isAuthor) {
            menuButton.classList.add('visible');
        }
    }

    // ==================== 미션 삭제 ====================
    
    async function deleteMission() {
        // 메뉴 먼저 닫기
        closeMenu();
        
        if (!confirm('정말로 이 미션을 삭제하시겠습니까?\n삭제된 미션은 복구할 수 없습니다.')) {
            return;
        }

        try {
            const result = await fetch(API_DELETE_URL, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${Auth.getAccessToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (result.ok) {
                const data = await result.json();
                alert(data.message || '미션이 삭제되었습니다.');
                window.location.href = '/api/missions/';
            } else {
                const error = await result.json();
                alert(error.error || '삭제에 실패했습니다.');
            }
        } catch (err) {
            console.error('미션 삭제 오류:', err);
            alert('삭제 중 오류가 발생했습니다.');
        }
    }

    // ==================== 데이터 로드 ====================
    
    async function loadMissionDetail() {
        try {
            const mission = await Auth.authFetchJson(API_DETAIL_URL);

            if (!mission) {
                console.error("미션 데이터를 가져올 수 없습니다.");
                return;
            }

            // ✨ 미션 상태 저장
            missionStatus = mission.status;

            // 1. 이미지 표시
            renderImages(mission.images);

            // 2. 지도 표시 (좌표가 있을 때만, 상태 포함)
            if (mission.location_lat && mission.location_lng) {
                initMap(mission.location_lat, mission.location_lng, mission.status);
            } else {
                // ✨ 위치 정보가 없으면 "장소 설정 없음" 메시지 표시
                showNoLocationMessage();
            }

            // 3. 작성자인 경우 햄버거 버튼 표시
            showMenuButton(mission.is_author);

        } catch (err) {
            console.error("상세 데이터 로드 실패:", err);
        }
    }

    // ==================== 이벤트 핸들러 ====================
    
    /**
     * 키보드 이벤트 (ESC로 모달/메뉴 닫기)
     */
    function initKeyboardEvents() {
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeImageModal();
                closeMenu();
            }
        });
    }

    /**
     * 모달 배경 클릭으로 닫기
     */
    function initModalEvents() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeImageModal();
                }
            });
        }
    }

    /**
     * 햄버거 메뉴 이벤트
     */
    function initMenuEvents() {
        const menuButton = document.getElementById('menu-button');
        const backdrop = document.getElementById('menu-backdrop');
        const deleteBtn = document.getElementById('btn-delete');
        
        if (menuButton) {
            menuButton.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleMenu();
            });
        }
        
        // 삭제 버튼 이벤트
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                deleteMission();
            });
        }
        
        if (backdrop) {
            backdrop.addEventListener('click', closeMenu);
        }
        
        // 메뉴 외부 클릭 시 닫기
        document.addEventListener('click', function(e) {
            const menu = document.getElementById('dropdown-menu');
            const menuButton = document.getElementById('menu-button');
            
            if (menu && menuButton) {
                if (!menu.contains(e.target) && !menuButton.contains(e.target)) {
                    if (menu.classList.contains('show')) {
                        closeMenu();
                    }
                }
            }
        });
    }

    // ==================== 초기화 ====================
    
    function init() {
        // 전역 함수 노출
        window.deleteMission = deleteMission;
        window.openImageModal = openImageModal;
        window.closeImageModal = closeImageModal;

        // 이벤트 리스너 등록
        initKeyboardEvents();
        initModalEvents();
        initMenuEvents();

        // 데이터 로드
        loadMissionDetail();

        console.log("✅ mission_detail.js 초기화 완료");
    }

    document.addEventListener("DOMContentLoaded", init);
})();