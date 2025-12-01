// ─────────────────────────────────────────────
//  Firebase
// ─────────────────────────────────────────────
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp,
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
    getStorage,
    ref as sRef,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyCpE_MfBizTqyY2v_cQOrBX4q6KhIi5mrk",
    authDomain: "something-e578a.firebaseapp.com",
    projectId: "something-e578a",
    storageBucket: "something-e578a.firebasestorage.app",
    messagingSenderId: "879471143827",
    appId: "1:879471143827:web:33e2c1001e051f05265666",
    measurementId: "G-RHRK7NJ1FN"
};
// 이미 초기화된 앱 재사용 (중복 init 방지). window.firebaseConfig를 쓰는 기존 구조와 호환
const cfg = window.firebaseConfig || firebaseConfig; // window.*가 없으면 내부 객체 사용
const app = getApps().length ? getApp() : initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// ─────────────────────────────────────────────
//  엘리먼트 참조
// ─────────────────────────────────────────────
const form = document.getElementById("postForm");
const titleEl = document.getElementById("title");
const categoryEl = document.getElementById("category");
const locationEl = document.getElementById("location");
const statusEl = document.getElementById("status");
const descEl = document.getElementById("description");
const dateEl = document.getElementById("date");
const dateTypeEls = [...document.querySelectorAll("input[name='dateType']")];
const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const submitBtn = document.getElementById("submitBtn");
const mosaicToggle = document.getElementById("mosaicToggle"); // 있으면 사용, 없으면 무시

// ─────────────────────────────────────────────
//  헤더 로그인/프로필 표시 제어
// ─────────────────────────────────────────────
function setHeaderAuthUI(user) {
    const loginBtn = document.getElementById("loginBtn");
    const userAvatar = document.getElementById("userAvatar");
    const profileMenu = document.getElementById("profileMenu");

    if (user) {
        if (loginBtn) loginBtn.style.display = "none";
        if (userAvatar) {
            userAvatar.style.display = "inline-block";
            userAvatar.width = 32;
            userAvatar.height = 32;
            userAvatar.style.borderRadius = "50%";
            userAvatar.src = user.photoURL || "";
        }
    } else {
        if (userAvatar) {
            userAvatar.style.display = "none";
            userAvatar.removeAttribute("src");
        }
        if (loginBtn) loginBtn.style.display = "inline-flex";
        if (profileMenu) {
            profileMenu.classList.add("hidden");
            profileMenu.setAttribute("aria-hidden", "true");
        }
    }
}

function setupHeaderAuthHandlers() {
    const loginBtn = document.getElementById("loginBtn");
    const userAvatar = document.getElementById("userAvatar");
    const profileMenu = document.getElementById("profileMenu");
    const logoutItem = document.getElementById("profile-logout");

    loginBtn?.addEventListener("click", async () => {
        try {
            await signInWithPopup(auth, provider);
        } catch (e) {}
    });

    userAvatar?.addEventListener("click", () => {
        if (!profileMenu) return;
        const hidden = profileMenu.classList.toggle("hidden");
        profileMenu.setAttribute("aria-hidden", hidden ? "true" : "false");
    });

    logoutItem?.addEventListener("click", async () => {
        try {
            await signOut(auth);
        } catch (e) {}
    });

    document.addEventListener(
        "click",
        (e) => {
            if (!profileMenu) return;
            const avatar = document.getElementById("userAvatar");
            if (profileMenu.classList.contains("hidden")) return;
            const inside = profileMenu.contains(e.target) || avatar?.contains(e.target);
            if (!inside) {
                profileMenu.classList.add("hidden");
                profileMenu.setAttribute("aria-hidden", "true");
            }
        },
        true
    );
}

// ─────────────────────────────────────────────
//  유틸
// ─────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const editId = params.get("edit"); // 있으면 수정 모드

let currentUser = null;
let existingImageUrl = null; // 수정 모드에서 기존 이미지 유지용
let loadedOwnerUid = null; // 수정 모드에서 소유자 검증용

function toEpoch(ts) {
    if (!ts) return NaN;
    if (typeof ts === "number") return ts;
    if (typeof ts === "string") return Date.parse(ts);
    if (typeof ts.toDate === "function") return ts.toDate().getTime();
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
    return NaN;
}
function toDateInputValue(ts) {
    const ms = toEpoch(ts);
    if (!Number.isFinite(ms)) return "";
    const d = new Date(ms);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
}
function setBusy(on) {
    if (!submitBtn) return;
    if (on) {
        submitBtn.setAttribute("disabled", "true");
    } else {
        submitBtn.removeAttribute("disabled");
    }
}

// ─────────────────────────────────────────────
//  이미지 프리뷰(단일 파일)
// ─────────────────────────────────────────────
imageInput?.addEventListener("change", () => {
    preview.innerHTML = "";
    const f = imageInput.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.src = url;
    img.style.width = "140px";
    img.style.height = "105px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "10px";
    img.style.boxShadow = "0 6px 16px rgba(0,0,0,.35)";
    preview.appendChild(img);
});

// ─────────────────────────────────────────────
//  업로드 (단일 이미지) — 기존 프로젝트 흐름과 호환
//  - 파일이 없으면 [] 반환
//  - 파일이 있으면 Storage 업로드 후 [url] 반환
//  - 모자이크 옵션은 서버/클라이언트 전처리가 없으면 그대로 업로드
// ─────────────────────────────────────────────
async function uploadImageIfNeeded(/* applyMosaic */) {
    const f = imageInput?.files?.[0];
    if (!f) return [];
    const uid = (auth.currentUser && auth.currentUser.uid) || "anon";
    const path = `items/${uid}/${Date.now()}_${encodeURIComponent(f.name)}`;
    const ref = sRef(storage, path);
    await uploadBytes(ref, f);
    const url = await getDownloadURL(ref);
    return [url];
}

// ─────────────────────────────────────────────
//  수정 모드 로더
// ─────────────────────────────────────────────
async function loadForEdit(id) {
    try {
        const ref = doc(db, "items", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            alert("문서를 찾을 수 없어요.");
            location.href = "index.html";
            return;
        }
        const data = snap.data();

        // 소유자 확인
        loadedOwnerUid = data.ownerUid || data.uid || data.authorUid || null;

        // 필드 채우기
        titleEl.value = data.title || "";
        categoryEl.value = data.category || "";
        locationEl.value = data.location || "";
        statusEl.value = data.status || "";
        descEl.value = data.description || "";

        const t = data.eventAt || data.lostAt || data.foundAt || data.createdAt;
        dateEl.value = toDateInputValue(t);

        const dt = data.dateType === "lost" ? "lost" : "found";
        (dateTypeEls.find((r) => r.value === dt) || dateTypeEls[0]).checked = true;

        // 이미지 미리보기
        existingImageUrl = (data.images && data.images[0]) || null;
        preview.innerHTML = "";
        if (existingImageUrl) {
            const img = new Image();
            img.src = existingImageUrl;
            img.style.width = "140px";
            img.style.height = "105px";
            img.style.objectFit = "cover";
            img.style.borderRadius = "10px";
            img.style.boxShadow = "0 6px 16px rgba(0,0,0,.35)";
            preview.appendChild(img);
        }

        // 라벨 변경
        const h2 = document.querySelector(".page-heading");
        if (h2) h2.textContent = "글 수정";
        if (submitBtn) submitBtn.textContent = "수정 저장";
    } catch (err) {
        console.error(err);
        alert("수정 데이터를 불러오지 못했습니다.");
    }
}

// ─────────────────────────────────────────────
//  인증 상태
// ─────────────────────────────────────────────
onAuthStateChanged(auth, async (u) => {
    currentUser = u || null;
    setHeaderAuthUI(u);
    if (editId && currentUser) {
        await loadForEdit(editId);
    }
});

if (editId) {
    loadForEdit(editId);
} // 로그인 안 돼 있어도 일단 내용 채워줌

setupHeaderAuthHandlers();

// ─────────────────────────────────────────────
//  제출
// ─────────────────────────────────────────────
form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 로그인 보장
    if (!auth.currentUser) {
        try {
            await signInWithPopup(auth, provider);
        } catch {
            return;
        }
        if (!auth.currentUser) return;
    }

    // 값 수집/검증
    const title = (titleEl.value || "").trim();
    const category = (categoryEl.value || "").trim();
    const locationVal = (locationEl.value || "").trim();
    const status = (statusEl.value || "").trim();
    const description = (descEl.value || "").trim();
    const dateValue = dateEl.value || "";
    const dateType = dateTypeEls.find((r) => r.checked)?.value || "found";
    const applyMosaic = !!(mosaicToggle && mosaicToggle.checked);

    if (!title) return alert("제목을 입력하세요.");
    if (!category) return alert("카테고리를 선택하세요.");
    if (!status) return alert("상태를 선택하세요.");
    if (!dateValue) return alert("날짜를 선택하세요.");

    // 표시용 기준 날짜: epoch(ms)
    const eventAt = new Date(`${dateValue}T00:00:00`).getTime();

    setBusy(true);
    try {
        // 새 파일 있으면 업로드, 없으면 기존 유지
        const uploaded = await uploadImageIfNeeded(applyMosaic); // [] or [url]
        const images = uploaded.length ? uploaded : existingImageUrl ? [existingImageUrl] : [];

        if (editId) {
            // 수정 모드: 소유자 확인 후 update
            if (!currentUser || currentUser.uid !== loadedOwnerUid) {
                alert("본인 글만 수정할 수 있습니다.");
                return;
            }
            await updateDoc(doc(db, "items", editId), {
                title,
                category,
                location: locationVal,
                status,
                description,
                dateType,
                eventAt,
                images,
                updatedAt: serverTimestamp()
            });
            alert("수정되었습니다.");
            location.href = "index.html";
        } else {
            // 신규 작성
            await addDoc(collection(db, "items"), {
                title,
                category,
                location: locationVal,
                status,
                description,
                dateType,
                eventAt,
                ownerUid: auth.currentUser.uid,
                ownerName: auth.currentUser.displayName || "",
                ownerPhoto: auth.currentUser.photoURL || "",
                images,
                createdAt: serverTimestamp()
            });
            alert("등록되었습니다.");
            location.href = "index.html";
        }
    } catch (err) {
        console.error(err);
        alert("저장 실패: " + (err.message || err));
    } finally {
        setBusy(false);
    }
});
