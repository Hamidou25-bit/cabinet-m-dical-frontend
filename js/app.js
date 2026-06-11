const API = 'http://51.161.10.252:8000';

let patientsData = [];
let stockData = [];

// Date courante
document.getElementById('current-date').textContent = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// Navigation
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    event.currentTarget.classList.add('active');

    const titles = {
        dashboard: 'Tableau de bord',
        patients: 'Patients',
        consultations: 'Consultations',
        stock: 'Stock'
    };
    document.getElementById('page-title').textContent = titles[page];

    if (page === 'patients') loadPatients();
    if (page === 'consultations') loadConsultations();
    if (page === 'stock') loadStock();
}

// Modal
function openModal(id) {
    document.getElementById(id).classList.add('active');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// DASHBOARD
async function loadDashboard() {
    try {
        const [patients, consultations, stock, alertes] = await Promise.all([
            fetch(`${API}/patients`).then(r => r.json()),
            fetch(`${API}/consultations`).then(r => r.json()),
            fetch(`${API}/stock`).then(r => r.json()),
            fetch(`${API}/stock/alertes`).then(r => r.json())
        ]);

        document.getElementById('stat-patients').textContent = patients.length;
        document.getElementById('stat-consultations').textContent = consultations.length;
        document.getElementById('stat-stock').textContent = stock.length;
        document.getElementById('stat-alertes').textContent = alertes.length;

        // Dernières consultations
        const recent = consultations.slice(0, 10);
        const tbody = document.getElementById('recent-consultations');
        tbody.innerHTML = recent.map(c => `
            <tr>
                <td>${c.date_consult || ''}</td>
                <td>${c.nom || ''} ${c.prenom || ''}</td>
                <td>${c.motif || '-'}</td>
                <td>${(c.montant_total || 0).toLocaleString()} FCFA</td>
            </tr>
        `).join('');
    } catch(e) {
        console.error('Erreur dashboard:', e);
    }
}

// PATIENTS
async function loadPatients() {
    try {
        const data = await fetch(`${API}/patients`).then(r => r.json());
        patientsData = data;
        renderPatients(data);
    } catch(e) {
        document.getElementById('table-patients').innerHTML = '<tr><td colspan="6">Erreur de chargement</td></tr>';
    }
}

function renderPatients(data) {
    const tbody = document.getElementById('table-patients');
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Aucun patient trouvé</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(p => `
        <tr>
            <td>${p.nom || ''}</td>
            <td>${p.prenom || ''}</td>
            <td>${p.age || ''}</td>
            <td>${p.sexe || ''}</td>
            <td>${p.telephone || '-'}</td>
            <td>${p.date_enregistrement || ''}</td>
        </tr>
    `).join('');
}

function filterPatients() {
    const q = document.getElementById('search-patients').value.toLowerCase();
    const filtered = patientsData.filter(p =>
        (p.nom || '').toLowerCase().includes(q) ||
        (p.prenom || '').toLowerCase().includes(q) ||
        (p.telephone || '').toLowerCase().includes(q)
    );
    renderPatients(filtered);
}

async function savePatient() {
    const patient = {
        nom: document.getElementById('p-nom').value.toUpperCase(),
        prenom: document.getElementById('p-prenom').value,
        age: parseInt(document.getElementById('p-age').value),
        sexe: document.getElementById('p-sexe').value,
        telephone: document.getElementById('p-telephone').value,
        profession: document.getElementById('p-profession').value,
        adresse: document.getElementById('p-adresse').value,
        date_enregistrement: new Date().toISOString().split('T')[0]
    };

    try {
        const res = await fetch(`${API}/patients`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(patient)
        });
        const data = await res.json();
        closeModal('modal-patient');
        loadPatients();
        loadDashboard();
        alert('Patient enregistré avec succès !');
    } catch(e) {
        alert('Erreur lors de l\'enregistrement');
    }
}

// CONSULTATIONS
async function loadConsultations() {
    try {
        const data = await fetch(`${API}/consultations`).then(r => r.json());
        const tbody = document.getElementById('table-consultations');
        tbody.innerHTML = data.map(c => `
            <tr>
                <td>${c.date_consult || ''}</td>
                <td>${c.nom || ''} ${c.prenom || ''}</td>
                <td>${c.motif || '-'}</td>
                <td>${c.diagnostic || '-'}</td>
                <td>${(c.montant_total || 0).toLocaleString()} FCFA</td>
            </tr>
        `).join('');
    } catch(e) {
        document.getElementById('table-consultations').innerHTML = '<tr><td colspan="5">Erreur de chargement</td></tr>';
    }
}

// STOCK
async function loadStock() {
    try {
        const [data, alertes] = await Promise.all([
            fetch(`${API}/stock`).then(r => r.json()),
            fetch(`${API}/stock/alertes`).then(r => r.json())
        ]);
        stockData = data;

        // Alertes
        const alertDiv = document.getElementById('alertes-stock');
        if (alertes.length > 0) {
            alertDiv.innerHTML = `
                <div class="alert alert-warning">
                    ⚠️ ${alertes.length} article(s) sous le seuil d'alerte : 
                    ${alertes.slice(0, 3).map(a => a.Designation).join(', ')}
                    ${alertes.length > 3 ? '...' : ''}
                </div>
            `;
        } else {
            alertDiv.innerHTML = '';
        }

        renderStock(data);
    } catch(e) {
        document.getElementById('table-stock').innerHTML = '<tr><td colspan="6">Erreur de chargement</td></tr>';
    }
}

function renderStock(data) {
    const tbody = document.getElementById('table-stock');
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Aucun article trouvé</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(s => {
        const statut = s.Quantite <= 0
            ? '<span class="status status-danger">Rupture</span>'
            : s.Quantite <= s.SeuilAlerte
            ? '<span class="status status-warning">Alerte</span>'
            : '<span class="status status-ok">Normal</span>';
        return `
            <tr>
                <td>${s.Designation || ''}</td>
                <td>${s.Type || ''}</td>
                <td>${s.Quantite || 0}</td>
                <td>${s.SeuilAlerte || 0}</td>
                <td>${(s.PrixVente || 0).toLocaleString()} FCFA</td>
                <td>${statut}</td>
            </tr>
        `;
    }).join('');
}

function filterStock() {
    const q = document.getElementById('search-stock').value.toLowerCase();
    const filtered = stockData.filter(s =>
        (s.Designation || '').toLowerCase().includes(q) ||
        (s.Type || '').toLowerCase().includes(q)
    );
    renderStock(filtered);
}

// Initialisation
loadDashboard();
