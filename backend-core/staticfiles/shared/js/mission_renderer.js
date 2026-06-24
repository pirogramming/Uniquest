/**
 * static/shared/js/mission_renderer.js
 * 
 * 🎨 미션 카드 렌더링 공통 모듈
 * 
 * 역할:
 * - 미션 카드 HTML 생성
 * - 카테고리/상태 매핑
 * - 필터링 및 정렬 공통 로직
 * 
 * 사용처: homepage, my_missions, mission_list
 */

(function () {
    // ==================== 매핑 테이블 ====================
    
    const CATEGORY_MAP = {
        'ERRAND': '심부름',
        'STUDY': '학업',
        'RENTAL': '대여',
        'RECRUIT': '구인',
        'LIFE': '생활',
        'OTHER': '기타'
    };

    const CATEGORY_CLASS_MAP = {
        '심부름': 'errand', 'ERRAND': 'errand',
        '학업': 'study', 'STUDY': 'study',
        '대여': 'rent', 'RENTAL': 'rent',
        '구인': 'job', 'RECRUIT': 'job',
        '생활': 'life', 'LIFE': 'life',
        '기타': 'etc', 'OTHER': 'etc'
    };

    const STATUS_MAP = {
        'WAITING': { text: '대기중', class: 'waiting' },
        'MATCHED': { text: '진행중', class: 'matched' },
        'COMPLETED': { text: '완료', class: 'completed' }
    };

    // ==================== 유틸리티 ====================
    
    /**
     * 거리 계산 (Haversine)
     */
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // ==================== 필터링 및 정렬 ====================
    
    /**
     * 미션 필터링
     */
    function filterMissions(missions, filters) {
        let result = [...missions];

        // 소유자 필터 (내가 등록/참여)
        if (filters.owner) {
            if (filters.owner === 'created') {
                result = result.filter(m => m.is_creator);
            } else if (filters.owner === 'joined') {
                result = result.filter(m => m.is_participant);
            }
        }

        // 카테고리 필터
        if (filters.categories && filters.categories.length > 0) {
            result = result.filter(m => filters.categories.includes(m.category));
        }

        // 상태 필터
        if (filters.statuses && filters.statuses.length > 0) {
            result = result.filter(m => filters.statuses.includes(m.status));
        }

        return result;
    }

    /**
     * 미션 정렬
     */
    function sortMissions(missions, sortBy, userLocation = null) {
        const result = [...missions];

        switch (sortBy) {
            case 'latest':
                result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            
            case 'distance':
                if (userLocation) {
                    result.forEach(m => {
                        if (m.location_lat && m.location_lng) {
                            m._distance = calculateDistance(
                                userLocation.lat,
                                userLocation.lng,
                                m.location_lat,
                                m.location_lng
                            );
                        } else {
                            m._distance = Infinity;
                        }
                    });
                    result.sort((a, b) => a._distance - b._distance);
                }
                break;
            
            case 'reward':
                result.sort((a, b) => b.reward - a.reward);
                break;
            
            case 'deadline':
                result.sort((a, b) => {
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline) - new Date(b.deadline);
                });
                break;
        }

        return result;
    }

    // ==================== HTML 생성 ====================
    
    /**
     * 미션 카드 HTML 생성 (기본형)
     */
    function createMissionCard(mission, options = {}) {
        const {
            showDistance = false,
            showChat = false,
            clickable = true,
            userLocation = null
        } = options;

        const statusInfo = STATUS_MAP[mission.status] || { text: mission.status, class: 'waiting' };
        const categoryText = CATEGORY_MAP[mission.category] || mission.category;
        const categoryClass = CATEGORY_CLASS_MAP[mission.category] || 'etc';
        
        // 거리 표시
        let distanceText = '';
        if (showDistance && mission._distance !== undefined && mission._distance !== Infinity) {
            distanceText = mission._distance < 1 
                ? `<span class="distance">${(mission._distance * 1000).toFixed(0)}m</span>`
                : `<span class="distance">${mission._distance.toFixed(1)}km</span>`;
        }

        // 채팅 버튼
        const chatBtn = showChat ? `
            <div class="chat-swipe" data-mission-id="${mission.id}" data-chat-room-id="${mission.chat_room_id || ''}">
                <i class="fas fa-comment"></i>
            </div>
        ` : '';

        const detailUrl = `/api/missions/${mission.id}/`;
        const cursor = clickable ? 'cursor:pointer;' : '';
        const onclick = clickable ? `onclick="location.href='${detailUrl}'"` : '';

        return `
            <div class="mission-card" data-id="${mission.id}" style="${cursor}" ${onclick}>
                ${chatBtn}
                <div class="mission-card-content">
                    <div class="mission-card-header">
                        <div class="mission-title-row">
                            <span class="mission-title">${mission.title}</span>
                            ${distanceText}
                        </div>
                        <span class="mission-status ${statusInfo.class}">${statusInfo.text}</span>
                    </div>
                    <p class="description">${mission.descriptions || ''}</p>
                    <div class="mission-meta">
                        <span class="mission-category category-${categoryClass}">${categoryText}</span>
                        ${mission.location_name ? `<span class="mission-location">${mission.location_name}</span>` : ''}
                        <span class="mission-reward">${mission.reward.toLocaleString()}원</span>
                    </div>
                    
                    ${mission.tags && mission.tags.length > 0 ? `
                    <div class="mission-tags">
                        ${mission.tags.map(t => `<span class="mission-tag">#${t.name}</span>`).join('')}
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * 미션 카드 HTML 생성 (homepage용 - 간소화)
    
    function createSimpleMissionCard(mission) {
        const statusInfo = STATUS_MAP[mission.status] || { text: mission.status, class: 'waiting' };
        const categoryText = CATEGORY_MAP[mission.category] || mission.category;
        const categoryClass = CATEGORY_CLASS_MAP[mission.category] || 'etc';
        
        return `
            <div class="mission-card" onclick="location.href='/api/missions/${mission.id}/'" style="cursor:pointer;">
                <div class="card-header">
                    <h3 class="title">${mission.title}</h3>
                    <span class="tag-status ${statusInfo.class}">${statusInfo.text}</span>
                </div>
                <p class="description">${mission.descriptions || ''}</p>
                <div class="card-footer">
                    <div class="info">
                        <span class="tag-category category-${categoryClass}">${categoryText}</span>
                        <span class="location">${mission.location_name || '장소 미정'}</span>
                    </div>
                    <span class="price">${Number(mission.reward).toLocaleString()}원</span>
                </div>
            </div>
        `;
    } */

    // ==================== 렌더링 ====================
    
    /**
     * 미션 목록 렌더링
     */
    function renderMissions(container, missions, options = {}) {
        if (!container) return;

        const { type = 'default', emptyMessage = '미션이 없습니다.' } = options;

        if (missions.length === 0) {
            container.innerHTML = `<p class="empty-message">${emptyMessage}</p>`;
            return;
        }

        container.innerHTML = missions.map(m => createMissionCard(m, options)).join('');
    }

    // ==================== 전역 노출 ====================
    
    window.MissionRenderer = {
        // 매핑
        CATEGORY_MAP,
        CATEGORY_CLASS_MAP,
        STATUS_MAP,
        
        // 유틸리티
        calculateDistance,
        
        // 필터링/정렬
        filterMissions,
        sortMissions,
        
        // HTML 생성
        createMissionCard,
    
        // 렌더링
        renderMissions
    };

    console.log("✅ MissionRenderer 모듈 로드 완료");
})();