// Enregistrement du Service Worker (PWA) + détection de mise à jour
// + bandeau d'indicateur de connexion hors-ligne.

(function () {
    let refreshing = false;

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then((reg) => {
                reg.update();
            }).catch((err) => {
                console.error('Échec enregistrement Service Worker:', err);
            });

            // sw.js appelle skipWaiting()/clients.claim() dès l'activation, donc
            // ce changement de contrôleur signale qu'une nouvelle version est en
            // place : on recharge pour que l'utilisateur l'obtienne sans action manuelle.
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                refreshing = true;
                window.location.reload();
            });
        });
    }

    // Bandeau "mode hors-ligne"
    function injectOfflineBanner() {
        const banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.textContent = '⚠️ Mode hors-ligne — données non actualisées';
        banner.style.cssText = [
            'display:none',
            'position:fixed',
            'top:0',
            'left:0',
            'right:0',
            'z-index:9999',
            'background:#B71C1C',
            'color:#fff',
            'text-align:center',
            'padding:6px 12px',
            'font-size:13px',
            'font-family:"Plus Jakarta Sans",sans-serif',
        ].join(';');
        document.body.appendChild(banner);
        return banner;
    }

    function updateOfflineBanner() {
        const banner = document.getElementById('offline-banner') || injectOfflineBanner();
        banner.style.display = navigator.onLine ? 'none' : 'block';
    }

    window.addEventListener('online', updateOfflineBanner);
    window.addEventListener('offline', updateOfflineBanner);
    document.addEventListener('DOMContentLoaded', updateOfflineBanner);
})();
