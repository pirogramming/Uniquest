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
    let existingImages = [];  // 수정 시 기존 이미지 관리를 위한 배열

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

    // ==================== Draft (초안) 기능 ====================
    
// ==================== Draft (초안) 기능 ====================
    
    async function saveDraft() {
        // 이미지를 Base64 배열로 변환
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
            reward: document.querySelector("input[name='reward']")?.value || "",
            category: document.querySelector("select[name='category']")?.value || "",
            deadline: deadlineInput?.value || "",
            tags_input: tagsHidden?.value || "",
            images_data: base64Images // Base64 데이터 추가
        };

        try {
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn("Draft 저장 실패: 용량 초과일 수 있습니다.", e);
            // 용량 초과 시 이미지 제외하고 텍스트만이라도 저장
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

            if (tagsHidden && data.tags_input) {
                tagsHidden.value = data.tags_input;
                customTags = data.tags_input.split(",").filter(Boolean);
                renderChips();
            }

            // --- 이미지 복원 로직 추가 ---
            if (data.images_data && data.images_data.length > 0) {
                // Base64를 다시 File 객체로 변환하여 selectedFiles에 주입
                const restoredFiles = await Promise.all(data.images_data.map(async (base64, idx) => {
                    const res = await fetch(base64);
                    const blob = await res.blob();
                    return new File([blob], `draft_img_${idx}.jpg`, { type: "image/jpeg" });
                }));
                
                selectedFiles = restoredFiles;
                updateFileInput();
                renderPreviews();
            }
            // ---------------------------
            
            initDeadlinePreview();
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
    
    /**
     * 파일 선택 시 이벤트 핸들러
     */
    function handleFileSelect(e) {
        const newFiles = Array.from(e.target.files);
        
        // 최대 개수 제한
        const remainingSlots = MAX_IMAGES - selectedFiles.length;
        if (newFiles.length > remainingSlots) {
            alert(`이미지는 최대 ${MAX_IMAGES}개까지 업로드할 수 있습니다. (${remainingSlots}개 추가 가능)`);
            return;
        }

        // 이미지 파일만 필터링
        newFiles.forEach(file => {
            if (!file.type.startsWith('image/')) {
                alert(`"${file.name}"은(는) 이미지 파일이 아닙니다.`);
                return;
            }
            selectedFiles.push(file);
        });

        updateFileInput();
        renderPreviews();
    }

    /**
     * 이미지 삭제
     */
    function removeImage(index) {
        selectedFiles.splice(index, 1);
        updateFileInput();
        renderPreviews();
    }

    /**
     * FileInput 업데이트
     */
    function updateFileInput() {
        if (!fileInput) return;
        
        const dt = new DataTransfer();
        selectedFiles.forEach(file => dt.items.add(file));
        fileInput.files = dt.files;
        updatePhotoCount();
    }

    /**
     * [추가] 페이지 로드 시 기존 이미지 데이터를 가져와 세팅하는 함수
     */
    function initExistingImages() {
        const missionId = form.dataset.missionId;
        if (!missionId) return; // 수정 모드가 아니면 중단

        // HTML 어딘가에 기존 이미지 데이터를 JSON으로 박아두거나, API로 가져와야 합니다.
        // 여기서는 이미 서버에서 mission 객체를 전달받았다고 가정하고 
        // 전역 변수나 dataset에서 추출하는 방식을 제안합니다.
        const rawImages = document.getElementById('existing-images-data')?.textContent;
        if (rawImages) {
            existingImages = JSON.parse(rawImages);
            renderPreviews();
        }
    }
/**
     * 미리보기 렌더링 (기존 이미지 + 새 파일 통합)
     */
    function renderPreviews() {
        if (!previewContainer) return;
        previewContainer.innerHTML = '';

        // 1. 기존 서버 이미지 렌더링
        existingImages.forEach((img, index) => {
            const preview = document.createElement('div');
            preview.className = 'image-preview-item';
            preview.innerHTML = `
                <div style="position:relative; width:80px; height:80px;">
                    <img src="${img.image}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; opacity: 0.8; border: 2px solid #ddd;">
                    <button type="button" onclick="window.removeExistingImage(${index})" 
                            style="position:absolute; top:-5px; right:-5px; background:#333; color:white; border-radius:50%; border:none; width:20px; height:20px; cursor:pointer;">
                        ×
                    </button>
                </div>
            `;
            previewContainer.appendChild(preview);
        });

        // 2. 새로 선택한 파일 렌더링
        selectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.createElement('div');
                preview.className = 'image-preview-item';
                preview.innerHTML = `
                    <div style="position:relative; width:80px; height:80px;">
                        <img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">
                        <button type="button" onclick="window.removeImagePreview(${index})" 
                                style="position:absolute; top:-5px; right:-5px; background:red; color:white; border-radius:50%; border:none; width:20px; height:20px; cursor:pointer;">
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
    // 전역 함수 등록
    window.removeExistingImage = function(index) {
        existingImages.splice(index, 1);
        renderPreviews();
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
        
        duePreview.textContent = `마감기한: ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 ` +
            (is24 && dateObj.getHours() === 23 ? "24:00" : `${pad2(dateObj.getHours())}:${pad2(d.getMinutes())}`);
        
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

        const formData = new FormData(form);
        const missionId = form.dataset.missionId;

        // 태그 데이터 정리
        formData.delete('tags_input');
        customTags.forEach(tag => formData.append('__custom_tag_names', tag));

        formData.delete('images');
        selectedFiles.forEach(file => formData.append('images', file));
        const keepIds = existingImages.map(img => img.id);
        formData.append('keep_images', JSON.stringify(keepIds));
        // API URL 결정
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
                updateDeadline(d);
                if (duePickerWrap) duePickerWrap.style.display = "none";
            };
        }

        if (btn7d) {
            btn7d.onclick = () => {
                const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                updateDeadline(d);
                if (duePickerWrap) duePickerWrap.style.display = "none";
            };
        }

        if (btnPick) {
            btnPick.onclick = () => {
                if (duePickerWrap) duePickerWrap.style.display = "block";
                if (duePicker) duePicker.focus();
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

    // 이미지 삭제 함수 전역 노출 (HTML onclick에서 호출)
    window.removeImagePreview = removeImage;

    // 문서 로드 완료 시 실행
    document.addEventListener("DOMContentLoaded", init);
})();