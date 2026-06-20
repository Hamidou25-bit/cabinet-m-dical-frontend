// Service Worker — Cabinet Médical BabaMouneissa (PWA)
// Stratégie : network-first avec repli sur le cache pour les requêtes GET
// (app shell + API), aucune mise en cache pour les requêtes de mutation
// (POST/PUT/PATCH/DELETE) ni pour /auth/login.

const CACHE_PREFIX = 'babamouneissa-';

const APP_SHELL = [
    '/',
    '/index.html',
    '/login.html',
    '/manifest.json',
    '/css/style.css',
    '/js/app.js',
    '/js/auth.js',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
];

// Le nom du cache inclut la version de build (fichier généré à chaque
// déploiement par deploy-frontend.sh) afin que chaque nouveau déploiement
// invalide automatiquement les anciens caches, sans intervention manuelle.
// Résolu une seule fois par cycle de vie du service worker (mémorisé ici)
// pour éviter de refaire une requête réseau à chaque fetch intercepté.
let cachedCacheName = null;

async function getCacheName() {
    if (cachedCacheName) return cachedCacheName;
    try {
        const res = await fetch('/version.txt', { cache: 'no-store' });
        const version = (await res.text()).trim();
        cachedCacheName = CACHE_PREFIX + (version || 'dev');
    } catch (err) {
        cachedCacheName = CACHE_PREFIX + 'dev';
    }
    return cachedCacheName;
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cacheName = await getCacheName();
            const cache = await caches.open(cacheName);
            await Promise.all(
                APP_SHELL.map((url) => cache.add(url).catch(() => {}))
            );
            await self.skipWaiting();
        })()
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const cacheName = await getCacheName();
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((key) => key.startsWith(CACHE_PREFIX) && key !== cacheName)
                    .map((key) => caches.delete(key))
            );
            await self.clients.claim();
        })()
    );
});

async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        // cache: 'no-store' contourne le cache HTTP du navigateur (qui peut
        // appliquer une fraîcheur heuristique en l'absence d'en-tête
        // Cache-Control explicite côté serveur) - sans ça, "network-first"
        // peut silencieusement renvoyer une réponse HTTP périmée sans même
        // toucher le réseau, retardant la propagation des déploiements.
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw err;
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // On n'intercepte que les requêtes vers notre propre origine (app shell
    // + API via le proxy Nginx /api/) ; les ressources tierces (CDN) suivent
    // le comportement réseau/cache HTTP normal du navigateur.
    if (url.origin !== self.location.origin) {
        return;
    }

    // Jamais de cache pour les mutations, la connexion, ni pour le fichier
    // de version lui-même (évite une boucle de récursion avec getCacheName()).
    if (request.method !== 'GET' || url.pathname === '/api/auth/login' || url.pathname === '/version.txt') {
        return;
    }

    event.respondWith(
        (async () => {
            const cacheName = await getCacheName();
            return networkFirst(request, cacheName);
        })()
    );
});
