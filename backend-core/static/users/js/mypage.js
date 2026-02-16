async function getUserData() {
    const userData = await Auth.getData('/api/users/api/profile/');
    if (userData) console.log("유저 정보 로드 성공:", userData);
    return userData;
}

async function renderProfile() {
    const user = await getUserData();
    
    if (user) {
        const my_missions = user.missions;
        const blockers = user.blocked_people;

        const usernameElement = document.getElementById('user-username');
        const univElement = document.getElementById('user-univ');
        const mannerScore = document.getElementById('user-score'); // 점수 텍스트
        const reviewlist = document.getElementById('reviewsContainer');
        const review_num = document.getElementById('review-count-badge');
        const score_bar_fill = document.getElementById('score_bar_fill');
        const imgEl = document.getElementById('userprofile');

        score_bar_fill.style = `width : ${user.manner_score}%;`

        // 1. 기본 정보 반영
        if (usernameElement) usernameElement.innerText = user.username;
        if (univElement) univElement.innerText = user.university;
        if (mannerScore) mannerScore.innerText = user.manner_score;
        if (imgEl) {
            if (user.userphoto) {
                imgEl.src = user.userphoto;   // 백엔드에서 준 URL 그대로
            } else {
                imgEl.src = '/static/users/images/profile.png';  // 기본 이미지 (경로는 프로젝트에 맞게)
            }
        }

        // 2. 리뷰 정보 반영
        if (reviewlist) {
            reviewlist.innerHTML = ""
            user.review_data.forEach(({comment,my_score,quick_comment}) => {
                let quick_comment_list = ``
                Object.values(quick_comment).forEach((value) => {
                    quick_comment_list += `<span class="quick-tag">${value}</span>`;
                });
                
                let review_score_list = ``
                const last_score = 5 - my_score

                for (let i = 0; i < my_score; i++) {
                    review_score_list += `<span class="star">★</span>`
                }
                for (let i = 0; i < last_score; i++) {
                    review_score_list += `<span class="star empty">★</span>`
                }


                reviewlist.innerHTML += `<div class="review-card">
                        <div class="review-header">
                            <div class="review-score">
                                ${review_score_list}
                            </div>
                            <div class="review-date">2026.02.10</div>
                        </div>
                        <div class="review-comment">${comment}</div>
                        <div class="quick-tags">
                            ${quick_comment_list}
                        </div>
                    </div>`
            });
        }

        // 3. 리뷰 개수 붙여넣기
        if(review_num) review_num.innerText = Object.keys(user.review_data).length;

        if (mannerScore) {
            mannerScore.innerText = `${user.manner_score}점`; 
            const scoreBar = document.querySelector('.score-bar-fill');
            if (scoreBar) {
                scoreBar.style.width = `${user.manner_score}%`;
            }
        }
    }
}

function toggleReviews() {
    const container = document.getElementById('reviewsContainer');
    const toggle = document.querySelector('.my-reviews-toggle');
    if (container && toggle) {
        container.classList.toggle('open');
        toggle.classList.toggle('active');
    }
}

function logout() {
    alert("로그아웃 되었습니다.");
    Auth.logout("/api/users/login/");
}


async function signout() {
    const res = await Auth.deleteData('/api/users/api/signout/');
    if (res !== null) {
        Auth.clearTokens();
        window.location.href = "/api/users/login/";
    } else {
        alert('에러');
    }
}

window.addEventListener('DOMContentLoaded', renderProfile);
