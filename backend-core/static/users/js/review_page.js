const pathSegments = window.location.pathname.split('/')
const pk = pathSegments.pop() || pathSegments.pop();
let star_score = 0

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const csrftoken = getCookie('csrftoken');

//페이지 랜더링
async function renderReviewpage() {
    const data = await Auth.getData(`/api/users/review_page_info/${pk}/`);
    if (!data) return;
    const mission_title = document.getElementById('mission-title');
    const register_name = document.getElementById('name');
    if (mission_title) mission_title.innerText = data.mission_name;
    if (register_name) register_name.innerText = data.username;
    console.log(data);
}

//버튼 활성화, 비활성화 로직
function checkValidation() {
    const submitBtn = document.getElementById('submit-evaluation');
    const selectedChips = getSelectedChips();

    // 조건: 별점이 0보다 크고 + 선택된 칩이 1개 이상일 때
    if (star_score > 0 && selectedChips.length > 0) {
        submitBtn.classList.remove('disabled');
        submitBtn.disabled = false; // 버튼 속성 활성화
    } else {
        submitBtn.classList.add('disabled');
        submitBtn.disabled = true;  // 버튼 속성 비활성화
    }
}

//별점 부분
function setScore(){
    const star = document.getElementById('star-group');

    star.addEventListener('click',(event)=>{
        const star_btn = event.target.closest('span');
        if(!star_btn)return;
        const score = star_btn.dataset.value

        star_score = score

        const allStars = document.querySelectorAll('.star');

        allStars.forEach(s => {
            if (parseInt(s.dataset.value) <= parseInt(score)) {
                s.classList.add('active');
                s.innerText = '★';
            } else {
                s.classList.remove('active');
                s.innerText = '☆';
            }
        });
        checkValidation()
    });
}

//빠른 코멘트 부분
function initQuickComments() {
    const chipGroup = document.getElementById('chip-group');

    // 1. 다중 선택 토글 이벤트
    chipGroup.addEventListener('click', (event) => {
        const chip = event.target.closest('.chip');
        if (!chip) return;

        chip.classList.toggle('active');

        // 2. 선택될 때마다 현재 선택된 모든 텍스트 가져오기
        const selectedValues = getSelectedChips();
        console.log("현재 선택된 코멘트:", selectedValues);
        checkValidation()
    });
}

// 선택된 칩들의 텍스트만 모아서 배열로 반환
function getSelectedChips() {
    const activeChips = document.querySelectorAll('.chip.active');
    return Array.from(activeChips).map(chip => chip.textContent);
}

async function send_info() {
    const review_data = {
        personal_key: pk,
        my_score: star_score,
        quick_comment: getSelectedChips(),
        comment: document.getElementById('comment-input').value,
    };
    const data = await Auth.postData(
        '/api/users/review_json/',
        review_data,
        false,
        { headers: { 'X-CSRFToken': csrftoken } }
    );
    if (data !== null) {
        window.location.href = '/api/users/homepage/';
    }
}



window.addEventListener('DOMContentLoaded',() => {
    renderReviewpage();
    setScore();
    initQuickComments();
});