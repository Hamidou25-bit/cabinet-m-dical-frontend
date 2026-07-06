const API_URL = (location.hostname === "cabinet-babamouneissa.com" || location.hostname === "www.cabinet-babamouneissa.com")
    ? "https://" + location.hostname + "/api"
    : (location.hostname === "51.161.10.252" ? "http://51.161.10.252/api" : "http://localhost:8001");

// Redirige vers la page de connexion si pas de token
function checkAuth() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return null;
    }
    return token;
}

// Wrapper fetch qui ajoute automatiquement le token
async function apiFetch(path, options = {}) {
    const token = localStorage.getItem("token");
    const headers = {
        ...(options.headers || {}),
        "Authorization": "Bearer " + token,
    };
    // Un FormData (upload de fichier) doit garder son Content-Type
    // multipart/boundary auto-généré par le navigateur - ne jamais le forcer en JSON.
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }
    options.headers = headers;
    let response;
    try {
        response = await fetch(API_URL + path, options);
    } catch (err) {
        const offlineError = new Error("Pas de connexion internet — action impossible hors-ligne.");
        offlineError.offline = true;
        throw offlineError;
    }

    if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("nom_utilisateur");
        localStorage.removeItem("role");
        window.location.href = "login.html";
        return null;
    }

    if (!response.ok) {
        let detail = `Erreur ${response.status}`;
        try {
            const body = await response.json();
            if (body.detail) detail = body.detail;
        } catch (e) {}
        const error = new Error(detail);
        error.status = response.status;
        error.detail = detail;
        throw error;
    }

    return response;
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("nom_utilisateur");
    localStorage.removeItem("role");
    try { if (typeof iaHistory !== 'undefined') iaHistory = []; } catch(e) {}
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    window.location.href = "login.html";
}

checkAuth();
