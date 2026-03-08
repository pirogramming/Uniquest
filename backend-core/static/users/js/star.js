// 방법 1: HTML의 data-rating, data-size 속성을 읽어서 자동으로 그려주는 함수
function initStarRatings() {
    const starElements = document.querySelectorAll('.star-rating');

    starElements.forEach(star => {
        const rating = star.dataset.rating || 0;
        const size = star.dataset.size || 32;

        star.style.setProperty('--rating', `${rating}%`);
        star.style.setProperty('--star-size', `${size}px`);
    });
}

// 방법 2: JS에서 특정 요소의 별점과 크기를 직접 바꾸고 싶을 때 쓰는 함수
function setStarRating(elementId, percentage, sizeInPx) {
    const star = document.getElementById(elementId);
    if (!star) return;

    star.style.setProperty('--rating', `${percentage}%`);
    star.style.setProperty('--star-size', `${sizeInPx}px`);
}
