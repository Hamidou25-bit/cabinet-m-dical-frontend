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
    options.headers = {
        ...(options.headers || {}),
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    };
    const response = await fetch(API_URL + path, options);

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
    window.location.href = "login.html";
}

checkAuth();
