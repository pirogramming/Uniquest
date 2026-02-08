/**
 * static/missions/js/mission_form.js
 * 
 * ✏️ 미션 등록/수정 페이지 로직
 * 
 * 역할:
 * - 폼 입력 관리 및 검증
 * - 초안(Draft) 저장/복원
 * - 커스텀 해시태그 관리
 * - 마감기한 빠른 선택 UX
 * - 미션 등록/수정 API 호출
 * 
 * 의존성: Auth
 */

(function () {
    const DRAFT_KEY = "mission_draft_v1";
    const MAX_TAGS = 5;
    let customTags = [];

    // DOM 요소 캐싱
    const form = document.getElementById("mission-form");
    const tagInput = document.getElementById("tag_input");
    const tagChips = document.getElementById("tag_chips");
    const tagsHidden = document.getElementById("tags_input");
    const deadlineInput = document.querySelector("input[name='deadline']");
    const duePreview = document.getElementById("due_preview");
    const duePickerWrap = document.getElementById("due_picker_wrap");
    const duePicker = document.getElementById("due_picker");

    // ==================== Draft (초안) 기능 ====================
    
    /**
     * 현재 입력값을 초안으로 저장
     */
    function saveDraft() {
        const data = {
            title: document.querySelector("input[name='title']")?.value || "",
            descriptions: document.querySelector("textarea[name='descriptions']")?.value || "",
            reward: document.querySelector("input[name='reward']")?.value || "",
            category: document.querySelector("select[name='category']")?.value || "",
            deadline: deadlineInput?.value || "",
            tags_input: tagsHidden?.value || "",
        };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    }

    /**
     * 저장된 초안 복원
     */
    function restoreDraft() {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        
        try {
            const data = JSON.parse(raw);
            const fields = ['title', 'descriptions', 'reward', 'category', 'deadline'];
            
            fields.forEach(name => {
                const el = document.querySelector(`[name='${name}']`);
                if (el && !el.value && data[name]) {
                    el.value = data[name];
                }
            });

            // 태그 복원
            if (tagsHidden && data.tags_input) {
                tagsHidden.value = data.tags_input;
                customTags = data.tags_input.split(",").filter(Boolean);
                renderChips();
            }
            
            initDeadlinePreview();
        } catch (e) {
            console.error("Draft restore error", e);
        }
    }

    /**
     * 초안 삭제
     */
    function clearDraft() {
        sessionStorage.removeItem(DRAFT_KEY);
    }

    // ==================== 해시태그 관리 ====================
    
    /**
     * 태그 칩 렌더링
     */
    function renderChips() {
        tagChips.innerHTML = "";
        
        customTags.forEach((t, idx) => {
            const span = document.createElement("span");
            span.className = "pill";
            span.textContent = "#" + t + "  ×";
            span.onclick = () => {
                customTags.splice(idx, 1);
                syncHiddenTags();
                renderChips();
                saveDraft();
            };
            tagChips.appendChild(span);
        });
    }

    /**
     * Hidden input 동기화
     */
    function syncHiddenTags() {
        tagsHidden.value = customTags.join(",");
    }

    /**
     * 커스텀 태그 추가
     */
    function addCustomTag(raw) {
        const t = raw.trim().replace(/^#/, "");
        if (!t || customTags.includes(t)) return;
        
        if (customTags.length >= MAX_TAGS) {
            alert("최대 5개까지 가능합니다.");
            return;
        }
        
        customTags.push(t);
        syncHiddenTags();
        renderChips();
        saveDraft();
    }

    // ==================== 마감기한 로직 ====================
    
    function pad2(n) {
        return String(n).padStart(2, "0");
    }

    function toDatetimeLocalValue(d) {
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }

    /**
     * 마감기한 업데이트 및 미리보기
     */
    function updateDeadline(dateObj, is24 = false) {
        const val = toDatetimeLocalValue(dateObj);
        deadlineInput.value = val;
        
        duePreview.textContent = `마감기한: ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 ` +
            (is24 && dateObj.getHours() === 23 ? "24:00" : `${pad2(dateObj.getHours())}:${pad2(dateObj.getMinutes())}`);
        
        saveDraft();
    }

    /**
     * 마감기한 미리보기 초기화
     */
    function initDeadlinePreview() {
        if (deadlineInput?.value) {
            const d = new Date(deadlineInput.value);
            duePreview.textContent = `마감기한: ${d.getMonth() + 1}월 ${d.getDate()}일 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        }
    }

    // ==================== API 요청 ====================
    
    /**
     * API URL 결정 (생성 vs 수정)
     */
    function getMissionApiUrl(missionId) {
        const BASE_API_PATH = '/api/missions/api';
        return missionId
            ? `${BASE_API_PATH}/${missionId}/update/`
            : `${BASE_API_PATH}/create/`;
    }

    /**
     * 폼 제출 처리
     */
    async function handleFormSubmit(e) {
        e.preventDefault();
        e.stopPropagation();

        const formData = new FormData(form);
        const missionId = form.dataset.missionId;

        // 1. 태그 데이터 정리
        formData.delete('tags_input');
        customTags.forEach(tag => formData.append('__custom_tag_names', tag));

        // 2. API URL 결정
        const apiUrl = getMissionApiUrl(missionId);

        console.log("전송 시도:", { url: apiUrl, mode: missionId ? "수정" : "생성" });

        try {
            // 3. Auth를 통해 전송 (JWT 토큰 자동 포함)
            const result = await Auth.postData(apiUrl, formData, true);

            if (result && result.success) {
                alert(missionId ? "성공적으로 수정되었습니다!" : "미션이 등록되었습니다!");
                clearDraft();

                // 상세 페이지로 이동
                window.location.href = `/api/missions/${result.mission_id}/`;
            } else {
                const errorMsg = result?.error 
                    ? JSON.stringify(result.error) 
                    : "알 수 없는 에러가 발생했습니다.";
                alert("처리 실패: " + errorMsg);
            }
        } catch (err) {
            console.error("네트워크 통신 에러:", err);
            alert("서버와 통신하는 중 오류가 발생했습니다.");
        }
    }

    // ==================== 이벤트 바인딩 ====================
    
    /**
     * 마감기한 빠른 선택 버튼 이벤트
     */
    function initDeadlineButtons() {
        // 오늘 24:00
        document.getElementById("btn_due_today").onclick = () => {
            const d = new Date();
            d.setHours(23, 59, 0, 0);
            updateDeadline(d, true);
            duePickerWrap.style.display = "none";
        };

        // 3일 후
        document.getElementById("btn_due_3d").onclick = () => {
            const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            updateDeadline(d);
            duePickerWrap.style.display = "none";
        };

        // 7일 후
        document.getElementById("btn_due_7d").onclick = () => {
            const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            updateDeadline(d);
            duePickerWrap.style.display = "none";
        };

        // 직접 선택
        document.getElementById("btn_due_pick").onclick = () => {
            duePickerWrap.style.display = "block";
            duePicker.focus();
        };

        duePicker.onchange = () => {
            if (duePicker.value) {
                updateDeadline(new Date(duePicker.value));
            }
        };
    }

    /**
     * 태그 입력 이벤트
     */
    function initTagInput() {
        tagInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                addCustomTag(tagInput.value);
                tagInput.value = "";
            }
        });
    }

    // ==================== 초기화 ====================
    
    function init() {
        // 위치 정보가 이미 있는 경우 (주소 선택 후 돌아왔을 때)
        const locNameEl = document.getElementById("location_name");
        const locDisplayEl = document.getElementById("location_name_display");
        
        if (locNameEl && locNameEl.value && locDisplayEl) {
            locDisplayEl.value = locNameEl.value;
        }

        // 초안 복원
        restoreDraft();

        // 이벤트 리스너 등록
        initTagInput();
        initDeadlineButtons();
        form.addEventListener("submit", handleFormSubmit);
    }

    // ==================== 전역 함수 ====================
    
    /**
     * 위치 선택 페이지 이동
     */
    window.goPickLocation = function () {
        saveDraft();
        const returnUrl = window.location.pathname + window.location.search;
        window.location.href = "/api/missions/location/pick/?return=" + encodeURIComponent(returnUrl);
    };

    // 문서 로드 완료 시 실행
    document.addEventListener("DOMContentLoaded", init);
})();