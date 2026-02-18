/**
 * 프로필 페이지 리뷰 렌더링 스크립트
 */
/**
 * 프로필 페이지 리뷰 렌더링 스크립트
 * mypage.js의 카드 구조와 동일하게 맞춤
 */
function renderReviews(reviews) {
    const container = document.getElementById('reviewsContainer');
    const badge = document.getElementById('review-count-badge');

    if (!container) return;

    // 데이터가 객체(dict)로 들어올 경우를 대비한 안전장치
    const reviewList = Array.isArray(reviews) ? reviews : [];
    if (badge) badge.textContent = reviewList.length;

    if (reviewList.length === 0) {
        container.innerHTML = `
            <div class="reviews-empty">
                <i class="fa fa-comment-slash"></i>
                아직 받은 리뷰가 없습니다
            </div>
        `;
        return;
    }

    container.innerHTML = ""; // 기존 내용 비우기

    reviewList.forEach((review) => {
        // 1. 퀵 코멘트 태그 생성 (mypage.js 로직)
        let quick_comment_list = '';
        if (review.quick_comment) {
            Object.values(review.quick_comment).forEach((value) => {
                quick_comment_list += `<span class="quick-tag">${value}</span>`;
            });
        }

        // 2. 별점 생성 (mypage.js 로직)
        let review_score_list = '';
        const my_score = parseInt(review.my_score || 0);
        const last_score = 5 - my_score;

        for (let i = 0; i < my_score; i++) {
            review_score_list += `<span class="star">★</span>`;
        }
        for (let i = 0; i < last_score; i++) {
            review_score_list += `<span class="star empty">★</span>`;
        }

        // 3. 카드 HTML 조립 (mypage.js와 동일한 구조)
        // 날짜 데이터가 없으면 오늘 날짜나 기본값 표시
        const dateStr = review.created_at || '2026.02.10';

        container.innerHTML += `
            <div class="review-card">
                <div class="review-header">
                    <div class="review-score">
                        ${review_score_list}
                    </div>
                    <div class="review-date">${dateStr}</div>
                </div>
                <div class="review-comment">${review.comment || '내용 없음'}</div>
                <div class="quick-tags">
                    ${quick_comment_list}
                </div>
            </div>`;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // HTML에서 선언된 reviewData 변수 사용
    if (typeof reviewData !== 'undefined') {
        renderReviews(reviewData);
    }
});
