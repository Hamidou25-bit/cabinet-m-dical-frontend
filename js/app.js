let patientsData = [];
let stockData = [];

// 1. Initialisation sécurisée (on vérifie si l'élément existe)
document.addEventListener('DOMContentLoaded', function() {
    // Date
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // Nom utilisateur
    const userName = localStorage.getItem('nom_utilisateur');
    const userEl = document.getElementById('user-name');
    if (userName && userEl) {
        userEl.textContent = '👤 ' + userName;
    }
    
    // Chargement initial
    loadDashboard();
});

// Navigation
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    event.currentTarget.classList.add('active');

    const titles = { dashboard: 'Tableau de bord', patients: 'Patients', rendez_vous: 'Rendez-vous', consultations: 'Consultations', stock: 'Stock',ordonnances: 'Ordonnances' };
    document.getElementById('page-title').textContent = titles[page];

    if (page === 'patients') loadPatients();
    if (page === 'rendez_vous') loadRendezVous();
    if (page === 'consultations') loadConsultations();
    if (page === 'stock') loadStock();
    if (page === 'ordonnances') loadOrdonnances();
}

// Modal
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// Dashboard
async function loadDashboard() {
    try {
        const [patients, consultations, stock, alertes] = await Promise.all([
            apiFetch('/patients').then(r => r.json()),
            apiFetch('/consultations').then(r => r.json()),
            apiFetch('/stock').then(r => r.json()),
            apiFetch('/stock/alertes').then(r => r.json())
        ]);

        document.getElementById('stat-patients').textContent = patients.length;
        document.getElementById('stat-consultations').textContent = consultations.length;
        document.getElementById('stat-stock').textContent = stock.length;
        document.getElementById('stat-alertes').textContent = alertes.length;

        const tbody = document.getElementById('recent-consultations');
        tbody.innerHTML = consultations.slice(0, 10).map(c => `
            <tr>
                <td>${c.date_consult || ''}</td>
                <td>${c.nom || ''} ${c.prenom || ''}</td>
                <td>${c.motif || '-'}</td>
                <td>${(c.montant_total || 0).toLocaleString()} FCFA</td>
            </tr>
        `).join('');
    } catch(e) { console.error('Erreur dashboard:', e); }
}

// Patients
async function loadPatients() {
    try {
        patientsData = await apiFetch('/patients').then(r => r.json());
        renderPatients(patientsData);
    } catch(e) { document.getElementById('table-patients').innerHTML = '<tr><td colspan="6">Erreur</td></tr>'; }
}

function renderPatients(data) {
    const tbody = document.getElementById('table-patients');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="6">Aucun patient</td></tr>'; return; }
    tbody.innerHTML = data.map(p => `<tr><td>${p.nom}</td><td>${p.prenom}</td><td>${p.age}</td><td>${p.sexe}</td><td>${p.telephone || '-'}</td><td>${p.date_enregistrement}</td></tr>`).join('');
}

function filterPatients() {
    const q = document.getElementById('search-patients').value.toLowerCase();
    renderPatients(patientsData.filter(p => (p.nom||'').toLowerCase().includes(q) || (p.prenom||'').toLowerCase().includes(q)));
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
        await apiFetch('/patients', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(patient) });
        closeModal('modal-patient'); loadPatients(); loadDashboard(); alert('Patient enregistré !');
    } catch(e) { alert('Erreur'); }
}

// Consultations
async function loadConsultations() {
    try {
        const data = await apiFetch('/consultations').then(r => r.json());
        document.getElementById('table-consultations').innerHTML = data.map(c => `<tr><td>${c.date_consult||''}</td><td>${c.nom||''} ${c.prenom||''}</td><td>${c.motif||'-'}</td><td>${c.diagnostic||'-'}</td><td>${(c.montant_total||0).toLocaleString()} FCFA</td></tr>`).join('');
    } catch(e) { document.getElementById('table-consultations').innerHTML = '<tr><td colspan="5">Erreur</td></tr>'; }
}

// Stock
async function loadStock() {
    try {
        const [data, alertes] = await Promise.all([apiFetch('/stock').then(r => r.json()), apiFetch('/stock/alertes').then(r => r.json())]);
        stockData = data;
        const alertDiv = document.getElementById('alertes-stock');
        alertDiv.innerHTML = alertes.length > 0 ? `<div class="alert alert-warning">⚠️ ${alertes.length} article(s) en alerte</div>` : '';
        renderStock(data);
    } catch(e) { document.getElementById('table-stock').innerHTML = '<tr><td colspan="6">Erreur</td></tr>'; }
}

function renderStock(data) {
    const tbody = document.getElementById('table-stock');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="6">Aucun article</td></tr>'; return; }
    tbody.innerHTML = data.map(s => {
        const statut = s.Quantite <= 0 ? '<span class="status status-danger">Rupture</span>' : s.Quantite <= s.SeuilAlerte ? '<span class="status status-warning">Alerte</span>' : '<span class="status status-ok">Normal</span>';
        return `<tr><td>${s.Designation||''}</td><td>${s.Type||''}</td><td>${s.Quantite||0}</td><td>${s.SeuilAlerte||0}</td><td>${(s.PrixVente||0).toLocaleString()} FCFA</td><td>${statut}</td></tr>`;
    }).join('');
}

function filterStock() {
    const q = document.getElementById('search-stock').value.toLowerCase();
    renderStock(stockData.filter(s => (s.Designation||'').toLowerCase().includes(q)));
}

// Ordonnances
let dosagesData = [];
let formesData = [];

async function loadOrdonnances() {
    try {
        const data = await apiFetch('/ordonnances').then(r => r.json());
        const tbody = document.getElementById('table-ordonnances');
        if (!data.length) { tbody.innerHTML = '<tr><td colspan="5">Aucune ordonnance</td></tr>'; return; }
        tbody.innerHTML = data.map(o => {
            const statut = o.est_validee ? '<span class="status status-ok">Validée</span>' : '<span class="status status-warning">En attente</span>';
            return `<tr>
                <td>${o.date_ordonnance || ''}</td>
                <td>${o.nom || ''} ${o.prenom || ''}</td>
                <td>${o.motif || '-'}</td>
                <td>${o.beneficiaire || '-'}</td>
                <td>${statut}</td>
            </tr>`;
        }).join('');
    } catch(e) { document.getElementById('table-ordonnances').innerHTML = '<tr><td colspan="5">Erreur</td></tr>'; }
}

async function openOrdonnanceModal() {
    // Remplir la liste des patients
    const select = document.getElementById('o-patient');
    if (!patientsData.length) await loadPatients();
    select.innerHTML = patientsData.map(p => `<option value="${p.id}">${p.nom} ${p.prenom}</option>`).join('');

    // Charger dosages/formes si pas déjà fait
    if (!dosagesData.length) dosagesData = await apiFetch('/ordonnances/refs/dosages').then(r => r.json());
    if (!formesData.length) formesData = await apiFetch('/ordonnances/refs/formes').then(r => r.json());

    // Date par défaut = aujourd'hui
    document.getElementById('o-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('o-motif').value = '';
    document.getElementById('o-beneficiaire').value = '';

    // Réinitialiser les lignes
    document.getElementById('lignes-ordonnance').innerHTML = '';
    addLigneOrdonnance();

    openModal('modal-ordonnance');
}

function addLigneOrdonnance() {
    const container = document.getElementById('lignes-ordonnance');
    const div = document.createElement('div');
    div.className = 'ligne-ordonnance';
    div.innerHTML = `
        <input type="text" placeholder="Médicament" class="lo-designation">
        <select class="lo-dosage"><option value="">Dosage</option>${dosagesData.map(d => `<option value="${d.nom}">${d.nom}</option>`).join('')}</select>
        <select class="lo-forme"><option value="">Forme</option>${formesData.map(f => `<option value="${f.nom}">${f.nom}</option>`).join('')}</select>
        <input type="number" placeholder="Qté" class="lo-quantite" value="1" min="1">
        <input type="text" placeholder="Posologie" class="lo-posologie">
        <input type="number" placeholder="Jours" class="lo-duree">
        <button class="btn-remove" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(div);
}

async function saveOrdonnance() {
    const lignes = Array.from(document.querySelectorAll('.ligne-ordonnance')).map(div => ({
        designation: div.querySelector('.lo-designation').value,
        dosage: div.querySelector('.lo-dosage').value,
        forme: div.querySelector('.lo-forme').value,
        quantite: parseInt(div.querySelector('.lo-quantite').value) || 1,
        posologie: div.querySelector('.lo-posologie').value,
        duree_jours: parseInt(div.querySelector('.lo-duree').value) || null,
        montant: 0,
        prix_achat: 0
    })).filter(l => l.designation.trim() !== '');

    if (!lignes.length) { alert('Ajoutez au moins un médicament'); return; }

    const data = {
        patient_id: parseInt(document.getElementById('o-patient').value),
        date_ordonnance: document.getElementById('o-date').value,
        motif: document.getElementById('o-motif').value,
        beneficiaire: document.getElementById('o-beneficiaire').value,
        est_validee: 0,
        is_interne: 0,
        lignes: lignes
    };

    try {
        await apiFetch('/ordonnances', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        closeModal('modal-ordonnance');
        loadOrdonnances();
        alert('Ordonnance enregistrée !');
    } catch(e) { alert('Erreur lors de l\'enregistrement'); }
}

// Rendez-vous
let medecinsData = [];

async function loadRendezVous() {
    try {
        const data = await apiFetch('/rendez-vous').then(r => r.json());
        const tbody = document.getElementById('table-rendez_vous');
        if (!data.length) { tbody.innerHTML = '<tr><td colspan="5">Aucun rendez-vous</td></tr>'; return; }
        const statutClasses = { 'planifié': 'status-warning', 'confirmé': 'status-info', 'terminé': 'status-ok', 'annulé': 'status-danger' };
        tbody.innerHTML = data.map(r => {
            const statutClass = statutClasses[r.statut] || 'status-warning';
            return `<tr>
                <td>${(r.date_heure_rdv || '').replace('T', ' ')}</td>
                <td>${r.nom || ''} ${r.prenom || ''}</td>
                <td>${r.medecin_nom || '-'}</td>
                <td>${r.motif || '-'}</td>
                <td><span class="status ${statutClass}">${r.statut || ''}</span></td>
            </tr>`;
        }).join('');
    } catch(e) { document.getElementById('table-rendez_vous').innerHTML = '<tr><td colspan="5">Erreur</td></tr>'; }
}

async function openRendezVousModal() {
    const patientSelect = document.getElementById('rv-patient');
    if (!patientsData.length) await loadPatients();
    patientSelect.innerHTML = patientsData.map(p => `<option value="${p.id}">${p.nom} ${p.prenom}</option>`).join('');

    const medecinSelect = document.getElementById('rv-medecin');
    if (!medecinsData.length) medecinsData = await apiFetch('/ordonnances/refs/medecins').then(r => r.json());
    medecinSelect.innerHTML = '<option value="">-- Aucun --</option>' + medecinsData.map(m => `<option value="${m.id}">${m.nom}</option>`).join('');

    document.getElementById('rv-date').value = new Date().toISOString().slice(0, 16);
    document.getElementById('rv-statut').value = 'planifié';
    document.getElementById('rv-motif').value = '';
    document.getElementById('rv-notes').value = '';

    openModal('modal-rendez-vous');
}

async function saveRendezVous() {
    const data = {
        patient_id: parseInt(document.getElementById('rv-patient').value),
        medecin_id: document.getElementById('rv-medecin').value ? parseInt(document.getElementById('rv-medecin').value) : null,
        date_heure_rdv: document.getElementById('rv-date').value,
        motif: document.getElementById('rv-motif').value,
        statut: document.getElementById('rv-statut').value,
        notes: document.getElementById('rv-notes').value
    };

    try {
        await apiFetch('/rendez-vous', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        closeModal('modal-rendez-vous');
        loadRendezVous();
        alert('Rendez-vous enregistré !');
    } catch(e) { alert('Erreur lors de l\'enregistrement'); }
}