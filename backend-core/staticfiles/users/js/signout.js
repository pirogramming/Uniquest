const MYPAGE_URL = '/api/users/mypage/';
const LOGIN_URL = '/api/users/login/';

function goToMypage() {
    window.location.href = MYPAGE_URL;
}

async function loadUserAndRender() {
    const user = await Auth.getData('/api/users/api/profile_modify/');
    if (!user) {
        return;
    }
    const emailEl = document.getElementById('signout-user-email');
    const nameEl = document.getElementById('signout-user-name');
    if (emailEl) emailEl.textContent = user.univ_email || '—';
    if (nameEl) nameEl.textContent = user.username ? `${user.username} 님` : '—';
}

async function confirmSignout() {
    if (!confirm('정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        return;
    }
    const res = await Auth.deleteData('/api/users/api/signout/');
    if (res !== null) {
        Auth.clearTokens();
        window.location.href = LOGIN_URL;
    } else {
        alert('탈퇴 처리 중 오류가 발생했습니다.');
    }
}

document.addEventListener('DOMContentLoaded', loadUserAndRender);
