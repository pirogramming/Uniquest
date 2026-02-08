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

        container.innerHTML = missions.map(function (m) {
            const title = (m.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const descriptions = (m.descriptions || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const category = m.category || '';
            const location_name = m.location_name || '';
            const reward = m.reward != null ? m.reward : '';
            const status = m.status || '';
            const id = m.id || '';
            return (
                '<div class="mission-card" onclick="location.href=\'/api/missions/' + id + '/\'">' +
                '  <div class="card-header">' +
                '    <h3 class="title">' + title + '</h3>' +
                '    <span class="tag-status">' + status + '</span>' +
                '  </div>' +
                '  <p class="description">' + descriptions + '</p>' +
                '  <div class="card-footer">' +
                '    <div class="info">' +
                '      <span class="tag-category category-delivery">' + category + '</span>' +
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
