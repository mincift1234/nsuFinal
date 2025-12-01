// mobile-menu.js

const hamburger = document.querySelector(".hamburger");
const mobileMenuWrap = document.querySelector(".mobile-menu-wrap");
const closeMenu = document.querySelector(".close-menu");
const overlay = document.querySelector(".mobile-menu-overlay");
const mobileSearchInput = document.getElementById("mobileSearchInput");
const mobileWriteBtn = document.getElementById("mobileWriteBtn");
const mobileMailBtn = document.getElementById("mobileMailBtn");

function closeMobileMenu() {
  mobileMenuWrap?.classList.remove("active");
}

// 메뉴 열기 / 닫기
hamburger?.addEventListener("click", () => {
  mobileMenuWrap?.classList.add("active");
});
closeMenu?.addEventListener("click", closeMobileMenu);
overlay?.addEventListener("click", closeMobileMenu);

// 글쓰기 버튼: register.html로 이동
mobileWriteBtn?.addEventListener("click", () => {
  closeMobileMenu();
  window.location.href = "register.html";
});

// 메일함 버튼: 데스크탑과 동일하게 쪽지 모달 열기
mobileMailBtn?.addEventListener("click", () => {
  closeMobileMenu();

  const inboxBtn = document.getElementById("inboxBtn");
  if (inboxBtn) {
    // index.html에 있을 때: 기존 쪽지 버튼 클릭과 동일 효과
    inboxBtn.click();
  } else {
    // (혹시 다른 페이지에서 눌렀다면) 메인으로 보내기
    window.location.href = "index.html#openInbox";
  }
});

// 검색창: 엔터 치면 검색
mobileSearchInput?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  const q = mobileSearchInput.value.trim();
  if (!q) return;

  // index 페이지면 기존 검색 폼과 연동
  if (
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname === "/" ||
    window.location.pathname === ""
  ) {
    const mainSearch = document.getElementById("searchInput");
    const searchForm = document.getElementById("searchForm");
    if (mainSearch && searchForm) {
      mainSearch.value = q;
      searchForm.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  } else {
    // 그 외 페이지에서는 index로 쿼리 전달
    window.location.href = "index.html?q=" + encodeURIComponent(q);
  }

  closeMobileMenu();
});
