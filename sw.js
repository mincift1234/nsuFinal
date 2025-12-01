// sw.js

const CACHE_NAME = "jup-cache-v1";

// 오프라인용으로 캐시해둘 파일 목록 (필요하면 추가/수정)
const APP_SHELL = [
    "/", // Netlify 루트
    "/index.html",
    "/styles.css",
    "/mobile.css",
    "/script.js",
    "/mobile-menu.js",
    "/register.html",
    "/register.js",
    "/profile.html",
    "/profile.js",
    "/icons/icon-192.png",
    "/icons/icon-512.png"
];

// 설치 단계: 앱 껍데기 캐시
self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

// 활성화 단계: 오래된 캐시 정리
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            )
        )
    );
    self.clients.claim();
});

// 요청 가로채기
self.addEventListener("fetch", (event) => {
    // GET 이외는 건드리지 않음 (Firestore, POST 등은 그대로 네트워크)
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);

    // 같은 도메인만 처리
    if (url.origin !== self.location.origin) return;

    // HTML은 네트워크 우선 -> 실패 시 캐시
    if (url.pathname === "/" || url.pathname.endsWith(".html")) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // 나머지 정적 파일(CSS/JS/이미지)은 캐시 우선
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;

            return fetch(event.request).then((response) => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                return response;
            });
        })
    );
});


