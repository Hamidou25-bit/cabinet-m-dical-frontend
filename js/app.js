let patientsData = [];
let stockData = [];
let personnelData = [];
let consultationsData = [];
let fournisseursData = [];

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

    // Menu Personnel / Médecins / Comptabilité réservés aux admins
    if (localStorage.getItem('role') === 'admin') {
        document.getElementById('menu-section-admin').style.display = '';
        document.getElementById('menu-personnel').style.display = '';
        document.getElementById('menu-medecins').style.display = '';
        document.getElementById('menu-comptabilite').style.display = '';
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

    const titles = { dashboard: 'Tableau de bord', patients: 'Patients', rendez_vous: 'Rendez-vous', consultations: 'Consultations', stock: 'Stock',ordonnances: 'Ordonnances', examens: 'Examens complémentaires', personnel: 'Personnel', medecins: 'Médecins', comptabilite: 'Comptabilité' };
    document.getElementById('page-title').textContent = titles[page];

    if (page === 'patients') loadPatients();
    if (page === 'rendez_vous') loadRendezVous();
    if (page === 'consultations') loadConsultations();
    if (page === 'stock') loadStock();
    if (page === 'ordonnances') loadOrdonnances();
    if (page === 'examens') loadExamens();
    if (page === 'personnel') loadPersonnel();
    if (page === 'medecins') loadMedecins();
    if (page === 'comptabilite') loadFournisseurs();
}

// Modal
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// Notifications toast (succès / erreur / avertissement)
function showToast(message, type = 'success', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const icons = { success: '✓', error: '✕', warning: '⚠' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = icons[type] || '';

    const text = document.createElement('span');
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

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
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="9">Aucun patient</td></tr>'; return; }
    tbody.innerHTML = data.map(p => `<tr>
        <td>${p.nom}</td><td>${p.prenom}</td><td>${p.age}</td><td>${p.sexe}</td><td>${p.telephone || '-'}</td><td>${p.numero_dossier || '-'}</td><td>${p.email || '-'}</td><td>${p.date_enregistrement}</td>
        <td>
            <button class="btn btn-sm" onclick="editPatient(${p.id})">Modifier</button>
            <button class="btn btn-sm btn-danger" onclick="deletePatient(${p.id})">Supprimer</button>
        </td>
    </tr>`).join('');
}

function getFilteredPatients() {
    const q = document.getElementById('search-patients').value.toLowerCase();
    const dateDebut = document.getElementById('filter-patients-date-debut').value;
    const dateFin = document.getElementById('filter-patients-date-fin').value;
    return patientsData.filter(p => {
        const matchQ = (p.nom||'').toLowerCase().includes(q) || (p.prenom||'').toLowerCase().includes(q);
        const matchDateDebut = !dateDebut || (p.date_enregistrement && p.date_enregistrement >= dateDebut);
        const matchDateFin = !dateFin || (p.date_enregistrement && p.date_enregistrement <= dateFin);
        return matchQ && matchDateDebut && matchDateFin;
    });
}

function filterPatients() {
    renderPatients(getFilteredPatients());
}

function exportPatientsExcel() {
    const data = getFilteredPatients();
    if (!data.length) { showToast('Aucun patient à exporter', 'warning'); return; }
    const rows = data.map(p => ({
        'Nom': p.nom,
        'Prénom': p.prenom,
        'Âge': p.age,
        'Sexe': p.sexe,
        'Téléphone': p.telephone || '',
        'Adresse': p.adresse || '',
        'Profession': p.profession || '',
        'N° Dossier': p.numero_dossier || '',
        'Email': p.email || '',
        'Ethnie': p.ethnie || '',
        "Date d'enregistrement": p.date_enregistrement
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patients');
    XLSX.writeFile(wb, `patients_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function openNewPatientModal() {
    document.getElementById('modal-patient-title').textContent = 'Nouveau Patient';
    document.getElementById('p-id').value = '';
    document.getElementById('p-nom').value = '';
    document.getElementById('p-prenom').value = '';
    document.getElementById('p-age').value = '';
    document.getElementById('p-sexe').value = 'Masculin';
    document.getElementById('p-telephone').value = '';
    document.getElementById('p-profession').value = '';
    document.getElementById('p-adresse').value = '';
    document.getElementById('p-numero-dossier').value = '';
    document.getElementById('p-email').value = '';
    document.getElementById('p-ethnie').value = '';
    openModal('modal-patient');
}

function editPatient(id) {
    const patient = patientsData.find(p => p.id === id);
    if (!patient) return;
    document.getElementById('modal-patient-title').textContent = 'Modifier Patient';
    document.getElementById('p-id').value = patient.id;
    document.getElementById('p-nom').value = patient.nom || '';
    document.getElementById('p-prenom').value = patient.prenom || '';
    document.getElementById('p-age').value = patient.age || '';
    document.getElementById('p-sexe').value = patient.sexe || 'Masculin';
    document.getElementById('p-telephone').value = patient.telephone || '';
    document.getElementById('p-profession').value = patient.profession || '';
    document.getElementById('p-adresse').value = patient.adresse || '';
    document.getElementById('p-numero-dossier').value = patient.numero_dossier || '';
    document.getElementById('p-email').value = patient.email || '';
    document.getElementById('p-ethnie').value = patient.ethnie || '';
    openModal('modal-patient');
}

async function savePatient() {
    const id = document.getElementById('p-id').value;
    const patient = {
        nom: document.getElementById('p-nom').value.toUpperCase(),
        prenom: document.getElementById('p-prenom').value,
        age: parseInt(document.getElementById('p-age').value),
        sexe: document.getElementById('p-sexe').value,
        telephone: document.getElementById('p-telephone').value,
        profession: document.getElementById('p-profession').value,
        adresse: document.getElementById('p-adresse').value,
        numero_dossier: document.getElementById('p-numero-dossier').value,
        email: document.getElementById('p-email').value,
        ethnie: document.getElementById('p-ethnie').value,
        date_enregistrement: new Date().toISOString().split('T')[0]
    };
    try {
        if (id) {
            await apiFetch(`/patients/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(patient) });
        } else {
            await apiFetch('/patients', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(patient) });
        }
        closeModal('modal-patient'); loadPatients(); loadDashboard(); showToast('Patient enregistré !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deletePatient(id) {
    if (!confirm('Voulez-vous vraiment supprimer ce patient ?')) return;
    try {
        await apiFetch(`/patients/${id}`, { method: 'DELETE' });
        loadPatients(); loadDashboard();
    } catch(e) { showToast('Erreur lors de la suppression', 'error'); }
}

// Combobox de sélection de patient (recherche live)
function resetPatientCombo(prefix) {
    document.getElementById(`${prefix}-patient`).value = '';
    document.getElementById(`${prefix}-patient-search`).value = '';
    const list = document.getElementById(`${prefix}-patient-list`);
    list.innerHTML = '';
    list.classList.remove('active');
}

function setPatientComboValue(prefix, patientId) {
    const patient = patientsData.find(p => p.id === patientId);
    document.getElementById(`${prefix}-patient`).value = patientId || '';
    document.getElementById(`${prefix}-patient-search`).value = patient ? `${patient.nom} ${patient.prenom}` : '';
    const list = document.getElementById(`${prefix}-patient-list`);
    list.innerHTML = '';
    list.classList.remove('active');
}

function filterPatientCombo(prefix) {
    const query = document.getElementById(`${prefix}-patient-search`).value.toLowerCase().trim();
    const list = document.getElementById(`${prefix}-patient-list`);
    let results = patientsData;
    if (query) {
        results = patientsData.filter(p =>
            `${p.nom} ${p.prenom}`.toLowerCase().includes(query) ||
            (p.telephone || '').toLowerCase().includes(query)
        );
    }
    results = results.slice(0, 50);
    if (!results.length) {
        list.innerHTML = '<div class="patient-combo-item no-result">Aucun patient trouvé</div>';
    } else {
        list.innerHTML = results.map(p => `<div class="patient-combo-item" onclick="selectPatientCombo('${prefix}', ${p.id})">${p.nom} ${p.prenom}${p.telephone ? ' - ' + p.telephone : ''}</div>`).join('');
    }
    list.classList.add('active');
}

function selectPatientCombo(prefix, patientId) {
    setPatientComboValue(prefix, patientId);
}

document.addEventListener('click', (e) => {
    document.querySelectorAll('.patient-combo-list.active').forEach(list => {
        if (!list.parentElement.contains(e.target)) list.classList.remove('active');
    });
});

// Consultations
async function loadConsultations() {
    try {
        consultationsData = await apiFetch('/consultations').then(r => r.json());
        renderConsultations(consultationsData);
    } catch(e) { document.getElementById('table-consultations').innerHTML = '<tr><td colspan="7">Erreur</td></tr>'; }
}

function renderConsultations(data) {
    const tbody = document.getElementById('table-consultations');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="7">Aucune consultation</td></tr>'; return; }
    tbody.innerHTML = data.map(c => `<tr>
        <td>${c.date_consult || ''}</td>
        <td>${c.nom || ''} ${c.prenom || ''}</td>
        <td>${c.medecin_nom || '-'}</td>
        <td>${c.motif || '-'}</td>
        <td>${c.diagnostic || '-'}</td>
        <td>${(c.montant_total || 0).toLocaleString()} FCFA</td>
        <td>
            <button class="btn btn-sm" onclick="editConsultation(${c.id})">Modifier</button>
            <button class="btn btn-sm btn-danger" onclick="deleteConsultation(${c.id})">Supprimer</button>
        </td>
    </tr>`).join('');
}

function getFilteredConsultations() {
    const q = document.getElementById('search-consultations').value.toLowerCase();
    const dateDebut = document.getElementById('filter-consultations-date-debut').value;
    const dateFin = document.getElementById('filter-consultations-date-fin').value;
    return consultationsData.filter(c => {
        const matchQ = (c.nom||'').toLowerCase().includes(q) || (c.prenom||'').toLowerCase().includes(q)
            || (c.motif||'').toLowerCase().includes(q) || (c.diagnostic||'').toLowerCase().includes(q)
            || (c.medecin_nom||'').toLowerCase().includes(q);
        const matchDateDebut = !dateDebut || (c.date_consult && c.date_consult >= dateDebut);
        const matchDateFin = !dateFin || (c.date_consult && c.date_consult <= dateFin);
        return matchQ && matchDateDebut && matchDateFin;
    });
}

function filterConsultations() {
    renderConsultations(getFilteredConsultations());
}

function exportConsultationsExcel() {
    const data = getFilteredConsultations();
    if (!data.length) { showToast('Aucune consultation à exporter', 'warning'); return; }
    const rows = data.map(c => ({
        'Date': c.date_consult,
        'Patient': `${c.nom || ''} ${c.prenom || ''}`.trim(),
        'Médecin': c.medecin_nom || '',
        'Motif': c.motif || '',
        'Diagnostic': c.diagnostic || '',
        'Observation': c.observation || '',
        'Traitement après diagnostic': c.traitement_apres_diagnostic || '',
        'Prix unitaire': c.prix_unitaire || 0,
        'Montant total': c.montant_total || 0
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consultations');
    XLSX.writeFile(wb, `consultations_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function ensureMedecinsLoaded() {
    if (medecinsData.length) return;
    try {
        const data = await apiFetch('/medecins').then(r => r.json());
        medecinsData = Array.isArray(data) ? data : [];
    } catch (e) {
        medecinsData = [];
    }
}

async function ensureFournisseursLoaded() {
    if (fournisseursData.length) return;
    try {
        const data = await apiFetch('/fournisseurs').then(r => r.json());
        fournisseursData = Array.isArray(data) ? data : [];
    } catch (e) {
        fournisseursData = [];
    }
}

async function openNewConsultationModal() {
    document.getElementById('modal-consultation-title').textContent = 'Nouvelle Consultation';
    document.getElementById('co-id').value = '';

    const tasks = [ensureMedecinsLoaded()];
    if (!patientsData.length) tasks.push(loadPatients());
    await Promise.all(tasks);
    resetPatientCombo('co');

    const medecinSelect = document.getElementById('co-medecin');
    medecinSelect.innerHTML = '<option value="">-- Aucun --</option>' + medecinsData.map(m => `<option value="${m.id}">${m.nom}</option>`).join('');

    document.getElementById('co-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('co-motif').value = '';
    document.getElementById('co-prix-unitaire').value = '';
    document.getElementById('co-montant-total').value = '';
    document.getElementById('co-diagnostic').value = '';
    document.getElementById('co-observation').value = '';
    document.getElementById('co-traitement').value = '';

    openModal('modal-consultation');
}

async function editConsultation(id) {
    const consultation = consultationsData.find(c => c.id === id);
    if (!consultation) return;

    document.getElementById('modal-consultation-title').textContent = 'Modifier Consultation';
    document.getElementById('co-id').value = consultation.id;

    const tasks = [ensureMedecinsLoaded()];
    if (!patientsData.length) tasks.push(loadPatients());
    await Promise.all(tasks);
    setPatientComboValue('co', consultation.patient_id);

    const medecinSelect = document.getElementById('co-medecin');
    medecinSelect.innerHTML = '<option value="">-- Aucun --</option>' + medecinsData.map(m => `<option value="${m.id}">${m.nom}</option>`).join('');
    medecinSelect.value = consultation.medecin_id || '';

    document.getElementById('co-date').value = consultation.date_consult || '';
    document.getElementById('co-motif').value = consultation.motif || '';
    document.getElementById('co-prix-unitaire').value = consultation.prix_unitaire || 0;
    document.getElementById('co-montant-total').value = consultation.montant_total || 0;
    document.getElementById('co-diagnostic').value = consultation.diagnostic || '';
    document.getElementById('co-observation').value = consultation.observation || '';
    document.getElementById('co-traitement').value = consultation.traitement_apres_diagnostic || '';

    openModal('modal-consultation');
}

function onConsultationPrixChange() {
    document.getElementById('co-montant-total').value = document.getElementById('co-prix-unitaire').value;
}

async function saveConsultation() {
    const id = document.getElementById('co-id').value;
    const patientId = parseInt(document.getElementById('co-patient').value);
    if (!patientId) { showToast('Veuillez sélectionner un patient', 'warning'); return; }
    const data = {
        patient_id: patientId,
        medecin_id: document.getElementById('co-medecin').value ? parseInt(document.getElementById('co-medecin').value) : null,
        date_consult: document.getElementById('co-date').value,
        motif: document.getElementById('co-motif').value,
        prix_unitaire: parseFloat(document.getElementById('co-prix-unitaire').value) || 0,
        montant_total: parseFloat(document.getElementById('co-montant-total').value) || 0,
        diagnostic: document.getElementById('co-diagnostic').value,
        observation: document.getElementById('co-observation').value,
        traitement_apres_diagnostic: document.getElementById('co-traitement').value
    };
    try {
        if (id) {
            await apiFetch(`/consultations/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        } else {
            await apiFetch('/consultations', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        }
        closeModal('modal-consultation');
        loadConsultations();
        showToast('Consultation enregistrée !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deleteConsultation(id) {
    if (!confirm('Voulez-vous vraiment supprimer cette consultation ?')) return;
    try {
        await apiFetch(`/consultations/${id}`, { method: 'DELETE' });
        loadConsultations();
    } catch(e) { showToast('Erreur lors de la suppression', 'error'); }
}

// Stock
async function loadStock() {
    try {
        const [data, alertes, alertesPeremption] = await Promise.all([
            apiFetch('/stock').then(r => r.json()),
            apiFetch('/stock/alertes').then(r => r.json()),
            apiFetch('/stock/alertes-peremption').then(r => r.json()),
            ensureFournisseursLoaded()
        ]);
        stockData = data;
        const alertDiv = document.getElementById('alertes-stock');
        let alertsHtml = '';
        if (alertes.length > 0) alertsHtml += `<div class="alert alert-warning">⚠️ ${alertes.length} article(s) en alerte de stock</div>`;
        if (alertesPeremption.length > 0) alertsHtml += `<div class="alert alert-warning">⏳ ${alertesPeremption.length} article(s) proche(s) de leur date de péremption</div>`;
        alertDiv.innerHTML = alertsHtml;
        renderStock(data);
    } catch(e) { document.getElementById('table-stock').innerHTML = '<tr><td colspan="10">Erreur</td></tr>'; }
}

function renderStock(data) {
    const tbody = document.getElementById('table-stock');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="10">Aucun article</td></tr>'; return; }
    const dans30Jours = new Date();
    dans30Jours.setDate(dans30Jours.getDate() + 30);
    tbody.innerHTML = data.map(s => {
        const statut = s.Quantite <= 0 ? '<span class="status status-danger">Rupture</span>' : s.Quantite <= s.SeuilAlerte ? '<span class="status status-warning">Alerte</span>' : '<span class="status status-ok">Normal</span>';
        let peremption = '-';
        if (s.DatePeremption) {
            const datePeremption = new Date(s.DatePeremption);
            const classe = datePeremption <= new Date() ? 'status-danger' : datePeremption <= dans30Jours ? 'status-warning' : 'status-ok';
            peremption = `<span class="status ${classe}">${s.DatePeremption}</span>`;
        }
        return `<tr>
            <td>${s.Designation||''}</td><td>${s.Type||''}</td><td>${s.Dosage||'-'}</td><td>${s.Forme||'-'}</td><td>${s.Quantite||0}</td><td>${s.SeuilAlerte||0}</td><td>${(s.PrixVente||0).toLocaleString()} FCFA</td><td>${peremption}</td><td>${statut}</td>
            <td>
                <button class="btn btn-sm" onclick="editStockArticle(${s.idStock})">Modifier</button>
                <button class="btn btn-sm btn-primary" onclick="openSortieModal(${s.idStock})">Sortie</button>
            </td>
        </tr>`;
    }).join('');
}

function filterStock() {
    const q = document.getElementById('search-stock').value.toLowerCase();
    renderStock(stockData.filter(s => (s.Designation||'').toLowerCase().includes(q)));
}

// Onglets Stock
function showStockTab(tab) {
    document.getElementById('stock-tab-articles').style.display = tab === 'articles' ? '' : 'none';
    document.getElementById('stock-tab-sorties').style.display = tab === 'sorties' ? '' : 'none';
    document.getElementById('tab-stock-articles').className = tab === 'articles' ? 'btn btn-primary' : 'btn';
    document.getElementById('tab-stock-sorties').className = tab === 'sorties' ? 'btn btn-primary' : 'btn';
    if (tab === 'sorties') loadSorties();
}

// Onglets Comptabilité
function showComptabiliteTab(tab) {
    document.getElementById('comptabilite-tab-fournisseurs').style.display = tab === 'fournisseurs' ? '' : 'none';
    document.getElementById('tab-comptabilite-fournisseurs').className = tab === 'fournisseurs' ? 'btn btn-primary' : 'btn';
    if (tab === 'fournisseurs') loadFournisseurs();
}

// Remplit le select Fournisseur du modal Stock
function populateFournisseurSelect(selected) {
    const select = document.getElementById('st-fournisseur');
    let options = '<option value="">-- Aucun --</option>' + fournisseursData.map(f => `<option value="${f.nom}">${f.nom}</option>`).join('');
    if (selected && !fournisseursData.some(f => f.nom === selected)) {
        options += `<option value="${selected}">${selected}</option>`;
    }
    select.innerHTML = options;
    select.value = selected || '';
}

// Modifier un article
function editStockArticle(id) {
    const article = stockData.find(s => s.idStock === id);
    if (!article) return;
    document.getElementById('st-id').value = article.idStock;
    document.getElementById('st-date-entree').value = article.DateEntree || '';
    document.getElementById('st-designation').value = article.Designation || '';
    document.getElementById('st-type').value = article.Type || '';
    populateFournisseurSelect(article.Fournisseur || '');
    document.getElementById('st-quantite').value = article.Quantite || 0;
    document.getElementById('st-seuil').value = article.SeuilAlerte || 0;
    document.getElementById('st-prix-vente').value = article.PrixVente || 0;
    document.getElementById('st-prix-achat').value = article.PrixAchat || 0;
    document.getElementById('st-dosage').value = article.Dosage || '';
    document.getElementById('st-forme').value = article.Forme || '';
    document.getElementById('st-peremption').value = article.DatePeremption || '';
    openModal('modal-stock-edit');
}

async function saveStockArticle() {
    const id = document.getElementById('st-id').value;
    const article = {
        DateEntree: document.getElementById('st-date-entree').value,
        Type: document.getElementById('st-type').value,
        Designation: document.getElementById('st-designation').value,
        Fournisseur: document.getElementById('st-fournisseur').value,
        Quantite: parseInt(document.getElementById('st-quantite').value) || 0,
        SeuilAlerte: parseInt(document.getElementById('st-seuil').value) || 0,
        PrixVente: parseFloat(document.getElementById('st-prix-vente').value) || 0,
        PrixAchat: parseFloat(document.getElementById('st-prix-achat').value) || 0,
        Dosage: document.getElementById('st-dosage').value,
        Forme: document.getElementById('st-forme').value,
        DatePeremption: document.getElementById('st-peremption').value,
    };
    try {
        await apiFetch(`/stock/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(article) });
        closeModal('modal-stock-edit');
        loadStock();
        showToast('Article mis à jour !', 'success');
    } catch(e) { showToast('Erreur lors de la mise à jour : ' + e.message, 'error'); }
}

// Sortie de stock
function openSortieModal(id) {
    const article = stockData.find(s => s.idStock === id);
    if (!article) return;
    document.getElementById('so-designation').value = article.Designation;
    document.getElementById('so-article-label').value = article.Designation;
    document.getElementById('so-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('so-quantite').value = 1;
    document.getElementById('so-prix-vente').value = article.PrixVente || 0;
    document.getElementById('so-patient').value = '';
    openModal('modal-sortie');
}

async function saveSortie() {
    const data = {
        Designation: document.getElementById('so-designation').value,
        DateSortie: document.getElementById('so-date').value,
        QuantiteSortie: parseInt(document.getElementById('so-quantite').value) || 1,
        PrixVente: parseFloat(document.getElementById('so-prix-vente').value) || 0,
        Patient: document.getElementById('so-patient').value
    };
    try {
        await apiFetch('/stock/sortie', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        closeModal('modal-sortie');
        loadStock();
        showToast('Sortie enregistrée !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function loadSorties() {
    try {
        const data = await apiFetch('/stock/sorties').then(r => r.json());
        const tbody = document.getElementById('table-sorties');
        if (!data.length) { tbody.innerHTML = '<tr><td colspan="6">Aucune sortie</td></tr>'; return; }
        tbody.innerHTML = data.map(s => `<tr>
            <td>${s.DateSortie || ''}</td>
            <td>${s.Designation || ''}</td>
            <td>${s.QuantiteSortie || 0}</td>
            <td>${(s.PrixVente || 0).toLocaleString()} FCFA</td>
            <td>${(s.Montant || 0).toLocaleString()} FCFA</td>
            <td>${s.Patient || '-'}</td>
        </tr>`).join('');
    } catch(e) { document.getElementById('table-sorties').innerHTML = '<tr><td colspan="6">Erreur</td></tr>'; }
}

// Ordonnances
let dosagesData = [];
let formesData = [];
let ordonnancesData = [];

async function loadOrdonnances() {
    try {
        ordonnancesData = await apiFetch('/ordonnances').then(r => r.json());
        renderOrdonnances(ordonnancesData);
    } catch(e) { document.getElementById('table-ordonnances').innerHTML = '<tr><td colspan="6">Erreur</td></tr>'; }
}

function renderOrdonnances(data) {
    const tbody = document.getElementById('table-ordonnances');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="6">Aucune ordonnance</td></tr>'; return; }
    tbody.innerHTML = data.map(o => {
        const statut = o.est_validee ? '<span class="status status-ok">Validée</span>' : '<span class="status status-warning">En attente</span>';
        return `<tr>
            <td>${o.date_ordonnance || ''}</td>
            <td>${o.nom || ''} ${o.prenom || ''}</td>
            <td>${o.motif || '-'}</td>
            <td>${o.beneficiaire || '-'}</td>
            <td>${statut}</td>
            <td>
                <button class="btn btn-sm" onclick="editOrdonnance(${o.id})">Modifier</button>
                <button class="btn btn-sm btn-danger" onclick="deleteOrdonnance(${o.id})">Supprimer</button>
            </td>
        </tr>`;
    }).join('');
}

function getFilteredOrdonnances() {
    const q = document.getElementById('search-ordonnances').value.toLowerCase();
    const dateDebut = document.getElementById('filter-ordonnances-date-debut').value;
    const dateFin = document.getElementById('filter-ordonnances-date-fin').value;
    return ordonnancesData.filter(o => {
        const matchQ = (o.nom||'').toLowerCase().includes(q) || (o.prenom||'').toLowerCase().includes(q)
            || (o.motif||'').toLowerCase().includes(q) || (o.beneficiaire||'').toLowerCase().includes(q);
        const matchDateDebut = !dateDebut || (o.date_ordonnance && o.date_ordonnance >= dateDebut);
        const matchDateFin = !dateFin || (o.date_ordonnance && o.date_ordonnance <= dateFin);
        return matchQ && matchDateDebut && matchDateFin;
    });
}

function filterOrdonnances() {
    renderOrdonnances(getFilteredOrdonnances());
}

function exportOrdonnancesExcel() {
    const data = getFilteredOrdonnances();
    if (!data.length) { showToast('Aucune ordonnance à exporter', 'warning'); return; }
    const rows = data.map(o => ({
        'Date': o.date_ordonnance,
        'Patient': `${o.nom || ''} ${o.prenom || ''}`.trim(),
        'Motif': o.motif || '',
        'Bénéficiaire': o.beneficiaire || '',
        'Statut': o.est_validee ? 'Validée' : 'En attente'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ordonnances');
    XLSX.writeFile(wb, `ordonnances_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function loadOrdonnanceRefs() {
    const tasks = [];
    if (!dosagesData.length) tasks.push(apiFetch('/ordonnances/refs/dosages').then(r => r.json()).then(d => dosagesData = d));
    if (!formesData.length) tasks.push(apiFetch('/ordonnances/refs/formes').then(r => r.json()).then(d => formesData = d));
    if (tasks.length) await Promise.all(tasks);
}

async function openOrdonnanceModal() {
    document.getElementById('modal-ordonnance-title').textContent = 'Nouvelle Ordonnance';
    document.getElementById('o-id').value = '';

    // Remplir la liste des patients + charger dosages/formes en parallèle
    const tasks = [loadOrdonnanceRefs()];
    if (!patientsData.length) tasks.push(loadPatients());
    await Promise.all(tasks);
    resetPatientCombo('o');

    // Date par défaut = aujourd'hui
    document.getElementById('o-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('o-motif').value = '';
    document.getElementById('o-beneficiaire').value = '';
    document.getElementById('o-est-validee').checked = false;

    // Réinitialiser les lignes
    document.getElementById('lignes-ordonnance').innerHTML = '';
    addLigneOrdonnance();

    openModal('modal-ordonnance');
}

async function editOrdonnance(id) {
    document.getElementById('modal-ordonnance-title').textContent = 'Modifier Ordonnance';
    document.getElementById('o-id').value = id;

    const tasks = [loadOrdonnanceRefs(), apiFetch(`/ordonnances/${id}`).then(r => r.json())];
    if (!patientsData.length) tasks.push(loadPatients());

    try {
        const [, ordonnance] = await Promise.all(tasks);

        setPatientComboValue('o', ordonnance.patient_id);
        document.getElementById('o-date').value = ordonnance.date_ordonnance || '';
        document.getElementById('o-motif').value = ordonnance.motif || '';
        document.getElementById('o-beneficiaire').value = ordonnance.beneficiaire || '';
        document.getElementById('o-est-validee').checked = !!ordonnance.est_validee;

        document.getElementById('lignes-ordonnance').innerHTML = '';
        if (ordonnance.lignes && ordonnance.lignes.length) {
            ordonnance.lignes.forEach(ligne => addLigneOrdonnance(ligne));
        } else {
            addLigneOrdonnance();
        }

        openModal('modal-ordonnance');
    } catch(e) { showToast('Erreur lors du chargement de l\'ordonnance', 'error'); }
}

function addLigneOrdonnance(ligne) {
    const container = document.getElementById('lignes-ordonnance');
    const div = document.createElement('div');
    div.className = 'ligne-ordonnance';
    div.innerHTML = `
        <input type="text" placeholder="Médicament" class="lo-designation" value="${ligne ? (ligne.designation || '') : ''}">
        <select class="lo-dosage"><option value="">Dosage</option>${dosagesData.map(d => `<option value="${d.nom}" ${ligne && ligne.dosage === d.nom ? 'selected' : ''}>${d.nom}</option>`).join('')}</select>
        <select class="lo-forme"><option value="">Forme</option>${formesData.map(f => `<option value="${f.nom}" ${ligne && ligne.forme === f.nom ? 'selected' : ''}>${f.nom}</option>`).join('')}</select>
        <input type="number" placeholder="Qté" class="lo-quantite" value="${ligne ? (ligne.quantite || 1) : 1}" min="1">
        <input type="text" placeholder="Posologie" class="lo-posologie" value="${ligne ? (ligne.posologie || '') : ''}">
        <input type="number" placeholder="Jours" class="lo-duree" value="${ligne && ligne.duree_jours ? ligne.duree_jours : ''}">
        <button class="btn-remove" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(div);
}

async function saveOrdonnance() {
    const id = document.getElementById('o-id').value;
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

    if (!lignes.length) { showToast('Ajoutez au moins un médicament', 'warning'); return; }

    const patientId = parseInt(document.getElementById('o-patient').value);
    if (!patientId) { showToast('Veuillez sélectionner un patient', 'warning'); return; }

    const data = {
        patient_id: patientId,
        date_ordonnance: document.getElementById('o-date').value,
        motif: document.getElementById('o-motif').value,
        beneficiaire: document.getElementById('o-beneficiaire').value,
        est_validee: document.getElementById('o-est-validee').checked ? 1 : 0,
        is_interne: 0,
        lignes: lignes
    };

    try {
        if (id) {
            await apiFetch(`/ordonnances/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        } else {
            await apiFetch('/ordonnances', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        }
        closeModal('modal-ordonnance');
        loadOrdonnances();
        showToast('Ordonnance enregistrée !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deleteOrdonnance(id) {
    if (!confirm('Voulez-vous vraiment supprimer cette ordonnance ?')) return;
    try {
        await apiFetch(`/ordonnances/${id}`, { method: 'DELETE' });
        loadOrdonnances();
    } catch(e) { showToast('Erreur lors de la suppression', 'error'); }
}

// Rendez-vous
let medecinsData = [];
let rendezVousData = [];
const statutClasses = { 'planifié': 'status-warning', 'confirmé': 'status-info', 'terminé': 'status-ok', 'annulé': 'status-danger' };

async function loadRendezVous() {
    try {
        rendezVousData = await apiFetch('/rendez-vous').then(r => r.json());
        renderRendezVous(rendezVousData);
    } catch(e) { document.getElementById('table-rendez_vous').innerHTML = '<tr><td colspan="6">Erreur</td></tr>'; }
}

function renderRendezVous(data) {
    const tbody = document.getElementById('table-rendez_vous');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="6">Aucun rendez-vous</td></tr>'; return; }
    tbody.innerHTML = data.map(r => {
        const statutClass = statutClasses[r.statut] || 'status-warning';
        return `<tr>
            <td>${(r.date_heure_rdv || '').replace('T', ' ')}</td>
            <td>${r.nom || ''} ${r.prenom || ''}</td>
            <td>${r.medecin_nom || '-'}</td>
            <td>${r.motif || '-'}</td>
            <td><span class="status ${statutClass}">${r.statut || ''}</span></td>
            <td>
                <button class="btn btn-sm" onclick="editRendezVous(${r.id})">Modifier</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRendezVous(${r.id})">Supprimer</button>
            </td>
        </tr>`;
    }).join('');
}

function getFilteredRendezVous() {
    const q = document.getElementById('search-rendez_vous').value.toLowerCase();
    const dateDebut = document.getElementById('filter-rendez_vous-date-debut').value;
    const dateFin = document.getElementById('filter-rendez_vous-date-fin').value;
    return rendezVousData.filter(r => {
        const matchQ = (r.nom||'').toLowerCase().includes(q) || (r.prenom||'').toLowerCase().includes(q)
            || (r.motif||'').toLowerCase().includes(q) || (r.medecin_nom||'').toLowerCase().includes(q)
            || (r.statut||'').toLowerCase().includes(q);
        const rdvDate = (r.date_heure_rdv || '').slice(0, 10);
        const matchDateDebut = !dateDebut || (rdvDate && rdvDate >= dateDebut);
        const matchDateFin = !dateFin || (rdvDate && rdvDate <= dateFin);
        return matchQ && matchDateDebut && matchDateFin;
    });
}

function filterRendezVous() {
    renderRendezVous(getFilteredRendezVous());
}

function exportRendezVousExcel() {
    const data = getFilteredRendezVous();
    if (!data.length) { showToast('Aucun rendez-vous à exporter', 'warning'); return; }
    const rows = data.map(r => ({
        'Date / Heure': (r.date_heure_rdv || '').replace('T', ' '),
        'Patient': `${r.nom || ''} ${r.prenom || ''}`.trim(),
        'Médecin': r.medecin_nom || '',
        'Motif': r.motif || '',
        'Statut': r.statut || '',
        'Notes': r.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rendez-vous');
    XLSX.writeFile(wb, `rendez_vous_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function loadMedecinsRefs() {
    const medecinSelect = document.getElementById('rv-medecin');
    await ensureMedecinsLoaded();
    medecinSelect.innerHTML = '<option value="">-- Aucun --</option>' + medecinsData.map(m => `<option value="${m.id}">${m.nom}</option>`).join('');
}

async function openRendezVousModal() {
    document.getElementById('modal-rendez-vous-title').textContent = 'Nouveau Rendez-vous';
    document.getElementById('rv-id').value = '';

    const tasks = [loadMedecinsRefs()];
    if (!patientsData.length) tasks.push(loadPatients());
    await Promise.all(tasks);
    resetPatientCombo('rv');

    document.getElementById('rv-date').value = new Date().toISOString().slice(0, 16);
    document.getElementById('rv-statut').value = 'planifié';
    document.getElementById('rv-motif').value = '';
    document.getElementById('rv-notes').value = '';

    openModal('modal-rendez-vous');
}

async function editRendezVous(id) {
    const rdv = rendezVousData.find(r => r.id === id);
    if (!rdv) return;

    document.getElementById('modal-rendez-vous-title').textContent = 'Modifier Rendez-vous';
    document.getElementById('rv-id').value = rdv.id;

    const tasks = [loadMedecinsRefs()];
    if (!patientsData.length) tasks.push(loadPatients());
    await Promise.all(tasks);
    setPatientComboValue('rv', rdv.patient_id);
    document.getElementById('rv-medecin').value = rdv.medecin_id || '';

    document.getElementById('rv-date').value = (rdv.date_heure_rdv || '').slice(0, 16);
    document.getElementById('rv-statut').value = rdv.statut || 'planifié';
    document.getElementById('rv-motif').value = rdv.motif || '';
    document.getElementById('rv-notes').value = rdv.notes || '';

    openModal('modal-rendez-vous');
}

async function saveRendezVous() {
    const id = document.getElementById('rv-id').value;
    const patientId = parseInt(document.getElementById('rv-patient').value);
    if (!patientId) { showToast('Veuillez sélectionner un patient', 'warning'); return; }
    const data = {
        patient_id: patientId,
        medecin_id: document.getElementById('rv-medecin').value ? parseInt(document.getElementById('rv-medecin').value) : null,
        date_heure_rdv: document.getElementById('rv-date').value,
        motif: document.getElementById('rv-motif').value,
        statut: document.getElementById('rv-statut').value,
        notes: document.getElementById('rv-notes').value
    };

    try {
        if (id) {
            await apiFetch(`/rendez-vous/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        } else {
            await apiFetch('/rendez-vous', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        }
        closeModal('modal-rendez-vous');
        loadRendezVous();
        showToast('Rendez-vous enregistré !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deleteRendezVous(id) {
    if (!confirm('Voulez-vous vraiment supprimer ce rendez-vous ?')) return;
    try {
        await apiFetch(`/rendez-vous/${id}`, { method: 'DELETE' });
        loadRendezVous();
    } catch(e) { showToast('Erreur lors de la suppression', 'error'); }
}

// Examens complémentaires
let typesExamensData = [];
let examensData = [];

async function loadExamens() {
    try {
        examensData = await apiFetch('/examens-complementaires').then(r => r.json());
        renderExamens(examensData);
    } catch(e) { document.getElementById('table-examens').innerHTML = '<tr><td colspan="7">Erreur</td></tr>'; }
}

function renderExamens(data) {
    const tbody = document.getElementById('table-examens');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="7">Aucun examen</td></tr>'; return; }
    tbody.innerHTML = data.map(e => `<tr>
        <td>${e.date_examen || ''}</td>
        <td>${e.nom || ''} ${e.prenom || ''}</td>
        <td>${e.type_nom || '-'}</td>
        <td>${e.examen_nom || '-'}</td>
        <td>${e.resultat || '-'}</td>
        <td>${(e.prix || 0).toLocaleString()} FCFA</td>
        <td>
            <button class="btn btn-sm" onclick="editExamen(${e.id})">Modifier</button>
            <button class="btn btn-sm btn-danger" onclick="deleteExamen(${e.id})">Supprimer</button>
        </td>
    </tr>`).join('');
}

function getFilteredExamens() {
    const q = document.getElementById('search-examens').value.toLowerCase();
    const dateDebut = document.getElementById('filter-examens-date-debut').value;
    const dateFin = document.getElementById('filter-examens-date-fin').value;
    return examensData.filter(e => {
        const matchQ = (e.nom||'').toLowerCase().includes(q) || (e.prenom||'').toLowerCase().includes(q)
            || (e.type_nom||'').toLowerCase().includes(q) || (e.examen_nom||'').toLowerCase().includes(q)
            || (e.resultat||'').toLowerCase().includes(q);
        const matchDateDebut = !dateDebut || (e.date_examen && e.date_examen >= dateDebut);
        const matchDateFin = !dateFin || (e.date_examen && e.date_examen <= dateFin);
        return matchQ && matchDateDebut && matchDateFin;
    });
}

function filterExamens() {
    renderExamens(getFilteredExamens());
}

function exportExamensExcel() {
    const data = getFilteredExamens();
    if (!data.length) { showToast('Aucun examen à exporter', 'warning'); return; }
    const rows = data.map(e => ({
        'Date': e.date_examen,
        'Patient': `${e.nom || ''} ${e.prenom || ''}`.trim(),
        'Type': e.type_nom || '',
        'Examen': e.examen_nom || '',
        'Médecin': e.medecin_nom || '',
        'Renseignement clinique': e.renseignement_clinique || '',
        'Résultat': e.resultat || '',
        'Prix': e.prix || 0
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Examens');
    XLSX.writeFile(wb, `examens_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function loadExamenRefs() {
    const tasks = [];
    if (!medecinsData.length) tasks.push(ensureMedecinsLoaded());
    if (!typesExamensData.length) tasks.push(apiFetch('/examens-complementaires/refs/types').then(r => r.json()).then(d => typesExamensData = Array.isArray(d) ? d : []).catch(() => typesExamensData = []));
    if (tasks.length) await Promise.all(tasks);

    const medecinSelect = document.getElementById('e-medecin');
    medecinSelect.innerHTML = '<option value="">-- Aucun --</option>' + medecinsData.map(m => `<option value="${m.id}">${m.nom}</option>`).join('');

    const typeNoms = [...new Set(typesExamensData.map(t => t.type_nom))];
    const typeSelect = document.getElementById('e-type-examen');
    typeSelect.innerHTML = typeNoms.map(t => `<option value="${t}">${t}</option>`).join('');
}

async function openExamenModal() {
    document.getElementById('modal-examen-title').textContent = 'Nouvel Examen Complémentaire';
    document.getElementById('e-id').value = '';

    const tasks = [loadExamenRefs()];
    if (!patientsData.length) tasks.push(loadPatients());
    await Promise.all(tasks);
    resetPatientCombo('e');

    document.getElementById('e-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('e-renseignement').value = '';
    document.getElementById('e-resultat').value = '';
    document.getElementById('e-prix').value = '';

    onTypeExamenChange();
    openModal('modal-examen');
}

async function editExamen(id) {
    const examen = examensData.find(e => e.id === id);
    if (!examen) return;

    document.getElementById('modal-examen-title').textContent = 'Modifier Examen';
    document.getElementById('e-id').value = examen.id;

    const tasks = [loadExamenRefs()];
    if (!patientsData.length) tasks.push(loadPatients());
    await Promise.all(tasks);
    setPatientComboValue('e', examen.patient_id);

    const sousType = typesExamensData.find(t => t.id === examen.sous_type_examen_id);
    if (sousType) {
        document.getElementById('e-type-examen').value = sousType.type_nom;
        onTypeExamenChange();
        document.getElementById('e-sous-type').value = examen.sous_type_examen_id;
    }

    document.getElementById('e-date').value = examen.date_examen || '';
    document.getElementById('e-prix').value = examen.prix || 0;
    document.getElementById('e-medecin').value = examen.medecin_id || '';
    document.getElementById('e-renseignement').value = examen.renseignement_clinique || '';
    document.getElementById('e-resultat').value = examen.resultat || '';

    openModal('modal-examen');
}

function onTypeExamenChange() {
    const typeNom = document.getElementById('e-type-examen').value;
    const sousTypeSelect = document.getElementById('e-sous-type');
    const sousTypes = typesExamensData.filter(t => t.type_nom === typeNom);
    sousTypeSelect.innerHTML = sousTypes.map(t => `<option value="${t.id}" data-tarif="${t.tarif}">${t.nom}</option>`).join('');
    onSousTypeChange();
}

function onSousTypeChange() {
    const sousTypeSelect = document.getElementById('e-sous-type');
    const selected = sousTypeSelect.options[sousTypeSelect.selectedIndex];
    document.getElementById('e-prix').value = selected ? selected.dataset.tarif : 0;
}

async function saveExamen() {
    const id = document.getElementById('e-id').value;
    const patientId = parseInt(document.getElementById('e-patient').value);
    if (!patientId) { showToast('Veuillez sélectionner un patient', 'warning'); return; }
    const data = {
        patient_id: patientId,
        sous_type_examen_id: parseInt(document.getElementById('e-sous-type').value),
        date_examen: document.getElementById('e-date').value,
        prix: parseFloat(document.getElementById('e-prix').value) || 0,
        medecin_id: document.getElementById('e-medecin').value ? parseInt(document.getElementById('e-medecin').value) : null,
        renseignement_clinique: document.getElementById('e-renseignement').value,
        resultat: document.getElementById('e-resultat').value || null
    };

    try {
        if (id) {
            await apiFetch(`/examens-complementaires/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        } else {
            await apiFetch('/examens-complementaires', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        }
        closeModal('modal-examen');
        loadExamens();
        showToast('Examen enregistré !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deleteExamen(id) {
    if (!confirm('Voulez-vous vraiment supprimer cet examen ?')) return;
    try {
        await apiFetch(`/examens-complementaires/${id}`, { method: 'DELETE' });
        loadExamens();
    } catch(e) { showToast('Erreur lors de la suppression', 'error'); }
}

// Personnel
async function loadPersonnel() {
    try {
        const data = await apiFetch('/personnel').then(r => r.json());
        personnelData = data;
        renderPersonnel(getFilteredPersonnel());
    } catch(e) { document.getElementById('table-personnel').innerHTML = '<tr><td colspan="8">Erreur</td></tr>'; }
}

function getFilteredPersonnel() {
    const q = document.getElementById('search-personnel').value.toLowerCase();
    const dateDebut = document.getElementById('filter-personnel-date-debut').value;
    const dateFin = document.getElementById('filter-personnel-date-fin').value;
    return personnelData.filter(p => {
        const matchQ = (p.nom||'').toLowerCase().includes(q) || (p.prenom||'').toLowerCase().includes(q)
            || (p.fonction||'').toLowerCase().includes(q) || (p.telephone||'').toLowerCase().includes(q)
            || (p.nom_utilisateur||'').toLowerCase().includes(q);
        const matchDateDebut = !dateDebut || (p.date_entree && p.date_entree >= dateDebut);
        const matchDateFin = !dateFin || (p.date_entree && p.date_entree <= dateFin);
        return matchQ && matchDateDebut && matchDateFin;
    });
}

function filterPersonnel() {
    renderPersonnel(getFilteredPersonnel());
}

function exportPersonnelExcel() {
    const data = getFilteredPersonnel();
    if (!data.length) { showToast('Aucun membre du personnel à exporter', 'warning'); return; }
    const rows = data.map(p => ({
        'Nom': p.nom,
        'Prénom': p.prenom,
        'Fonction': p.fonction || '',
        'Téléphone': p.telephone || '',
        'Date d\'entrée': p.date_entree || '',
        'Date de sortie': p.date_sortie || '',
        'Compte utilisateur': p.nom_utilisateur ? `${p.nom_utilisateur} (${p.role})${p.actif ? '' : ' - inactif'}` : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personnel');
    XLSX.writeFile(wb, `personnel_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function renderPersonnel(data) {
    const tbody = document.getElementById('table-personnel');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="8">Aucun membre du personnel</td></tr>'; return; }
    tbody.innerHTML = data.map(p => {
        const compte = p.nom_utilisateur
            ? `${p.nom_utilisateur} (${p.role})${p.actif ? '' : ' - inactif'}`
            : '-';
        return `<tr>
            <td>${p.nom}</td><td>${p.prenom}</td><td>${p.fonction || '-'}</td><td>${p.telephone || '-'}</td>
            <td>${p.date_entree || '-'}</td><td>${p.date_sortie || '-'}</td><td>${compte}</td>
            <td>
                <button class="btn btn-sm" onclick="editPersonnel(${p.id})">Modifier</button>
                <button class="btn btn-sm btn-danger" onclick="deactivatePersonnel(${p.id})">Désactiver</button>
            </td>
        </tr>`;
    }).join('');
}

function openNewPersonnelModal() {
    document.getElementById('modal-personnel-title').textContent = 'Nouveau Membre du Personnel';
    document.getElementById('pe-id').value = '';
    document.getElementById('pe-nom').value = '';
    document.getElementById('pe-prenom').value = '';
    document.getElementById('pe-fonction').value = '';
    document.getElementById('pe-telephone').value = '';
    document.getElementById('pe-date-entree').value = new Date().toISOString().split('T')[0];
    document.getElementById('pe-date-sortie').value = '';
    openModal('modal-personnel');
}

function editPersonnel(id) {
    const personnel = personnelData.find(p => p.id === id);
    if (!personnel) return;
    document.getElementById('modal-personnel-title').textContent = 'Modifier Membre du Personnel';
    document.getElementById('pe-id').value = personnel.id;
    document.getElementById('pe-nom').value = personnel.nom || '';
    document.getElementById('pe-prenom').value = personnel.prenom || '';
    document.getElementById('pe-fonction').value = personnel.fonction || '';
    document.getElementById('pe-telephone').value = personnel.telephone || '';
    document.getElementById('pe-date-entree').value = personnel.date_entree || '';
    document.getElementById('pe-date-sortie').value = personnel.date_sortie || '';
    openModal('modal-personnel');
}

async function savePersonnel() {
    const id = document.getElementById('pe-id').value;
    const personnel = {
        nom: document.getElementById('pe-nom').value.toUpperCase(),
        prenom: document.getElementById('pe-prenom').value,
        fonction: document.getElementById('pe-fonction').value,
        telephone: document.getElementById('pe-telephone').value,
        date_entree: document.getElementById('pe-date-entree').value || null,
        date_sortie: document.getElementById('pe-date-sortie').value || null,
    };
    try {
        if (id) {
            await apiFetch(`/personnel/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(personnel) });
        } else {
            await apiFetch('/personnel', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(personnel) });
        }
        closeModal('modal-personnel');
        loadPersonnel();
        showToast('Membre du personnel enregistré !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deactivatePersonnel(id) {
    if (!confirm('Voulez-vous vraiment désactiver ce membre du personnel ?')) return;
    try {
        await apiFetch(`/personnel/${id}`, { method: 'DELETE' });
        loadPersonnel();
    } catch(e) { showToast('Erreur lors de la désactivation', 'error'); }
}

// Médecins
async function loadMedecins() {
    try {
        medecinsData = await apiFetch('/medecins').then(r => r.json());
        renderMedecins(medecinsData);
    } catch(e) { document.getElementById('table-medecins').innerHTML = '<tr><td colspan="2">Erreur</td></tr>'; }
}

function renderMedecins(data) {
    const tbody = document.getElementById('table-medecins');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="2">Aucun médecin</td></tr>'; return; }
    tbody.innerHTML = data.map(m => `<tr>
        <td>${m.nom}</td>
        <td>
            <button class="btn btn-sm" onclick="editMedecin(${m.id})">Modifier</button>
            <button class="btn btn-sm btn-danger" onclick="deleteMedecin(${m.id})">Supprimer</button>
        </td>
    </tr>`).join('');
}

function filterMedecins() {
    const q = document.getElementById('search-medecins').value.toLowerCase();
    renderMedecins(medecinsData.filter(m => (m.nom||'').toLowerCase().includes(q)));
}

function openNewMedecinModal() {
    document.getElementById('modal-medecin-title').textContent = 'Nouveau Médecin';
    document.getElementById('me-id').value = '';
    document.getElementById('me-nom').value = '';
    openModal('modal-medecin');
}

function editMedecin(id) {
    const medecin = medecinsData.find(m => m.id === id);
    if (!medecin) return;
    document.getElementById('modal-medecin-title').textContent = 'Modifier Médecin';
    document.getElementById('me-id').value = medecin.id;
    document.getElementById('me-nom').value = medecin.nom || '';
    openModal('modal-medecin');
}

async function saveMedecin() {
    const id = document.getElementById('me-id').value;
    const medecin = { nom: document.getElementById('me-nom').value };
    try {
        if (id) {
            await apiFetch(`/medecins/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(medecin) });
        } else {
            await apiFetch('/medecins', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(medecin) });
        }
        closeModal('modal-medecin');
        medecinsData = [];
        loadMedecins();
        showToast('Médecin enregistré !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deleteMedecin(id) {
    if (!confirm('Voulez-vous vraiment supprimer ce médecin ?')) return;
    try {
        await apiFetch(`/medecins/${id}`, { method: 'DELETE' });
        medecinsData = [];
        loadMedecins();
    } catch(e) {
        if (e.status === 409) showToast(e.detail, 'error');
        else showToast('Erreur lors de la suppression : ' + e.message, 'error');
    }
}

// Fournisseurs
async function loadFournisseurs() {
    try {
        fournisseursData = await apiFetch('/fournisseurs').then(r => r.json());
        renderFournisseurs(fournisseursData);
    } catch(e) { document.getElementById('table-fournisseurs').innerHTML = '<tr><td colspan="5">Erreur</td></tr>'; }
}

function renderFournisseurs(data) {
    const tbody = document.getElementById('table-fournisseurs');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="5">Aucun fournisseur</td></tr>'; return; }
    tbody.innerHTML = data.map(f => `<tr>
        <td>${f.nom}</td><td>${f.type_article || '-'}</td><td>${f.telephone || '-'}</td><td>${f.adresse || '-'}</td>
        <td>
            <button class="btn btn-sm" onclick="editFournisseur(${f.id})">Modifier</button>
            <button class="btn btn-sm btn-danger" onclick="deleteFournisseur(${f.id})">Supprimer</button>
        </td>
    </tr>`).join('');
}

function filterFournisseurs() {
    const q = document.getElementById('search-fournisseurs').value.toLowerCase();
    renderFournisseurs(fournisseursData.filter(f => (f.nom||'').toLowerCase().includes(q) || (f.type_article||'').toLowerCase().includes(q)));
}

function openNewFournisseurModal() {
    document.getElementById('modal-fournisseur-title').textContent = 'Nouveau Fournisseur';
    document.getElementById('fo-id').value = '';
    document.getElementById('fo-nom').value = '';
    document.getElementById('fo-type-article').value = '';
    document.getElementById('fo-telephone').value = '';
    document.getElementById('fo-adresse').value = '';
    openModal('modal-fournisseur');
}

function editFournisseur(id) {
    const fournisseur = fournisseursData.find(f => f.id === id);
    if (!fournisseur) return;
    document.getElementById('modal-fournisseur-title').textContent = 'Modifier Fournisseur';
    document.getElementById('fo-id').value = fournisseur.id;
    document.getElementById('fo-nom').value = fournisseur.nom || '';
    document.getElementById('fo-type-article').value = fournisseur.type_article || '';
    document.getElementById('fo-telephone').value = fournisseur.telephone || '';
    document.getElementById('fo-adresse').value = fournisseur.adresse || '';
    openModal('modal-fournisseur');
}

async function saveFournisseur() {
    const id = document.getElementById('fo-id').value;
    const fournisseur = {
        nom: document.getElementById('fo-nom').value,
        type_article: document.getElementById('fo-type-article').value,
        telephone: document.getElementById('fo-telephone').value,
        adresse: document.getElementById('fo-adresse').value,
    };
    try {
        if (id) {
            await apiFetch(`/fournisseurs/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(fournisseur) });
        } else {
            await apiFetch('/fournisseurs', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(fournisseur) });
        }
        closeModal('modal-fournisseur');
        fournisseursData = [];
        loadFournisseurs();
        showToast('Fournisseur enregistré !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deleteFournisseur(id) {
    if (!confirm('Voulez-vous vraiment supprimer ce fournisseur ?')) return;
    try {
        await apiFetch(`/fournisseurs/${id}`, { method: 'DELETE' });
        fournisseursData = [];
        loadFournisseurs();
    } catch(e) {
        if (e.status === 409) showToast(e.detail, 'error');
        else showToast('Erreur lors de la suppression : ' + e.message, 'error');
    }
}