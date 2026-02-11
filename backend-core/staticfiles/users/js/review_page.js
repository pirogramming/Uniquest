const pathSegments = window.location.pathname.split('/')
const pk = pathSegments.pop() || pathSegments.pop();
let star_score = 0

//페이지 랜더링
async function renderReviewpage() {
    const token = localStorage.getItem('access_token');

    if (!token) {
        window.location.href = '/api/users/login/';
        return;
    }

    try {
        const response = await fetch(`/api/users/review_page_info/${pk}/`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const data = await response.json();
        if (response.ok) {
            const mission_title = document.getElementById('mission-title');
            const register_name = document.getElementById('name');
            mission_title.innerText = data.mission_name;
            register_name.innerText = data.username;
            console.log(data)

        } else {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }
    } catch(error){
        console.log("오류감지",error)
    }
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

function send_info(){
    const personal_key = pk;
    const my_score = star_score;
    const quick_comment = getSelectedChips();
    const comment = document.getElementById('comment-input').value;

    console.log("personal_key",personal_key)
    console.log("my_score",my_score)
    console.log("comment",comment)
    console.log("quick_comment",quick_comment)

}



window.addEventListener('DOMContentLoaded',() => {
    renderReviewpage();
    setScore();
    initQuickComments();
});