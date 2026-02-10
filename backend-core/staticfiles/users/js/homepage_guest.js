/**
 * 비로그인 전용 홈 페이지: API로 미션 목록만 불러와서 렌더링
 */
async function loadGuestHomepage() {
    if (localStorage.getItem('access_token')) {
        window.location.href = '/api/users/homepage/';
        return;
    }
    const container = document.getElementById('mission_cards');
    if (!container) return;

    try {
        const response = await fetch('/api/users/api/homepage_unlogin/');
        const data = await response.json();

        if (!response.ok) {
            container.innerHTML = '<p style="color: var(--text-gray); font-size: 14px;">미션 목록을 불러올 수 없습니다.</p>';
            return;
        }

        const missions = data.missions || [];
        if (missions.length === 0) {
            container.innerHTML = '<p style="color: var(--text-gray); font-size: 14px;">등록된 미션이 없습니다.</p>';
            return;
        }

        // [수정] 최신 미션 2개만 추출
        const latestMissions = missions.slice(0, 2);

        // 카테고리 색상 매핑 객체
        const categoryClassMap = {
            '심부름': 'category-errand',
            '학업': 'category-study',
            '대여': 'category-rent',
            '구인': 'category-job',
            '생활': 'category-life'
        };

        container.innerHTML = latestMissions.map(function (m) {
            const title = (m.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const category = m.category || '기타';
            const location_name = m.location_name || '장소 미지정';
            const reward = m.reward != null ? m.reward.toLocaleString() + '원' : '가격 미정';
            const status = m.status || '진행중';
            const id = m.id || '';

            // 카테고리에 맞는 클래스 선택
            const categoryColorClass = categoryClassMap[category] || 'category-etc';

            return (
                '<div class="mission-card">' +
                '  <div class="card-header">' +
                '    <h3 class="title">' + title + '</h3>' +
                '    <span class="tag-status">' + status + '</span>' +
                '  </div>' +
                '  <div class="card-footer">' +
                '    <div class="info">' +
                '      <span class="tag-category ' + categoryColorClass + '">' + category + '</span>' +
                '      <span class="location">' + location_name + '</span>' +
                '    </div>' +
                '    <span class="price">' + reward + '</span>' +
                '  </div>' +
                '</div>'
            );
        }).join('');
    } catch (err) {
        console.error('비로그인 홈 미션 로드 실패', err);
        container.innerHTML = '<p style="color: var(--text-gray); font-size: 14px;">미션 목록을 불러올 수 없습니다.</p>';
    }
}

window.addEventListener('DOMContentLoaded', loadGuestHomepage);