/**
 * 프로필 페이지 리뷰 렌더링 스크립트
 */
function renderReviews(reviews) {
    const container = document.getElementById('reviewsContainer');
    const badge = document.getElementById('review-count-badge');

    if (!container) return;

    // 데이터가 객체(dict)로 들어올 경우를 대비한 안전장치
    const reviewList = Array.isArray(reviews) ? reviews : [];
    badge.textContent = reviewList.length;

    if (reviewList.length === 0) {
        container.innerHTML = `
            <div class="reviews-empty">
                <i class="fa fa-comment-slash" style="font-size: 30px; display:block; margin-bottom:10px; opacity:0.3;"></i>
                아직 받은 리뷰가 없습니다
            </div>
        `;
        return;
    }

    container.innerHTML = reviewList.map(review => {
        // 평점(my_score) 처리 (숫자가 아닐 경우 대비)
        const rating = parseInt(review.my_score || 0);
        const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
        
        return `
            <div class="review-card">
                <div class="review-header">
                    <span class="review-author">
                        <i class="fa fa-user-circle"></i> ${review.author || '익명 사용자'}
                    </span>
                    <span class="review-stars">${stars}</span>
                </div>
                <div class="review-text">${review.comment || review.content || '내용 없음'}</div>
                <div class="review-date">${review.created_at || ''}</div>
            </div>
        `;
    }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    // HTML에서 선언된 reviewData 변수 사용
    if (typeof reviewData !== 'undefined') {
        renderReviews(reviewData);
    }
});