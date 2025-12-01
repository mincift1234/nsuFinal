// profile.js (전체 교체본 — 복사해서 덮어쓰기)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    deleteUser,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    orderBy,
    getDocs,
    deleteDoc,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
    getStorage,
    ref as sRef,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

// --- Firebase 설정 (storageBucket: appspot.com 확인)
const firebaseConfig = {
    apiKey: "AIzaSyCpE_MfBizTqyY2v_cQOrBX4q6KhIi5mrk",
    authDomain: "something-e578a.firebaseapp.com",
    projectId: "something-e578a",
    storageBucket: "something-e578a.appspot.com",
    messagingSenderId: "879471143827",
    appId: "1:879471143827:web:33e2c1001e051f05265666",
    measurementId: "G-RHRK7NJ1FN"
};

const cfg = window.firebaseConfig ?? firebaseConfig; // 하나로 통일
const app = getApps().length ? getApp() : initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app, `gs://${cfg.storageBucket}`); // cfg 재사용
const provider = new GoogleAuthProvider();

// 간편 셀렉터(문서 준비 후 사용)
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// 유연한 id/fallback 헬퍼: 여러 셀렉터 중 첫 발견된 것을 반환
function pick(...selectors) {
    for (const s of selectors) {
        if (!s) continue;
        const el = typeof s === "string" && s.startsWith("#") ? document.querySelector(s) : document.querySelector(s);
        if (el) return el;
    }
    return null;
}

let currentUser = null;
const DEFAULT_PHOTO = "https://via.placeholder.com/160?text=USER";
let ORIGINAL_PHOTO_URL = null;

document.addEventListener("DOMContentLoaded", () => {
    // --- 요소 선택 (fallback 포함)
    const profilePhoto = pick("#profilePhoto", "img.profile-photo");
    const photoInput = pick("#photoInput", "input[type=file]");
    const btnChoosePhoto = pick("#btnChoosePhoto", "#changePhotoBtn");
    const displayNameInput = pick("#displayName", "#nicknameInput", 'input[name="displayName"]');
    const saveNameBtn = pick("#saveNameBtn", "#saveBtn");
    const userEmailEl = pick("#userEmail", "#emailText");
    const createdAtEl = pick("#createdAt", "#joinedText");
    const myPostsList = pick("#myPostsList", ".profile-posts");
    const deleteAccountBtn = pick("#deleteAccountBtn", "#deleteBtn");

    // header
    const loginBtn = pick("#loginBtn", ".auth-btn");
    const userBtn = pick("#userBtn");
    const userAvatarSmall = document.getElementById("userAvatarSmall") || document.getElementById("userAvatar");
    const mainAvatar = document.getElementById("userAvatar") || document.getElementById("userAvatarSmall");

    // 빠른 디버그 로그(있는지 확인)
    [
        ["profilePhoto", !!profilePhoto],
        ["photoInput", !!photoInput],
        ["btnChoosePhoto", !!btnChoosePhoto],
        ["displayName", !!displayNameInput],
        ["saveNameBtn", !!saveNameBtn],
        ["userEmail", !!userEmailEl],
        ["createdAt", !!createdAtEl],
        ["myPostsList", !!myPostsList],
        ["deleteAccountBtn", !!deleteAccountBtn]
    ].forEach(([name, ok]) => {
        if (!ok) console.warn(`profile.js: DOM element missing -> #${name}`);
    });

    // auth 상태 변화 처리
    onAuthStateChanged(auth, async (user) => {
        console.log("onAuthStateChanged ->", user ? "로그인된 유저" : "로그아웃");
        if (!user) {
            currentUser = null;
            if (loginBtn) {
                loginBtn.style.display = "inline-block";
                loginBtn.style.opacity = "1";
            }
            if (userBtn) userBtn.style.display = "none";
            if (mainAvatar) mainAvatar.style.display = "none";
            if (profilePhoto) profilePhoto.src = DEFAULT_PHOTO;
            if (displayNameInput) displayNameInput.value = "";
            if (userEmailEl) userEmailEl.textContent = "-";
            if (createdAtEl) createdAtEl.textContent = "-";
            if (myPostsList) myPostsList.innerHTML = `<div class="muted">로그인이 필요합니다.</div>`;
            return;
        }

        currentUser = user;
        try {
            ORIGINAL_PHOTO_URL = await ensureUserDocWithOriginalPhoto(user);
        } catch (e) {
            console.warn("original photo check failed:", e);
        }
        renderProfile(user);

        // 헤더 동기화
        try {
            if (loginBtn) loginBtn.style.display = "none";
            if (userBtn) userBtn.style.display = "inline-flex";
            if (userAvatarSmall && user.photoURL) userAvatarSmall.src = user.photoURL;
            if (mainAvatar && user.photoURL) mainAvatar.src = user.photoURL;
        } catch (e) {
            console.warn("header sync failed:", e);
        }

        // 내 글 불러오기 (없으면 숨김 그대로)
        loadMyPosts(user.uid);
    });

    function renderProfile(user) {
        const currentPhoto = user.photoURL || ORIGINAL_PHOTO_URL || DEFAULT_PHOTO;
        if (profilePhoto) profilePhoto.src = currentPhoto;
        if (displayNameInput) displayNameInput.value = user.displayName || "";
        if (userEmailEl) userEmailEl.textContent = user.email || "-";
        if (createdAtEl) createdAtEl.textContent = user.metadata?.creationTime || "-";
        document.dispatchEvent(
            new CustomEvent("profile-updated", {
                detail: { photoURL: currentPhoto, displayName: user.displayName || "" }
            })
        );
    }

    // 저장(닉네임)
    if (saveNameBtn) {
        saveNameBtn.addEventListener("click", async () => {
            if (!currentUser) return alert("로그인 필요합니다.");
            const newName = ((displayNameInput && displayNameInput.value) || "").trim();
            if (!newName) return alert("닉네임을 입력하세요.");
            saveNameBtn.disabled = true;
            saveNameBtn.textContent = "저장 중...";
            try {
                await updateProfile(currentUser, { displayName: newName });
                const nameMsg = document.getElementById("nameMsg");
                if (nameMsg) nameMsg.textContent = "저장되었습니다.";
                document.dispatchEvent(new CustomEvent("profile-updated", { detail: { displayName: newName } }));
                setTimeout(() => {
                    if (nameMsg) nameMsg.textContent = "";
                }, 2000);
            } catch (e) {
                alert("저장 실패: " + (e.message || e));
            } finally {
                saveNameBtn.disabled = false;
                saveNameBtn.textContent = "저장";
            }
        });
    }

    // 사진 변경
    if (btnChoosePhoto) btnChoosePhoto.addEventListener("click", () => photoInput?.click());

    if (photoInput) {
        photoInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const uid = currentUser?.uid;
            if (!uid) {
                alert("로그인 후 이용 가능합니다.");
                return;
            }

            // 안전 파일명(공백/한글/특수문자)
            const safeName =
                `${Date.now()}_` +
                encodeURIComponent(file.name)
                    .replace(/[!'()]/g, escape)
                    .replace(/\*/g, "%2A");

            const storageRef = sRef(storage, `profiles/${uid}/${safeName}`);
            const meta = { contentType: file.type || "application/octet-stream" };

            if (profilePhoto) profilePhoto.style.opacity = 0.6;

            try {
                await uploadBytes(storageRef, file, meta); // 단순 업로드 (preflight 최소화)
                const url = await getDownloadURL(storageRef);

                await updateProfile(currentUser, { photoURL: url });
                try {
                    await updateDoc(doc(db, "users", uid), { currentPhoto: url });
                } catch (_) {}

                if (profilePhoto) profilePhoto.src = url;
                document.dispatchEvent(new CustomEvent("profile-updated", { detail: { photoURL: url } }));
                alert("프로필 사진이 업데이트되었습니다.");
            } catch (err) {
                console.error("업로드 실패:", err);
                alert("업로드 실패: " + (err.message || err));
            } finally {
                if (profilePhoto) profilePhoto.style.opacity = 1;
                photoInput.value = "";
            }
        });
    }

    // 내 글 불러오기 (선택적)
    async function loadMyPosts(uid) {
        if (!myPostsList) return;
        myPostsList.innerHTML = `<div class="muted">불러오는 중...</div>`;
        try {
            const col = collection(db, "items");
            let q = query(col, orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const mine = docs.filter((d) => d.ownerUid === uid || d.uid === uid || d.authorUid === uid);
            if (mine.length === 0) {
                myPostsList.innerHTML = `<div class="muted">등록한 글이 없습니다.</div>`;
                return;
            }
            myPostsList.innerHTML = mine.map(itemRow).join("");
            $$(".btn-delete-post").forEach((btn) => btn.addEventListener("click", onDeletePost));
            $$(".btn-edit-post").forEach((btn) => btn.addEventListener("click", onEditPost));
        } catch (e) {
            console.error(e);
            myPostsList.innerHTML = `<div class="muted">내 글을 불러오지 못했습니다.</div>`;
        }
    }

    function itemRow(it) {
        const img = (it.images && it.images[0]) || "https://picsum.photos/seed/placeholder/200/140";
        const title = it.title || "제목 없음";
        const time = it.createdAt ? new Date(it.createdAt).toLocaleString() : "-";
        return `
      <div class="post-row" data-id="${it.id}">
        <img src="${img}" alt="${title}">
        <div>
          <div class="title">${title}</div>
          <div class="meta">${it.location || "-"} · ${time}</div>
        </div>
        <div class="post-actions">
          <button class="chip chip--ghost btn-edit-post" data-id="${it.id}">수정</button>
          <button class="chip btn-delete-post" style="background:#c94a4a;border-color:#b33a3a" data-id="${it.id}">삭제</button>
        </div>
      </div>
    `;
    }

    async function onDeletePost(ev) {
        const id = ev.currentTarget.dataset.id;
        if (!confirm("이 글을 정말 삭제하시겠어요?")) return;
        try {
            await deleteDoc(doc(db, "items", id));
            ev.currentTarget.closest(".post-row")?.remove();
            alert("삭제되었습니다.");
        } catch (e) {
            console.error(e);
            alert("삭제 실패: " + e.message);
        }
    }

    function onEditPost(ev) {
        const id = ev.currentTarget.dataset.id;
        location.href = `register.html?edit=${id}`;
    }

    // 계정 탈퇴
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener("click", async () => {
            if (!currentUser) return alert("로그인 필요");
            if (!confirm("정말로 회원 탈퇴를 진행하시겠습니까? (복구 불가)")) return;
            try {
                await deleteUser(auth.currentUser);
                alert("회원 탈퇴가 완료되었습니다.");
                location.href = "index.html";
            } catch (e) {
                console.error(e);
                alert("회원 탈퇴 실패: " + (e.message || e) + "\n(재인증이 필요할 수 있습니다.)");
            }
        });
    }
}); // DOMContentLoaded

// users/{uid} 문서에 originalPhoto가 없으면 채움
async function ensureUserDocWithOriginalPhoto(user) {
    if (!user || !user.uid) return null;
    const userRef = doc(db, "users", user.uid);
    try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            const orig = user.photoURL || null;
            await setDoc(userRef, { originalPhoto: orig, createdAt: serverTimestamp() });
            return orig;
        } else {
            const data = snap.data();
            if ((!data.originalPhoto || data.originalPhoto === null) && user.photoURL) {
                try {
                    await updateDoc(userRef, { originalPhoto: user.photoURL });
                } catch (e) {}
                return user.photoURL;
            }
            return data.originalPhoto || null;
        }
    } catch (err) {
        console.error("ensureUserDoc error:", err);
        return null;
    }
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").catch(function (err) {
            console.error("Service Worker 등록 실패:", err);
        });
    });

}

