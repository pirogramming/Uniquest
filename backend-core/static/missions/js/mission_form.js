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
 * - 이미지 미리보기 및 관리
 * - 미션 등록/수정 API 호출
 * 
 * 의존성: Auth
 */

(function () {
    const DRAFT_KEY = "mission_draft_v1";
    const MAX_TAGS = 5;
    const MAX_IMAGES = 5;
    let customTags = [];
    let selectedFiles = [];
    let existingImages = [];

    // DOM 요소 캐싱
    const form = document.getElementById("mission-form");
    const tagInput = document.getElementById("tag_input");
    const tagChips = document.getElementById("tag_chips");
    const tagsHidden = document.getElementById("tags_input");
    const deadlineInput = document.querySelector("input[name='deadline']");
    const duePreview = document.getElementById("due_preview");
    const duePickerWrap = document.getElementById("due_picker_wrap");
    const duePicker = document.getElementById("due_picker");
    const fileInput = document.getElementById("id_images");
    const previewContainer = document.getElementById("image-preview-container");
    const photoCount = document.getElementById("photo-count");
    const rewardInput = document.querySelector("input[name='reward']");
    const rewardKorean = document.getElementById("reward-korean");
    const rewardWarning = document.getElementById("reward-warning");

    // ==================== 금액 한글 변환 ====================
    
    /**
     * 숫자를 한글로 변환
     * 예: 32000 → "3만 2천원"
     */
function numberToKorean(num) {
    if (!num || num === 0) return "";
    
    const units = ["", "만", "억", "조"];
    const numUnits = ["", "십", "백", "천"];
    let result = "";
    
    // 숫자를 4자리씩 끊어서 처리 (한국어 수 체계 기준)
    let unitCount = 0;
    while (num > 0) {
        let chunk = num % 10000; // 4자리 추출
        if (chunk > 0) {
            let chunkResult = "";
            let chunkStr = String(chunk).split("").reverse();
            
            for (let i = 0; i < chunkStr.length; i++) {
                let digit = parseInt(chunkStr[i]);
                if (digit !== 0) {
                    // 1이면서 '십, 백, 천' 자리일 때는 숫자 '1'을 생략 (예: 일십 -> 십)
                    let digitStr = (digit === 1 && i > 0) ? "" : digit;
                    chunkResult = digitStr + numUnits[i] + chunkResult;
                }
            }
            result = chunkResult + units[unitCount] + " " + result;
        }
        num = Math.floor(num / 10000);
        unitCount++;
    }
    
    return result.trim() + "원";
}

    /**
     * 금액 입력 이벤트 핸들러
     */
    function handleRewardInput() {
        if (!rewardInput) return;
        
        const value = parseInt(rewardInput.value) || 0;
        
        // 한글 표시
        if (rewardKorean) {
            rewardKorean.textContent = numberToKorean(value);
        }
        
        // 1천원 단위 검증
        if (value > 0 && value % 1000 !== 0) {
            if (rewardWarning) {
                rewardWarning.style.display = "block";
            }
        } else {
            if (rewardWarning) {
                rewardWarning.style.display = "none";
            }
        }
        
        saveDraft();
    }

    /**
     * 금액 빠른 입력 버튼
     */
    function addRewardAmount(amount) {
        if (!rewardInput) return;
        
        const current = parseInt(rewardInput.value) || 0;
        const newValue = current + amount;
        
        rewardInput.value = newValue;
        handleRewardInput();
    }

    // ==================== Draft (초안) 기능 ====================
    
    async function saveDraft() {
        const imagePromises = selectedFiles.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        });
        const base64Images = await Promise.all(imagePromises);

        const data = {
            title: document.querySelector("input[name='title']")?.value || "",
            descriptions: document.querySelector("textarea[name='descriptions']")?.value || "",
            reward: rewardInput?.value || "",
            category: document.querySelector("select[name='category']")?.value || "",
            deadline: deadlineInput?.value || "",
            tags_input: tagsHidden?.value || "",
            images_data: base64Images,
            // 위치 정보 추가
            location_name: document.getElementById("location_name")?.value || "",
            location_lat: document.querySelector("input[name='location_lat']")?.value || "",
            location_lng: document.querySelector("input[name='location_lng']")?.value || "",
            location_address: document.querySelector("input[name='location_address']")?.value || ""
        };

        try {
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
            console.log("✅ Draft 저장 완료");
        } catch (e) {
            console.warn("Draft 저장 실패: 용량 초과일 수 있습니다.", e);
            delete data.images_data;
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
        }
    }

    async function restoreDraft() {
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

            // 위치 정보 복원
            if (data.location_name) {
                const locNameEl = document.getElementById("location_name");
                const locDisplayEl = document.getElementById("location_name_display");
                if (locNameEl) locNameEl.value = data.location_name;
                if (locDisplayEl) locDisplayEl.value = data.location_name;
            }
            if (data.location_lat) {
                const el = document.querySelector("input[name='location_lat']");
                if (el) el.value = data.location_lat;
            }
            if (data.location_lng) {
                const el = document.querySelector("input[name='location_lng']");
                if (el) el.value = data.location_lng;
            }
            if (data.location_address) {
                const el = document.querySelector("input[name='location_address']");
                if (el) el.value = data.location_address;
            }

            if (tagsHidden && data.tags_input) {
                tagsHidden.value = data.tags_input;
                customTags = data.tags_input.split(",").filter(Boolean);
                renderChips();
            }

            if (data.images_data && data.images_data.length > 0) {
                const restoredFiles = await Promise.all(data.images_data.map(async (base64, idx) => {
                    const res = await fetch(base64);
                    const blob = await res.blob();
                    return new File([blob], `draft_img_${idx}.jpg`, { type: "image/jpeg" });
                }));
                
                selectedFiles = restoredFiles;
                updateFileInput();
                renderPreviews();
            }
            
            // 금액 한글 표시 업데이트
            if (data.reward) {
                handleRewardInput();
            }
            
            initDeadlinePreview();
            console.log("✅ Draft 복원 완료");
        } catch (e) {
            console.error("Draft restore error", e);
        }
    }

    function clearDraft() {
        sessionStorage.removeItem(DRAFT_KEY);
    }

    // ==================== 해시태그 관리 ====================
    
    function renderChips() {
        if (!tagChips) return;
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

    function syncHiddenTags() {
        if (tagsHidden) {
            tagsHidden.value = customTags.join(",");
        }
    }

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

    // ==================== 이미지 미리보기 ====================
    
    function handleFileSelect(e) {
        const newFiles = Array.from(e.target.files);
        
        const remainingSlots = MAX_IMAGES - selectedFiles.length;
        if (newFiles.length > remainingSlots) {
            alert(`이미지는 최대 ${MAX_IMAGES}개까지 업로드할 수 있습니다. (${remainingSlots}개 추가 가능)`);
            return;
        }

        newFiles.forEach(file => {
            if (!file.type.startsWith('image/')) {
                alert(`"${file.name}"은(는) 이미지 파일이 아닙니다.`);
                return;
            }
            selectedFiles.push(file);
        });

        updateFileInput();
        renderPreviews();
        saveDraft();
    }

    function removeImage(index) {
        selectedFiles.splice(index, 1);
        updateFileInput();
        renderPreviews();
        saveDraft();
    }

    function updateFileInput() {
        if (!fileInput) return;
        
        const dt = new DataTransfer();
        selectedFiles.forEach(file => dt.items.add(file));
        fileInput.files = dt.files;
        updatePhotoCount();
    }

    function initExistingImages() {
        const missionId = form.dataset.missionId;
        if (!missionId) return;

        const rawImages = document.getElementById('existing-images-data')?.textContent;
        if (rawImages) {
            existingImages = JSON.parse(rawImages);
            renderPreviews();
        }
    }

    function renderPreviews() {
        if (!previewContainer) return;
        previewContainer.innerHTML = '';

        // 기존 서버 이미지
        existingImages.forEach((img, index) => {
            const preview = document.createElement('div');
            preview.className = 'image-preview-item';
            preview.innerHTML = `
                <div style="position:relative; width:80px; height:80px;">
                    <img src="${img.image}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; opacity: 0.8; border: 2px solid #ddd;">
                    <button type="button" onclick="window.removeExistingImage(${index})" 
                            style="position:absolute; top:-5px; right:-5px; background:#333; color:white; border-radius:50%; border:none; width:20px; height:20px; cursor:pointer; font-size:14px; line-height:1;">
                        ×
                    </button>
                </div>
            `;
            previewContainer.appendChild(preview);
        });

        // 새로 선택한 파일
        selectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.createElement('div');
                preview.className = 'image-preview-item';
                preview.innerHTML = `
                    <div style="position:relative; width:80px; height:80px;">
                        <img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">
                        <button type="button" onclick="window.removeImagePreview(${index})" 
                                style="position:absolute; top:-5px; right:-5px; background:#dc3545; color:white; border-radius:50%; border:none; width:20px; height:20px; cursor:pointer; font-size:14px; line-height:1;">
                            ×
                        </button>
                    </div>
                `;
                previewContainer.appendChild(preview);
            };
            reader.readAsDataURL(file);
        });
        updatePhotoCount();
    }

    function updatePhotoCount() {
        const total = existingImages.length + selectedFiles.length;
        if (photoCount) {
            photoCount.textContent = `사진 (${total}/${MAX_IMAGES})`;
        }
    }

    window.removeExistingImage = function(index) {
        existingImages.splice(index, 1);
        renderPreviews();
        saveDraft();
    };

    // ==================== 마감기한 로직 ====================
    
    function pad2(n) {
        return String(n).padStart(2, "0");
    }

    function toDatetimeLocalValue(d) {
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }

    function updateDeadline(dateObj, is24 = false) {
        if (!deadlineInput || !duePreview) return;
        
        const val = toDatetimeLocalValue(dateObj);
        deadlineInput.value = val;
        
        const hours = is24 && dateObj.getHours() === 23 ? "24:00" : `${pad2(dateObj.getHours())}:${pad2(dateObj.getMinutes())}`;
        duePreview.textContent = `마감기한: ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 ${hours}`;
        
        saveDraft();
    }

    function initDeadlinePreview() {
        if (deadlineInput?.value && duePreview) {
            const d = new Date(deadlineInput.value);
            duePreview.textContent = `마감기한: ${d.getMonth() + 1}월 ${d.getDate()}일 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        }
    }

    // ==================== API 요청 ====================
    
    function getMissionApiUrl(missionId) {
        const BASE_API_PATH = '/api/missions/api';
        return missionId
            ? `${BASE_API_PATH}/${missionId}/update/`
            : `${BASE_API_PATH}/create/`;
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        e.stopPropagation();

        // 금액 검증
        const rewardValue = parseInt(rewardInput?.value) || 0;
        if (rewardValue > 0 && rewardValue % 1000 !== 0) {
            alert("금액은 1천원 단위로 입력해주세요.");
            rewardInput?.focus();
            return;
        }

        const formData = new FormData(form);
        const missionId = form.dataset.missionId;

        // 태그 데이터 정리
        formData.delete('tags_input');
        customTags.forEach(tag => formData.append('__custom_tag_names', tag));

        // 이미지 처리
        formData.delete('images');
        selectedFiles.forEach(file => formData.append('images', file));
        const keepIds = existingImages.map(img => img.id);
        formData.append('keep_images', JSON.stringify(keepIds));

        const apiUrl = getMissionApiUrl(missionId);
        console.log("전송 시도:", { url: apiUrl, mode: missionId ? "수정" : "생성", images: selectedFiles.length });

        try {
            const result = await Auth.postData(apiUrl, formData, true);

            if (result && result.success) {
                alert(missionId ? "성공적으로 수정되었습니다!" : "미션이 등록되었습니다!");
                clearDraft();
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
    
    function initRewardInput() {
        if (!rewardInput) return;
        
        // 입력 이벤트
        rewardInput.addEventListener('input', handleRewardInput);
        
        // 빠른 입력 버튼들
        document.querySelectorAll('.reward-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = parseInt(btn.dataset.amount);
                addRewardAmount(amount);
            });
        });
    }

    function initDeadlineButtons() {
        const btnToday = document.getElementById("btn_due_today");
        const btn3d = document.getElementById("btn_due_3d");
        const btn7d = document.getElementById("btn_due_7d");
        const btnPick = document.getElementById("btn_due_pick");

        if (btnToday) {
            btnToday.onclick = () => {
                const d = new Date();
                d.setHours(23, 59, 0, 0);
                updateDeadline(d, true);
                if (duePickerWrap) duePickerWrap.style.display = "none";
            };
        }

        if (btn3d) {
            btn3d.onclick = () => {
                const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                d.setHours(23, 59, 0, 0);
                updateDeadline(d);
                if (duePickerWrap) duePickerWrap.style.display = "none";
            };
        }

        if (btn7d) {
            btn7d.onclick = () => {
                const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                d.setHours(23, 59, 0, 0);
                updateDeadline(d);
                if (duePickerWrap) duePickerWrap.style.display = "none";
            };
        }

        if (btnPick) {
            btnPick.onclick = () => {
                if (duePickerWrap) {
                    duePickerWrap.style.display = "block";
                    
                    // datetime-local input 생성
                    if (!document.getElementById('due_picker_visible')) {
                        const input = document.createElement('input');
                        input.type = 'datetime-local';
                        input.id = 'due_picker_visible';
                        input.style.cssText = 'width:100%; padding:12px; border:1px solid #D0D5DD; border-radius:8px; font-size:14px;';
                        duePickerWrap.appendChild(input);
                        
                        input.addEventListener('change', () => {
                            if (input.value) {
                                const d = new Date(input.value);
                                updateDeadline(d);
                                deadlineInput.value = input.value;
                            }
                        });
                    }
                }
            };
        }

        if (duePicker) {
            duePicker.onchange = () => {
                if (duePicker.value) {
                    updateDeadline(new Date(duePicker.value));
                }
            };
        }
    }

    function initTagInput() {
        if (tagInput) {
            tagInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTag(tagInput.value);
                    tagInput.value = "";
                }
            });
        }
    }

    function initImagePreview() {
        if (fileInput) {
            fileInput.addEventListener('change', handleFileSelect);
        }
    }

    // ==================== 초기화 ====================
    
    function init() {
        if (!form) {
            console.warn("mission-form을 찾을 수 없습니다.");
            return;
        }

        // 위치 정보 복원
        const locNameEl = document.getElementById("location_name");
        const locDisplayEl = document.getElementById("location_name_display");
        
        if (locNameEl && locNameEl.value && locDisplayEl) {
            locDisplayEl.value = locNameEl.value;
        }

        // 초안 복원
        restoreDraft();

        // 이벤트 리스너 등록
        initRewardInput();
        initTagInput();
        initDeadlineButtons();
        initImagePreview();
        initExistingImages();
        form.addEventListener("submit", handleFormSubmit);

        console.log("✅ mission_form.js 초기화 완료");
    }

    // ==================== 전역 함수 ====================
    
    window.goPickLocation = function () {
        saveDraft();
        const returnUrl = window.location.pathname + window.location.search;
        window.location.href = "/api/missions/location/pick/?return=" + encodeURIComponent(returnUrl);
    };

    window.removeImagePreview = removeImage;

    document.addEventListener("DOMContentLoaded", init);
})();