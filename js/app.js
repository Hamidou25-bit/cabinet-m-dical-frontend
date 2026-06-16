let patientsData = [];
let stockData = [];
let utilisateursData = [];
let consultationsData = [];
let fournisseursData = [];
let depensesData = [];
let typesDepenseData = [];

// Echappe les caractères HTML sensibles pour éviter d'injecter du HTML
// dans les pages générées dynamiquement (impression, etc.)
function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Formate une date stockée au format ISO (YYYY-MM-DD ou YYYY-MM-DD HH:MM)
// en affichage JJ/MM/AAAA. Retourne la valeur d'origine si elle ne
// correspond pas au format attendu (ou une chaîne vide si non définie).
function formatDateFR(dateStr) {
    if (!dateStr) return '';
    const datePart = String(dateStr).split(/[ T]/)[0];
    const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return dateStr;
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
}

// Convertit une date saisie au format JJ/MM/AAAA en ISO YYYY-MM-DD.
// Retourne une chaîne vide si le format ne correspond pas.
function parseDateFR(str) {
    if (!str) return '';
    const m = String(str).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2]}-${m[1]}`;
}

// Vide un champ de date initialisé par Flatpickr (via l'API interne) ou en
// fallback sur la valeur DOM, pour éviter que Flatpickr conserve sa sélection
// interne alors que la valeur affichée est vide.
function clearFlatpickr(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el._flatpickr) el._flatpickr.clear();
    else el.value = '';
}

// Sidebar mobile : toggle hamburger
function toggleSidebar() { document.body.classList.toggle('sidebar-open'); }
function closeSidebar() { document.body.classList.remove('sidebar-open'); }

// Lit l'id de l'utilisateur courant depuis le payload JWT stocké en localStorage
function getCurrentUserId() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.id || null;
    } catch(e) { return null; }
}

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

    // Menu Personnel / Médecins / Comptabilité / Types de soins réservés aux admins
    if (localStorage.getItem('role') === 'admin') {
        document.getElementById('menu-section-admin').style.display = '';
        document.getElementById('menu-personnel').style.display = '';
        document.getElementById('menu-medecins').style.display = '';
        document.getElementById('menu-examens-config').style.display = '';
        document.getElementById('menu-type-soins').style.display = '';
        document.getElementById('menu-comptabilite').style.display = '';
    }

    // Initialisation Flatpickr sur tous les champs de filtre de date (format JJ/MM/AAAA)
    document.querySelectorAll('input[placeholder="JJ/MM/AAAA"]').forEach(input => {
        flatpickr(input, {
            dateFormat: 'd/m/Y',
            locale: 'fr',
            allowInput: true,
        });
    });

    // Chargement initial
    loadDashboard();
});

// Navigation
function showPage(page) {
    closeSidebar();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');

    // Met en surbrillance l'item de menu correspondant (s'il existe), que showPage()
    // soit appelée depuis un clic sur ce menu ou programmatiquement (ex: 'ordonnance-form')
    const menuItem = (typeof event !== 'undefined' && event && event.currentTarget && event.currentTarget.classList && event.currentTarget.classList.contains('menu-item'))
        ? event.currentTarget
        : document.querySelector(`.menu-item[onclick*="showPage('${page}')"]`);
    if (menuItem) menuItem.classList.add('active');

    const titles = { dashboard: 'Tableau de bord', patients: 'Patients', consultations: 'Consultations', stock: 'Stock', ordonnances: 'Ordonnances', examens: 'Examens complémentaires', soins: 'Soins', personnel: 'Personnel', medecins: 'Médecins', 'examens-config': "Types d'examens", 'type-soins': 'Types de soins', comptabilite: 'Comptabilité' };
    if (titles[page]) document.getElementById('page-title').textContent = titles[page];

    if (page === 'patients') loadPatients();
    if (page === 'consultations') loadConsultations();
    if (page === 'stock') loadStock();
    if (page === 'ordonnances') loadOrdonnances();
    if (page === 'examens') loadExamens();
    if (page === 'soins') loadSoins();
    if (page === 'type-soins') loadTypeSoinsAdmin();
    if (page === 'personnel') loadUtilisateurs();
    if (page === 'medecins') loadMedecins();
    if (page === 'examens-config') loadExamensConfig();
    if (page === 'comptabilite') loadFournisseurs();
}

// Modal
function openModal(id) {
    const modal = document.getElementById(id);
    modal.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    modal.classList.add('active');
}
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function openConfirmModal(message, onConfirm) {
    document.getElementById('modal-confirm-message').textContent = message;
    document.getElementById('modal-confirm-btn').onclick = () => {
        closeModal('modal-confirm');
        onConfirm();
    };
    openModal('modal-confirm');
}

// Validation générique des champs obligatoires d'un formulaire/modal
// fields: [{ id, label, highlightId?, min? }]
// - id : id de l'input/select contenant la valeur à vérifier
// - highlightId : id de l'élément à mettre en surbrillance si différent de `id` (ex: combobox patient)
// - min : valeur numérique minimale acceptée (optionnel)
function validateRequiredFields(fields) {
    const missing = [];
    fields.forEach(({ id, label, highlightId, min }) => {
        const valueEl = document.getElementById(id);
        const highlightEl = document.getElementById(highlightId || id);
        if (highlightEl) highlightEl.classList.remove('input-error');

        const value = valueEl ? valueEl.value : '';
        const isEmpty = value === null || value === undefined || String(value).trim() === '';
        const tooLow = !isEmpty && min !== undefined && parseFloat(value) < min;

        if (isEmpty || tooLow) {
            missing.push(label);
            if (highlightEl) highlightEl.classList.add('input-error');
        }
    });
    if (missing.length) {
        showToast(`Champ(s) obligatoire(s) manquant(s) ou invalide(s) : ${missing.join(', ')}`, 'error');
        return false;
    }
    return true;
}

// Validation générique des lignes d'un tableau dynamique (ordonnance, achat...)
// - lineSelector : sélecteur CSS des lignes (ex: '.ligne-achat')
// - designationSelector : sélecteur du champ "désignation" de chaque ligne
// - numericSelectors : sélecteurs des champs numériques qui doivent être > 0 (sur les lignes non vides)
// - emptyMessage : message affiché si aucune ligne valide n'est renseignée
function validateLignes(lineSelector, designationSelector, numericSelectors, emptyMessage) {
    const lines = document.querySelectorAll(lineSelector);
    let hasDesignation = false;
    let allValid = true;

    lines.forEach(div => {
        const designationInput = div.querySelector(designationSelector);
        designationInput.classList.remove('input-error');
        (numericSelectors || []).forEach(sel => div.querySelector(sel).classList.remove('input-error'));

        if (!designationInput.value.trim()) return; // ligne vide, ignorée
        hasDesignation = true;

        (numericSelectors || []).forEach(sel => {
            const input = div.querySelector(sel);
            if (!input.value || parseFloat(input.value) <= 0) {
                input.classList.add('input-error');
                allValid = false;
            }
        });
    });

    if (!hasDesignation) {
        showToast(emptyMessage, 'warning');
        return false;
    }
    if (!allValid) {
        showToast('Quantité et prix unitaire doivent être renseignés (et supérieurs à 0) pour chaque ligne', 'error');
        return false;
    }
    return true;
}

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
        <td>${p.nom}</td><td>${p.prenom}</td><td>${p.age}</td><td>${p.sexe}</td><td>${p.telephone || '-'}</td><td>${p.numero_dossier || '-'}</td><td>${p.email || '-'}</td><td>${formatDateFR(p.date_enregistrement)}</td>
        <td>
            <button class="btn btn-sm" onclick="editPatient(${p.id})">Modifier</button>
            <button class="btn btn-sm btn-danger" onclick="deletePatient(${p.id})">Supprimer</button>
        </td>
    </tr>`).join('');
}

function getFilteredPatients() {
    const q = document.getElementById('search-patients').value.toLowerCase();
    const dateDebut = parseDateFR(document.getElementById('filter-patients-date-debut').value);
    const dateFin = parseDateFR(document.getElementById('filter-patients-date-fin').value);
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

function resetFilterPatients() {
    clearFlatpickr('filter-patients-date-debut');
    clearFlatpickr('filter-patients-date-fin');
    document.getElementById('search-patients').value = '';
    filterPatients();
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
        "Date d'enregistrement": formatDateFR(p.date_enregistrement)
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
    if (!validateRequiredFields([
        { id: 'p-nom', label: 'Nom' },
        { id: 'p-prenom', label: 'Prénom' },
        { id: 'p-age', label: 'Âge', min: 0 },
    ])) return;

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
        <td>${formatDateFR(c.date_consult)}</td>
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
    const dateDebut = parseDateFR(document.getElementById('filter-consultations-date-debut').value);
    const dateFin = parseDateFR(document.getElementById('filter-consultations-date-fin').value);
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

function resetFilterConsultations() {
    clearFlatpickr('filter-consultations-date-debut');
    clearFlatpickr('filter-consultations-date-fin');
    document.getElementById('search-consultations').value = '';
    filterConsultations();
}

function exportConsultationsExcel() {
    const data = getFilteredConsultations();
    if (!data.length) { showToast('Aucune consultation à exporter', 'warning'); return; }
    const rows = data.map(c => ({
        'Date': formatDateFR(c.date_consult),
        'Patient': `${c.nom || ''} ${c.prenom || ''}`.trim(),
        'Médecin': c.medecin_nom || '',
        'Motif': c.motif || '',
        'Diagnostic': c.diagnostic || '',
        'Observation': c.observation || '',
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

async function ensureStockLoaded() {
    if (stockData.length) return;
    try {
        const data = await apiFetch('/stock').then(r => r.json());
        stockData = Array.isArray(data) ? data : [];
    } catch (e) {
        stockData = [];
    }
}

function populateStockDesignationsDatalist() {
    const datalist = document.getElementById('stock-designations');
    datalist.innerHTML = stockData.map(s => {
        const details = [s.Dosage, s.Forme].filter(Boolean).join(' - ');
        return `<option value="${s.Designation}">${s.Designation}${details ? ' (' + details + ')' : ''}</option>`;
    }).join('');
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

    openModal('modal-consultation');
}

function onConsultationPrixChange() {
    document.getElementById('co-montant-total').value = document.getElementById('co-prix-unitaire').value;
}

async function saveConsultation() {
    if (!validateRequiredFields([
        { id: 'co-patient', label: 'Patient', highlightId: 'co-patient-search' },
        { id: 'co-date', label: 'Date' },
        { id: 'co-motif', label: 'Motif' },
    ])) return;

    const id = document.getElementById('co-id').value;
    const patientId = parseInt(document.getElementById('co-patient').value);
    const data = {
        patient_id: patientId,
        medecin_id: document.getElementById('co-medecin').value ? parseInt(document.getElementById('co-medecin').value) : null,
        date_consult: document.getElementById('co-date').value,
        motif: document.getElementById('co-motif').value,
        prix_unitaire: parseFloat(document.getElementById('co-prix-unitaire').value) || 0,
        montant_total: parseFloat(document.getElementById('co-montant-total').value) || 0,
        diagnostic: document.getElementById('co-diagnostic').value,
        observation: document.getElementById('co-observation').value
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
        const statut = s.Quantite < 0 ? '<span class="status status-danger">Anomalie</span>' : s.Quantite <= 0 ? '<span class="status status-danger">Rupture</span>' : s.Quantite <= s.SeuilAlerte ? '<span class="status status-warning">Alerte</span>' : '<span class="status status-ok">Normal</span>';
        let peremption = '-';
        if (s.DatePeremption) {
            const datePeremption = new Date(s.DatePeremption);
            const classe = datePeremption <= new Date() ? 'status-danger' : datePeremption <= dans30Jours ? 'status-warning' : 'status-ok';
            peremption = `<span class="status ${classe}">${formatDateFR(s.DatePeremption)}</span>`;
        }
        const rowClass = s.Quantite <= 0 ? 'row-danger' : s.Quantite <= s.SeuilAlerte ? 'row-alert' : '';
        return `<tr class="${rowClass}">
            <td>${s.Designation||''}</td><td>${s.Type||''}</td><td>${s.Dosage||'-'}</td><td>${s.Forme||'-'}</td><td>${s.Quantite||0}</td><td>${s.SeuilAlerte||0}</td><td>${(s.PrixVente||0).toLocaleString()} FCFA</td><td>${peremption}</td><td>${statut}</td>
            <td>
                <button class="btn btn-sm" onclick="editStockArticle(${s.idStock})">Modifier</button>
                <button class="btn btn-sm btn-primary" onclick="openSortieModal(${s.idStock})">Sortie</button>
                <button class="btn btn-sm btn-danger" onclick="deleteStockArticle(${s.idStock})">Supprimer</button>
            </td>
        </tr>`;
    }).join('');
}

function filterStock() {
    const q = document.getElementById('search-stock').value.toLowerCase();
    renderStock(stockData.filter(s => (s.Designation||'').toLowerCase().includes(q)));
}

function exportStockExcel() {
    const q = document.getElementById('search-stock').value.toLowerCase();
    const data = stockData.filter(s => (s.Designation||'').toLowerCase().includes(q));
    if (!data.length) { showToast('Aucun article à exporter', 'warning'); return; }
    const rows = data.map(s => ({
        'Désignation': s.Designation || '',
        'Type': s.Type || '',
        'Dosage': s.Dosage || '',
        'Forme': s.Forme || '',
        'Quantité': s.Quantite || 0,
        'Seuil alerte': s.SeuilAlerte || 0,
        'Prix vente': s.PrixVente || 0,
        'Prix achat': s.PrixAchat || 0,
        'Fournisseur': s.Fournisseur || '',
        'Date entrée': formatDateFR(s.DateEntree),
        'Péremption': formatDateFR(s.DatePeremption)
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, `stock_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Onglets Comptabilité
function showComptabiliteTab(tab) {
    document.getElementById('comptabilite-tab-fournisseurs').style.display = tab === 'fournisseurs' ? '' : 'none';
    document.getElementById('tab-comptabilite-fournisseurs').className = tab === 'fournisseurs' ? 'btn btn-primary' : 'btn';
    document.getElementById('comptabilite-tab-depenses').style.display = tab === 'depenses' ? '' : 'none';
    document.getElementById('tab-comptabilite-depenses').className = tab === 'depenses' ? 'btn btn-primary' : 'btn';
    document.getElementById('comptabilite-tab-achats').style.display = tab === 'achats' ? '' : 'none';
    document.getElementById('tab-comptabilite-achats').className = tab === 'achats' ? 'btn btn-primary' : 'btn';
    document.getElementById('comptabilite-tab-synthese').style.display = tab === 'synthese' ? '' : 'none';
    document.getElementById('tab-comptabilite-synthese').className = tab === 'synthese' ? 'btn btn-primary' : 'btn';
    if (tab === 'fournisseurs') loadFournisseurs();
    if (tab === 'depenses') loadDepenses();
    if (tab === 'achats') loadAchats();
    if (tab === 'synthese') loadSynthese();
}

// Synthèse Comptabilité (Recettes / Dépenses / Profit)
let syntheseChart = null;

function setSynthesePeriode(periode) {
    const today = new Date();
    let debut, fin;
    if (periode === 'mois') {
        debut = new Date(today.getFullYear(), today.getMonth(), 1);
        fin = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (periode === 'mois-dernier') {
        debut = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        fin = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (periode === 'annee') {
        debut = new Date(today.getFullYear(), 0, 1);
        fin = new Date(today.getFullYear(), 11, 31);
    } else if (periode === 'tout') {
        debut = new Date(2000, 0, 1);
        fin = new Date(2100, 11, 31);
    }
    document.getElementById('synthese-date-debut').value = formatDateFR(debut.toISOString().split('T')[0]);
    document.getElementById('synthese-date-fin').value = formatDateFR(fin.toISOString().split('T')[0]);
    loadSynthese();
}

async function loadSynthese() {
    let dateDebut = parseDateFR(document.getElementById('synthese-date-debut').value);
    let dateFin = parseDateFR(document.getElementById('synthese-date-fin').value);
    if (!dateDebut || !dateFin) {
        const today = new Date();
        dateDebut = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        dateFin = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        document.getElementById('synthese-date-debut').value = formatDateFR(dateDebut);
        document.getElementById('synthese-date-fin').value = formatDateFR(dateFin);
    }
    try {
        const data = await apiFetch(`/comptabilite/synthese?date_debut=${dateDebut}&date_fin=${dateFin}`).then(r => r.json());
        renderSynthese(data);
    } catch (e) {
        showToast('Erreur lors du chargement de la synthèse', 'error');
    }
}

function renderSynthese(data) {
    const r = data.recettes;
    document.getElementById('synthese-recettes').textContent = `${r.total.toLocaleString()} FCFA`;
    document.getElementById('synthese-recettes-detail').innerHTML =
        `Consultations: ${r.detail.consultations.toLocaleString()} · Ordonnances: ${r.detail.ordonnances.toLocaleString()}<br>`
        + `Soins: ${r.detail.soins.toLocaleString()} · Examens: ${r.detail.examens.toLocaleString()}`;

    const d = data.depenses;
    document.getElementById('synthese-depenses').textContent = `${d.total.toLocaleString()} FCFA`;
    document.getElementById('synthese-depenses-detail').innerHTML =
        `Achats fournisseurs: ${d.detail.achats_fournisseurs.toLocaleString()} · Autres: ${d.detail.autres.toLocaleString()}`;

    const profitEl = document.getElementById('synthese-profit');
    profitEl.textContent = `${data.profit.toLocaleString()} FCFA`;
    const profitCard = document.getElementById('synthese-profit-card');
    profitCard.className = 'card ' + (data.profit >= 0 ? '' : 'orange');

    renderSyntheseChart(data.evolution);
}

function renderSyntheseChart(evolution) {
    const ctx = document.getElementById('synthese-chart');
    const labels = evolution.map(e => e.mois);
    const recettes = evolution.map(e => e.recettes);
    const depenses = evolution.map(e => e.depenses);

    if (syntheseChart) syntheseChart.destroy();
    syntheseChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Recettes', data: recettes, backgroundColor: '#0D9488' },
                { label: 'Dépenses', data: depenses, backgroundColor: '#DC2626' },
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// Remplit un select Fournisseur (Stock : valeur = nom, Achats : valeur = id)
function populateFournisseurSelect(selected, selectId = 'st-fournisseur', valueField = 'nom') {
    const select = document.getElementById(selectId);
    let options = '<option value="">-- Aucun --</option>' + fournisseursData.map(f => `<option value="${f[valueField]}">${f.nom}</option>`).join('');
    if (valueField === 'nom' && selected && !fournisseursData.some(f => f.nom === selected)) {
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
    if (!validateRequiredFields([
        { id: 'st-designation', label: 'Désignation' },
        { id: 'st-quantite', label: 'Quantité', min: 0 },
        { id: 'st-prix-vente', label: 'Prix vente', min: 0 },
    ])) return;

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
    if (!validateRequiredFields([
        { id: 'so-date', label: 'Date' },
        { id: 'so-quantite', label: 'Quantité', min: 1 },
    ])) return;

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

async function deleteStockArticle(id) {
    if (!confirm('Voulez-vous vraiment supprimer cet article du stock ? Cette action est irréversible.')) return;
    try {
        await apiFetch(`/stock/${id}`, { method: 'DELETE' });
        loadStock();
        showToast('Article supprimé du stock', 'success');
    } catch(e) { showToast('Erreur lors de la suppression : ' + e.message, 'error'); }
}

// Ordonnances
let dosagesData = [];
let formesData = [];
const ordonnancesData = { patient: [], tiers: [], interne: [] };
let ordonnanceFormReturnTab = 'patient';

async function loadOrdonnances() {
    showOrdonnancesTab(ordonnanceFormReturnTab);
}

function showOrdonnancesTab(type) {
    Object.keys(ordonnancesData).forEach(t => {
        document.getElementById('ordonnances-tab-' + t).style.display = t === type ? '' : 'none';
        document.getElementById('tab-ordonnances-' + t).className = t === type ? 'btn btn-primary' : 'btn';
    });
    loadOrdonnancesTab(type);
}

async function loadOrdonnancesTab(type) {
    const tbody = document.getElementById('table-ordonnances-' + type);
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Chargement...</td></tr>';
    try {
        const params = new URLSearchParams({ type_beneficiaire: type });
        const dateDebut = parseDateFR(document.getElementById(`filter-ordonnances-${type}-date-debut`).value);
        const dateFin = parseDateFR(document.getElementById(`filter-ordonnances-${type}-date-fin`).value);
        if (dateDebut) params.set('date_debut', dateDebut);
        if (dateFin) params.set('date_fin', dateFin);
        ordonnancesData[type] = await apiFetch(`/ordonnances/?${params.toString()}`).then(r => r.json());
        renderOrdonnancesTab(type);
    } catch(e) { tbody.innerHTML = '<tr><td colspan="6">Erreur</td></tr>'; }
}

function getFilteredOrdonnancesTab(type) {
    const q = document.getElementById('search-ordonnances-' + type).value.toLowerCase();
    return ordonnancesData[type].filter(o => {
        const beneficiaire = type === 'patient' ? `${o.nom || ''} ${o.prenom || ''}` : (o.beneficiaire || '');
        return beneficiaire.toLowerCase().includes(q) || (o.motif || '').toLowerCase().includes(q);
    });
}

function renderOrdonnancesTab(type) {
    const tbody = document.getElementById('table-ordonnances-' + type);
    const data = getFilteredOrdonnancesTab(type);
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="6">Aucune ordonnance</td></tr>'; return; }
    tbody.innerHTML = data.map(o => {
        const beneficiaire = type === 'patient' ? `${o.nom || ''} ${o.prenom || ''}`.trim() || '-' : (o.beneficiaire || '-');
        const statut = o.est_validee ? '<span class="status status-ok">Validée</span>' : '<span class="status status-warning">En attente</span>';
        return `<tr ondblclick="editOrdonnance(${o.id})">
            <td>${formatDateFR(o.date_ordonnance)}</td>
            <td>${escapeHtml(beneficiaire)}</td>
            <td>${escapeHtml(o.motif || '-')}</td>
            <td>${(o.montant_total || 0).toLocaleString()} FCFA</td>
            <td>${statut}</td>
            <td>
                <button class="btn btn-sm" onclick="editOrdonnance(${o.id})">Modifier</button>
                <button class="btn btn-sm" onclick="printOrdonnance(${o.id})">Imprimer</button>
                <button class="btn btn-sm btn-danger" onclick="deleteOrdonnance(${o.id}, '${type}')">Supprimer</button>
            </td>
        </tr>`;
    }).join('');
}

function filterOrdonnancesTab(type) {
    renderOrdonnancesTab(type);
}

function resetFilterOrdonnances(type) {
    clearFlatpickr(`filter-ordonnances-${type}-date-debut`);
    clearFlatpickr(`filter-ordonnances-${type}-date-fin`);
    document.getElementById('search-ordonnances-' + type).value = '';
    loadOrdonnancesTab(type);
}

async function exportOrdonnancesExcel(type) {
    try {
        const params = new URLSearchParams({ type_beneficiaire: type });
        const dateDebut = parseDateFR(document.getElementById(`filter-ordonnances-${type}-date-debut`).value);
        const dateFin = parseDateFR(document.getElementById(`filter-ordonnances-${type}-date-fin`).value);
        if (dateDebut) params.set('date_debut', dateDebut);
        if (dateFin) params.set('date_fin', dateFin);
        const { ordonnances } = await apiFetch(`/ordonnances/export?${params.toString()}`).then(r => r.json());
        if (!ordonnances.length) { showToast('Aucune ordonnance à exporter', 'warning'); return; }

        const lignesRows = [];
        const syntheseRows = [];
        ordonnances.forEach(o => {
            const beneficiaire = type === 'patient' ? `${o.nom || ''} ${o.prenom || ''}`.trim() : (o.beneficiaire || '');
            syntheseRows.push({
                'Date': formatDateFR(o.date_ordonnance),
                'Bénéficiaire': beneficiaire,
                'Motif': o.motif || '',
                'Total': o.montant_total || 0,
                'Statut': o.est_validee ? 'Validée' : 'En attente'
            });
            (o.lignes || []).forEach(l => {
                lignesRows.push({
                    'Ordonnance': o.id,
                    'Date': formatDateFR(o.date_ordonnance),
                    'Bénéficiaire': beneficiaire,
                    'Article': l.designation || '',
                    'Forme': l.forme || '',
                    'Dosage': l.dosage || '',
                    'Quantité': l.quantite || 0,
                    'Prix unitaire': l.quantite ? (l.montant || 0) / l.quantite : 0,
                    'Montant': l.montant || 0
                });
            });
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lignesRows), 'Détail');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(syntheseRows), 'Synthèse');
        XLSX.writeFile(wb, `ordonnances_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch(e) { showToast('Erreur lors de l\'export Excel', 'error'); }
}

let ordonnanceAImprimer = null;

async function printOrdonnance(id) {
    try {
        ordonnanceAImprimer = await apiFetch(`/ordonnances/${id}`).then(r => r.json());
        openModal('modal-print-choice');
    } catch(e) {
        showToast('Erreur lors du chargement de l\'ordonnance', 'error');
    }
}

function getOrdonnanceBeneficiaire(ordonnance) {
    return ordonnance.patient_id
        ? `${ordonnance.nom || ''} ${ordonnance.prenom || ''}`.trim()
        : (ordonnance.beneficiaire || '-');
}

function buildOrdonnanceHtml(ordonnance) {
    const beneficiaire = getOrdonnanceBeneficiaire(ordonnance);
    const lignesHtml = (ordonnance.lignes || []).map(l => `
        <tr>
            <td>${escapeHtml(l.designation || '')}</td>
            <td>${escapeHtml(l.forme || '')}</td>
            <td>${escapeHtml(l.dosage || '')}</td>
            <td>${l.quantite || ''}</td>
            <td>${escapeHtml(l.posologie || '')}${l.duree_jours ? ' — ' + l.duree_jours + ' jour(s)' : ''}</td>
        </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Ordonnance</title>
<style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1E293B; padding: 30px; }
    .header { text-align: center; border-bottom: 2px solid #0D9488; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { color: #0F766E; margin: 0 0 4px; font-size: 22px; }
    .header p { margin: 0; color: #64748B; }
    .info p { margin: 4px 0; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #E2E8F0; padding: 8px; font-size: 13px; text-align: left; }
    th { background: #F1F5F9; }
    .total { margin-top: 16px; text-align: right; font-size: 15px; font-weight: bold; }
    @media print { body { padding: 0; } }
</style>
</head>
<body>
    <div class="header">
        <h1>🏥 Cabinet Médical BabaMouneissa</h1>
        <p>Ordonnance médicale</p>
    </div>
    <div class="info">
        <p><strong>Bénéficiaire :</strong> ${escapeHtml(beneficiaire)}</p>
        <p><strong>Date :</strong> ${escapeHtml(formatDateFR(ordonnance.date_ordonnance))}</p>
        ${ordonnance.motif ? `<p><strong>Motif :</strong> ${escapeHtml(ordonnance.motif)}</p>` : ''}
    </div>
    <table>
        <thead>
            <tr><th>Médicament</th><th>Forme</th><th>Dosage</th><th>Qté</th><th>Posologie</th></tr>
        </thead>
        <tbody>${lignesHtml}</tbody>
    </table>
    <div class="total">Total : ${(ordonnance.montant_total || 0).toLocaleString()} FCFA</div>
</body>
</html>`;
}

function confirmPrintOrdonnance(mode) {
    if (!ordonnanceAImprimer) return;
    closeModal('modal-print-choice');
    if (mode === 'direct') {
        printOrdonnanceDirect(ordonnanceAImprimer);
    } else {
        exportOrdonnancePDF(ordonnanceAImprimer);
    }
}

function printOrdonnanceDirect(ordonnance) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Veuillez autoriser les pop-ups pour imprimer', 'error');
        return;
    }
    printWindow.document.write(buildOrdonnanceHtml(ordonnance));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

function exportOrdonnancePDF(ordonnance) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const beneficiaire = getOrdonnanceBeneficiaire(ordonnance);

    doc.setFontSize(16);
    doc.setTextColor(15, 118, 110);
    doc.text('Cabinet Médical BabaMouneissa', 105, 15, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text('Ordonnance médicale', 105, 22, { align: 'center' });

    doc.setTextColor(30);
    doc.setFontSize(11);
    let y = 35;
    doc.text(`Bénéficiaire : ${beneficiaire}`, 14, y);
    y += 6;
    doc.text(`Date : ${formatDateFR(ordonnance.date_ordonnance)}`, 14, y);
    if (ordonnance.motif) {
        y += 6;
        doc.text(`Motif : ${ordonnance.motif}`, 14, y);
    }

    const rows = (ordonnance.lignes || []).map(l => [
        l.designation || '',
        l.forme || '',
        l.dosage || '',
        String(l.quantite || ''),
        `${l.posologie || ''}${l.duree_jours ? ' - ' + l.duree_jours + ' jour(s)' : ''}`
    ]);

    doc.autoTable({
        startY: y + 6,
        head: [['Médicament', 'Forme', 'Dosage', 'Qté', 'Posologie']],
        body: rows,
        headStyles: { fillColor: [13, 148, 136] },
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Total : ${(ordonnance.montant_total || 0).toLocaleString()} FCFA`, 196, finalY, { align: 'right' });

    doc.save(`ordonnance_${ordonnance.id}_${ordonnance.date_ordonnance || ''}.pdf`);
}

async function loadOrdonnanceRefs() {
    await ensureStockLoaded();
    populateStockDesignationsDatalist();
}

function onTypeBeneficiaireChange() {
    const type = ordonnanceFormReturnTab;
    const patientGroup = document.getElementById('o-patient-group');
    const beneficiaireGroup = document.getElementById('o-beneficiaire-group');
    const beneficiaireLabel = document.getElementById('o-beneficiaire-label');

    if (type === 'patient') {
        patientGroup.style.display = '';
        beneficiaireGroup.style.display = 'none';
    } else if (type === 'tiers') {
        patientGroup.style.display = 'none';
        beneficiaireGroup.style.display = '';
        beneficiaireLabel.innerHTML = 'Nom du bénéficiaire<span class="required-mark">*</span>';
    } else {
        patientGroup.style.display = 'none';
        beneficiaireGroup.style.display = '';
        beneficiaireLabel.innerHTML = 'Nom du bénéficiaire (optionnel)';
    }
}

async function openOrdonnanceModal(type) {
    document.getElementById('ordonnance-form-title').textContent = 'Nouvelle Ordonnance';
    document.getElementById('page-title').textContent = 'Nouvelle Ordonnance';
    document.getElementById('o-id').value = '';
    ordonnanceFormReturnTab = type || 'patient';

    // Remplir la liste des patients + charger dosages/formes/stock en parallèle
    const tasks = [loadOrdonnanceRefs(), ensureStockLoaded()];
    if (!patientsData.length) tasks.push(loadPatients());
    await Promise.all(tasks);
    populateStockDesignationsDatalist();
    resetPatientCombo('o');

    // Date par défaut = aujourd'hui
    document.getElementById('o-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('o-motif').value = '';
    document.getElementById('o-beneficiaire').value = '';
    document.getElementById('o-est-validee').checked = false;
    onTypeBeneficiaireChange();

    // Réinitialiser les lignes
    document.getElementById('lignes-ordonnance').innerHTML = '';
    addLigneOrdonnance();

    showPage('ordonnance-form');
}

async function editOrdonnance(id) {
    document.getElementById('ordonnance-form-title').textContent = 'Modifier l\'ordonnance';
    document.getElementById('page-title').textContent = 'Modifier l\'ordonnance';
    document.getElementById('o-id').value = id;

    const tasks = [loadOrdonnanceRefs(), ensureStockLoaded(), apiFetch(`/ordonnances/${id}`).then(r => r.json())];
    if (!patientsData.length) tasks.push(loadPatients());

    try {
        const [, , ordonnance] = await Promise.all(tasks);
        populateStockDesignationsDatalist();

        ordonnanceFormReturnTab = ordonnance.type_beneficiaire || 'patient';
        onTypeBeneficiaireChange();

        if (ordonnance.patient_id) {
            setPatientComboValue('o', ordonnance.patient_id);
        } else {
            resetPatientCombo('o');
        }
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

        showPage('ordonnance-form');
    } catch(e) { showToast('Erreur lors du chargement de l\'ordonnance', 'error'); }
}

function addLigneOrdonnance(ligne) {
    const container = document.getElementById('lignes-ordonnance');
    const wrapper = document.createElement('div');
    wrapper.className = 'ligne-ordonnance-wrapper';
    const formeOptions = ['Comprimé','Sirop','Injectable','Sachet','Pommade','Suppositoire','Goutte','Autre'];
    wrapper.innerHTML = `
        <div class="ligne-ordonnance">
            <input type="text" placeholder="Médicament *" class="lo-designation" list="stock-designations" value="${ligne ? (ligne.designation || '') : ''}" oninput="onLigneOrdonnanceDesignationInput(this)">
            <input type="text" placeholder="Dosage" class="lo-dosage" value="${ligne ? (ligne.dosage || '') : ''}">
            <select class="lo-forme"><option value="">Forme</option>${formeOptions.map(f => `<option value="${f}" ${ligne && ligne.forme === f ? 'selected' : ''}>${f}</option>`).join('')}</select>
            <input type="number" placeholder="Qté" class="lo-quantite" value="${ligne ? (ligne.quantite || 1) : 1}" min="1" oninput="updateLigneOrdonnanceMontant(this)">
            <input type="text" placeholder="Posologie" class="lo-posologie" value="${ligne ? (ligne.posologie || '') : ''}">
            <input type="number" placeholder="Jours" class="lo-duree" value="${ligne && ligne.duree_jours ? ligne.duree_jours : ''}">
            <input type="number" placeholder="Montant" class="lo-montant" value="${ligne ? (ligne.montant || 0) : 0}" min="0" oninput="updateOrdonnanceTotalDisplay()">
            <button class="btn-remove" onclick="removeLigneOrdonnance(this)">✕</button>
        </div>
        <input type="hidden" class="lo-stock-id" value="${ligne && ligne.stock_id ? ligne.stock_id : ''}">
        <div class="ligne-ordonnance-info"></div>
    `;
    container.appendChild(wrapper);
    refreshLigneOrdonnanceInfo(wrapper);
}

function removeLigneOrdonnance(button) {
    button.closest('.ligne-ordonnance-wrapper').remove();
    updateOrdonnanceTotalDisplay();
}

function updateOrdonnanceTotalDisplay() {
    const total = Array.from(document.querySelectorAll('.ligne-ordonnance-wrapper')).reduce((sum, wrapper) => {
        return sum + (parseFloat(wrapper.querySelector('.lo-montant').value) || 0);
    }, 0);
    const totalDiv = document.getElementById('o-montant-total');
    if (totalDiv) totalDiv.textContent = `Total : ${total.toLocaleString()} FCFA`;
}

// Detecte si la designation saisie correspond a un article du stock :
// si oui, lie la ligne a cet article (stock_id) et calcule le montant
// (quantite x PrixVente) en lecture seule ; sinon, le montant est saisi
// manuellement (medicament externe, non stocke).
function refreshLigneOrdonnanceInfo(wrapper) {
    const designation = wrapper.querySelector('.lo-designation').value.trim();
    const stockIdField = wrapper.querySelector('.lo-stock-id');
    const infoDiv = wrapper.querySelector('.ligne-ordonnance-info');
    const montantInput = wrapper.querySelector('.lo-montant');
    const quantite = parseFloat(wrapper.querySelector('.lo-quantite').value) || 0;

    let match = null;
    if (stockIdField.value) {
        match = stockData.find(s => String(s.idStock) === String(stockIdField.value));
    }
    if (!match && designation) {
        match = stockData.find(s => (s.Designation || '').trim().toLowerCase() === designation.toLowerCase());
    }

    if (designation && match) {
        stockIdField.value = match.idStock;
        const isInterne = ordonnanceFormReturnTab === 'interne';
        const prix = isInterne ? (match.PrixAchat || 0) : (match.PrixVente || 0);
        const labelPrix = isInterne ? "Prix d'achat" : "Prix de vente";
        infoDiv.innerHTML = `<span class="status status-ok">Médicament en stock</span> ${labelPrix} : <strong>${prix.toLocaleString()} FCFA</strong>`;
        montantInput.value = quantite * prix;
        montantInput.readOnly = true;
    } else if (designation) {
        stockIdField.value = '';
        infoDiv.innerHTML = `<span class="status status-warning">Médicament externe (non stocké)</span> saisissez le montant manuellement`;
        montantInput.readOnly = false;
    } else {
        stockIdField.value = '';
        infoDiv.innerHTML = '';
        montantInput.readOnly = false;
    }
    updateOrdonnanceTotalDisplay();
}

// Quand l'utilisateur saisit/selectionne un medicament, si celui-ci correspond
// a un article du stock, pre-remplit forme et dosage a partir de cet article
// (laisse les champs vides et modifiables si l'article n'a pas de forme/dosage,
// ou s'il s'agit d'un medicament externe).
function onLigneOrdonnanceDesignationInput(input) {
    const wrapper = input.closest('.ligne-ordonnance-wrapper');
    wrapper.querySelector('.lo-stock-id').value = '';
    refreshLigneOrdonnanceInfo(wrapper);

    const stockId = wrapper.querySelector('.lo-stock-id').value;
    const dosageInput = wrapper.querySelector('.lo-dosage');
    const formeSelect = wrapper.querySelector('.lo-forme');
    const match = stockId ? stockData.find(s => String(s.idStock) === String(stockId)) : null;
    dosageInput.value = (match && match.Dosage) ? match.Dosage : '';
    formeSelect.value = (match && match.Forme && [...formeSelect.options].some(o => o.value === match.Forme)) ? match.Forme : '';
}

function updateLigneOrdonnanceMontant(input) {
    refreshLigneOrdonnanceInfo(input.closest('.ligne-ordonnance-wrapper'));
}

async function saveOrdonnance() {
    const typeBeneficiaire = ordonnanceFormReturnTab;

    const requiredFields = [{ id: 'o-date', label: 'Date' }];
    if (typeBeneficiaire === 'patient') {
        requiredFields.push({ id: 'o-patient', label: 'Patient', highlightId: 'o-patient-search' });
    }
    if (!validateRequiredFields(requiredFields)) return;

    if (typeBeneficiaire === 'tiers' && !document.getElementById('o-beneficiaire').value.trim()) {
        document.getElementById('o-beneficiaire').classList.add('input-error');
        showToast('Le nom du bénéficiaire est obligatoire pour une vente à un tiers', 'error');
        return;
    }
    document.getElementById('o-beneficiaire').classList.remove('input-error');

    if (!validateLignes('.ligne-ordonnance-wrapper', '.lo-designation', [], 'Ajoutez au moins un médicament')) return;

    const id = document.getElementById('o-id').value;
    const lignes = Array.from(document.querySelectorAll('.ligne-ordonnance-wrapper')).map(wrapper => {
        const ligne = {
            designation: wrapper.querySelector('.lo-designation').value,
            dosage: wrapper.querySelector('.lo-dosage').value,
            forme: wrapper.querySelector('.lo-forme').value,
            quantite: parseInt(wrapper.querySelector('.lo-quantite').value) || 1,
            posologie: wrapper.querySelector('.lo-posologie').value,
            duree_jours: parseInt(wrapper.querySelector('.lo-duree').value) || null,
        };
        const stockId = wrapper.querySelector('.lo-stock-id').value;
        if (stockId) {
            ligne.stock_id = parseInt(stockId);
        } else {
            ligne.stock_id = null;
            ligne.montant = parseFloat(wrapper.querySelector('.lo-montant').value) || 0;
        }
        return ligne;
    }).filter(l => l.designation.trim() !== '');

    const patientId = document.getElementById('o-patient').value;

    const data = {
        patient_id: typeBeneficiaire === 'patient' && patientId ? parseInt(patientId) : null,
        date_ordonnance: document.getElementById('o-date').value,
        motif: document.getElementById('o-motif').value,
        type_beneficiaire: typeBeneficiaire,
        beneficiaire: document.getElementById('o-beneficiaire').value,
        est_validee: document.getElementById('o-est-validee').checked ? 1 : 0,
        lignes: lignes
    };

    try {
        if (id) {
            await apiFetch(`/ordonnances/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        } else {
            await apiFetch('/ordonnances', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        }
        showPage('ordonnances');
        showOrdonnancesTab(typeBeneficiaire);
        showToast('Ordonnance enregistrée !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deleteOrdonnance(id, type) {
    if (!confirm('Voulez-vous vraiment supprimer cette ordonnance ?')) return;
    try {
        await apiFetch(`/ordonnances/${id}`, { method: 'DELETE' });
        loadOrdonnancesTab(type);
    } catch(e) { showToast('Erreur lors de la suppression', 'error'); }
}

let medecinsData = [];

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
    tbody.innerHTML = data.map(e => {
        const patientDisplay = e.patient_id
            ? `${e.nom || ''} ${e.prenom || ''}`.trim()
            : (e.nom_patient_externe || '-');
        return `<tr>
            <td>${formatDateFR(e.date_examen)}</td>
            <td>${escapeHtml(patientDisplay)}${!e.patient_id ? ' <span style="font-size:0.75em;color:#6b7280;">(ext.)</span>' : ''}</td>
            <td>${escapeHtml(e.type_nom || '-')}</td>
            <td>${escapeHtml(e.examen_nom || '-')}</td>
            <td>${escapeHtml(e.resultat || '-')}</td>
            <td>${(e.prix || 0).toLocaleString()} FCFA</td>
            <td>
                <button class="btn btn-sm" onclick="printExamen(${e.id})">🖨️ Imprimer</button>
                <button class="btn btn-sm" onclick="editExamen(${e.id})">Modifier</button>
                <button class="btn btn-sm btn-danger" onclick="deleteExamen(${e.id})">Supprimer</button>
            </td>
        </tr>`;
    }).join('');
}

function getFilteredExamens() {
    const q = document.getElementById('search-examens').value.toLowerCase();
    const dateDebut = parseDateFR(document.getElementById('filter-examens-date-debut').value);
    const dateFin = parseDateFR(document.getElementById('filter-examens-date-fin').value);
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

function resetFilterExamens() {
    clearFlatpickr('filter-examens-date-debut');
    clearFlatpickr('filter-examens-date-fin');
    document.getElementById('search-examens').value = '';
    filterExamens();
}

function exportExamensExcel() {
    const data = getFilteredExamens();
    if (!data.length) { showToast('Aucun examen à exporter', 'warning'); return; }
    const rows = data.map(e => ({
        'Date': formatDateFR(e.date_examen),
        'Patient': e.patient_id ? `${e.nom || ''} ${e.prenom || ''}`.trim() : (e.nom_patient_externe || ''),
        'Type patient': e.patient_id ? 'Enregistré' : 'Externe',
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
    if (!typesExamensData.length) tasks.push(apiFetch('/examens-types/').then(r => r.json()).then(d => typesExamensData = Array.isArray(d) ? d : []).catch(() => typesExamensData = []));
    if (tasks.length) await Promise.all(tasks);

    const medecinSelect = document.getElementById('e-medecin');
    medecinSelect.innerHTML = '<option value="">-- Aucun --</option>' + medecinsData.map(m => `<option value="${m.id}">${m.nom}</option>`).join('');
}

// Retourne la liste des catégories d'examens (id + nom) déduite des types d'examens chargés
function getExamenCategoriesList() {
    const map = new Map();
    typesExamensData.forEach(t => { if (!map.has(t.type_examen_id)) map.set(t.type_examen_id, t.type_nom); });
    return [...map.entries()].map(([id, nom]) => ({ id, nom }));
}

function addLigneExamen() {
    const container = document.getElementById('examen-lignes-container');
    const categories = getExamenCategoriesList();
    const catOptions = categories.map(c => `<option value="${c.id}">${c.nom}</option>`).join('');
    const wrapper = document.createElement('div');
    wrapper.className = 'ligne-examen-wrapper';
    wrapper.innerHTML = `
        <div class="ligne-examen">
            <select class="le-categorie" onchange="onLigneExamenCategorieChange(this)">${catOptions}</select>
            <select class="le-type" onchange="onLigneExamenTypeChange(this)"></select>
            <input type="number" class="le-prix" placeholder="Prix" min="0" oninput="updateExamenTotalDisplay()">
            <button class="btn-remove" onclick="removeLigneExamen(this)">✕</button>
        </div>
    `;
    container.appendChild(wrapper);
    onLigneExamenCategorieChange(wrapper.querySelector('.le-categorie'));
    updateExamenLignesRemoveButtons();
}

function removeLigneExamen(btn) {
    btn.closest('.ligne-examen-wrapper').remove();
    updateExamenLignesRemoveButtons();
    updateExamenTotalDisplay();
}

function updateExamenLignesRemoveButtons() {
    const wrappers = document.querySelectorAll('#examen-lignes-container .ligne-examen-wrapper');
    wrappers.forEach(w => {
        w.querySelector('.btn-remove').style.display = wrappers.length > 1 ? '' : 'none';
    });
}

function onLigneExamenCategorieChange(select) {
    const wrapper = select.closest('.ligne-examen-wrapper');
    const typeSelect = wrapper.querySelector('.le-type');
    const categorieId = parseInt(select.value);
    const types = typesExamensData.filter(t => t.type_examen_id === categorieId);
    typeSelect.innerHTML = types.map(t => `<option value="${t.id}" data-tarif="${t.tarif}">${t.nom}</option>`).join('');
    onLigneExamenTypeChange(typeSelect);
}

function onLigneExamenTypeChange(select) {
    const wrapper = select.closest('.ligne-examen-wrapper');
    const selected = select.options[select.selectedIndex];
    wrapper.querySelector('.le-prix').value = selected ? (selected.dataset.tarif || 0) : 0;
    updateExamenTotalDisplay();
}

function updateExamenTotalDisplay() {
    let total = 0;
    document.querySelectorAll('#examen-lignes-container .le-prix').forEach(input => total += parseFloat(input.value) || 0);
    document.getElementById('e-total').value = total.toLocaleString() + ' FCFA';
}

function onExamenTypePatientChange(val) {
    const isEnregistre = val === 'enregistre';
    document.getElementById('e-patient-group').style.display = isEnregistre ? '' : 'none';
    document.getElementById('e-externe-group').style.display = isEnregistre ? 'none' : '';
}

async function openExamenModal() {
    document.getElementById('modal-examen-title').textContent = 'Nouvel Examen Complémentaire';
    document.getElementById('e-id').value = '';

    // Réinitialiser le toggle type patient
    document.getElementById('e-type-enregistre').checked = true;
    onExamenTypePatientChange('enregistre');
    document.getElementById('e-nom-externe').value = '';

    const tasks = [loadExamenRefs()];
    if (!patientsData.length) tasks.push(loadPatients());
    await Promise.all(tasks);
    resetPatientCombo('e');

    document.getElementById('e-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('e-renseignement').value = '';
    document.getElementById('e-resultat').value = '';

    document.getElementById('examen-lignes-container').innerHTML = '';
    addLigneExamen();
    document.getElementById('btn-add-ligne-examen').style.display = '';
    updateExamenTotalDisplay();

    openModal('modal-examen');
}

async function editExamen(id) {
    const examen = examensData.find(e => e.id === id);
    if (!examen) return;

    document.getElementById('modal-examen-title').textContent = 'Modifier Examen';
    document.getElementById('e-id').value = examen.id;

    // Restaurer le bon type de patient
    const isExterne = !examen.patient_id && examen.nom_patient_externe;
    document.getElementById(isExterne ? 'e-type-externe' : 'e-type-enregistre').checked = true;
    onExamenTypePatientChange(isExterne ? 'externe' : 'enregistre');
    document.getElementById('e-nom-externe').value = examen.nom_patient_externe || '';

    const tasks = [loadExamenRefs()];
    if (!patientsData.length) tasks.push(loadPatients());
    await Promise.all(tasks);
    if (!isExterne) setPatientComboValue('e', examen.patient_id);

    document.getElementById('examen-lignes-container').innerHTML = '';
    addLigneExamen();
    const wrapper = document.querySelector('#examen-lignes-container .ligne-examen-wrapper');
    const sousType = typesExamensData.find(t => t.id === examen.sous_type_examen_id);
    if (sousType) {
        wrapper.querySelector('.le-categorie').value = sousType.type_examen_id;
        onLigneExamenCategorieChange(wrapper.querySelector('.le-categorie'));
        wrapper.querySelector('.le-type').value = examen.sous_type_examen_id;
    }
    wrapper.querySelector('.le-prix').value = examen.prix || 0;
    document.getElementById('btn-add-ligne-examen').style.display = 'none';
    updateExamenTotalDisplay();

    document.getElementById('e-date').value = examen.date_examen || '';
    document.getElementById('e-medecin').value = examen.medecin_id || '';
    document.getElementById('e-renseignement').value = examen.renseignement_clinique || '';
    document.getElementById('e-resultat').value = examen.resultat || '';

    openModal('modal-examen');
}

async function saveExamen() {
    const isExterne = document.getElementById('e-type-externe').checked;
    const requiredFields = [{ id: 'e-date', label: 'Date' }];
    if (isExterne) {
        requiredFields.push({ id: 'e-nom-externe', label: 'Nom du patient externe' });
    } else {
        requiredFields.push({ id: 'e-patient', label: 'Patient', highlightId: 'e-patient-search' });
    }
    if (!validateRequiredFields(requiredFields)) return;

    const lignes = document.querySelectorAll('#examen-lignes-container .ligne-examen-wrapper');
    for (const ligne of lignes) {
        const sousType = ligne.querySelector('.le-type');
        if (!sousType.value) {
            showToast('Veuillez sélectionner un examen pour chaque ligne', 'error');
            return;
        }
    }

    const id = document.getElementById('e-id').value;
    const patientId = isExterne ? null : (parseInt(document.getElementById('e-patient').value) || null);
    const nomPatientExterne = isExterne ? (document.getElementById('e-nom-externe').value.trim() || null) : null;

    // Guard : parseInt peut retourner NaN→null si le champ caché contient une valeur non numérique.
    // validateRequiredFields vérifie que le champ n'est pas vide mais pas que c'est un entier valide.
    if (!isExterne && patientId === null) {
        document.getElementById('e-patient-search').classList.add('input-error');
        showToast('Veuillez sélectionner un patient dans la liste', 'error');
        return;
    }
    if (isExterne && !nomPatientExterne) {
        document.getElementById('e-nom-externe').classList.add('input-error');
        showToast('Le nom du patient externe est obligatoire', 'error');
        return;
    }
    const dateExamen = document.getElementById('e-date').value;
    const medecinId = document.getElementById('e-medecin').value ? parseInt(document.getElementById('e-medecin').value) : null;
    const renseignement = document.getElementById('e-renseignement').value;
    const resultat = document.getElementById('e-resultat').value || null;

    try {
        if (id) {
            const ligne = lignes[0];
            const data = {
                patient_id: patientId,
                nom_patient_externe: nomPatientExterne,
                sous_type_examen_id: parseInt(ligne.querySelector('.le-type').value),
                date_examen: dateExamen,
                prix: parseFloat(ligne.querySelector('.le-prix').value) || 0,
                medecin_id: medecinId,
                renseignement_clinique: renseignement,
                resultat: resultat
            };
            await apiFetch(`/examens-complementaires/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        } else {
            for (const ligne of lignes) {
                const data = {
                    patient_id: patientId,
                    nom_patient_externe: nomPatientExterne,
                    sous_type_examen_id: parseInt(ligne.querySelector('.le-type').value),
                    date_examen: dateExamen,
                    prix: parseFloat(ligne.querySelector('.le-prix').value) || 0,
                    medecin_id: medecinId,
                    renseignement_clinique: renseignement,
                    resultat: resultat
                };
                await apiFetch('/examens-complementaires/', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
            }
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

function printExamen(id) {
    const examen = examensData.find(e => e.id === id);
    if (!examen) return;

    const patientNom = examen.patient_id
        ? `${examen.nom || ''} ${examen.prenom || ''}`.trim()
        : (examen.nom_patient_externe || 'Patient externe');
    const typePatient = examen.patient_id ? 'Patient enregistré' : 'Patient externe';
    const medecin = examen.medecin_nom ? examen.medecin_nom : '-';
    const dateStr = formatDateFR(examen.date_examen);

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Résultat Examen — ${escapeHtml(patientNom)}</title>
<style>
body{font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:20px;color:#111;}
.header{text-align:center;border-bottom:2px solid #0d9488;padding-bottom:12px;margin-bottom:20px;}
.header h1{margin:0;font-size:1.2em;color:#0d9488;letter-spacing:1px;}
.header p{margin:2px 0;font-size:0.85em;color:#555;}
.section{margin-bottom:16px;}
.section h2{font-size:0.95em;text-transform:uppercase;color:#0d9488;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-bottom:8px;}
.row{display:flex;gap:20px;margin-bottom:6px;}
.label{font-weight:600;min-width:180px;color:#374151;}
.value{color:#111;}
.resultat-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;white-space:pre-wrap;min-height:80px;}
.footer{margin-top:30px;border-top:1px solid #e5e7eb;padding-top:10px;text-align:right;font-size:0.8em;color:#6b7280;}
@media print{body{padding:10px;}.footer{position:fixed;bottom:10px;right:10px;}}
</style></head><body>
<div class="header">
    <h1>🏥 Cabinet Médical BabaMouneissa</h1>
    <p>Résultat d'examen complémentaire</p>
</div>
<div class="section">
    <h2>Informations patient</h2>
    <div class="row"><span class="label">Nom :</span><span class="value">${escapeHtml(patientNom)}</span></div>
    <div class="row"><span class="label">Type :</span><span class="value">${escapeHtml(typePatient)}</span></div>
    <div class="row"><span class="label">Date de l'examen :</span><span class="value">${escapeHtml(dateStr)}</span></div>
</div>
<div class="section">
    <h2>Détail de l'examen</h2>
    <div class="row"><span class="label">Catégorie :</span><span class="value">${escapeHtml(examen.type_nom || '-')}</span></div>
    <div class="row"><span class="label">Type d'examen :</span><span class="value">${escapeHtml(examen.examen_nom || '-')}</span></div>
    <div class="row"><span class="label">Médecin :</span><span class="value">${escapeHtml(medecin)}</span></div>
    <div class="row"><span class="label">Prix :</span><span class="value">${(examen.prix || 0).toLocaleString()} FCFA</span></div>
</div>
${examen.renseignement_clinique ? `<div class="section"><h2>Renseignement clinique</h2><div class="resultat-box">${escapeHtml(examen.renseignement_clinique)}</div></div>` : ''}
<div class="section">
    <h2>Résultat</h2>
    <div class="resultat-box">${escapeHtml(examen.resultat || '(Résultat non encore disponible)')}</div>
</div>
<div class="footer">Imprimé le ${new Date().toLocaleDateString('fr-FR')} — Cabinet Médical BabaMouneissa</div>
</body></html>`;

    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
}

// Utilisateurs (gestion des comptes — admin uniquement)
async function loadUtilisateurs() {
    try {
        utilisateursData = await apiFetch('/utilisateurs/').then(r => r.json());
        renderUtilisateurs(getFilteredUtilisateurs());
    } catch(e) {
        const tbody = document.getElementById('table-utilisateurs');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5">Erreur chargement</td></tr>';
    }
}

function getFilteredUtilisateurs() {
    const q = (document.getElementById('search-utilisateurs')?.value || '').toLowerCase();
    return utilisateursData.filter(u =>
        (u.nom_complet||'').toLowerCase().includes(q) ||
        (u.nom_utilisateur||'').toLowerCase().includes(q) ||
        (u.role||'').toLowerCase().includes(q)
    );
}

function filterUtilisateurs() {
    renderUtilisateurs(getFilteredUtilisateurs());
}

const ROLE_LABELS = { admin: 'Administrateur', medecin: 'Médecin', secretaire: 'Secrétaire' };

function renderUtilisateurs(data) {
    const tbody = document.getElementById('table-utilisateurs');
    if (!tbody) return;
    const currentId = getCurrentUserId();
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="5">Aucun utilisateur</td></tr>'; return; }
    tbody.innerHTML = data.map(u => {
        const isMe = u.id === currentId;
        const statut = u.actif !== false
            ? '<span class="status status-ok">Actif</span>'
            : '<span class="status status-danger">Inactif</span>';
        const supprimerBtn = isMe
            ? `<button class="btn btn-sm btn-danger" disabled title="Impossible de supprimer votre propre compte">Supprimer</button>`
            : `<button class="btn btn-sm btn-danger" onclick="deleteUtilisateur(${u.id}, '${escapeHtml(u.nom_utilisateur)}')">Supprimer</button>`;
        return `<tr>
            <td>${escapeHtml(u.nom_complet || '-')}</td>
            <td>${escapeHtml(u.nom_utilisateur)}</td>
            <td>${ROLE_LABELS[u.role] || u.role}</td>
            <td>${statut}</td>
            <td style="display:flex;gap:4px;flex-wrap:wrap;">
                <button class="btn btn-sm" onclick="editUtilisateur(${u.id})">Modifier</button>
                <button class="btn btn-sm" onclick="openChangePasswordModal(${u.id})">Mot de passe</button>
                ${supprimerBtn}
            </td>
        </tr>`;
    }).join('');
}

function openNewUtilisateurModal() {
    document.getElementById('modal-utilisateur-title').textContent = 'Nouvel Utilisateur';
    document.getElementById('u-id').value = '';
    document.getElementById('u-nom').value = '';
    document.getElementById('u-login').value = '';
    document.getElementById('u-password').value = '';
    document.getElementById('u-role').value = 'secretaire';
    document.getElementById('u-password-group').style.display = '';
    document.querySelector('#u-password-group label').innerHTML = 'Mot de passe<span class="required-mark">*</span>';
    openModal('modal-utilisateur');
}

function editUtilisateur(id) {
    const u = utilisateursData.find(x => x.id === id);
    if (!u) return;
    document.getElementById('modal-utilisateur-title').textContent = 'Modifier Utilisateur';
    document.getElementById('u-id').value = u.id;
    document.getElementById('u-nom').value = u.nom_complet || '';
    document.getElementById('u-login').value = u.nom_utilisateur || '';
    document.getElementById('u-password').value = '';
    document.getElementById('u-role').value = u.role || 'secretaire';
    document.getElementById('u-password-group').style.display = 'none';
    openModal('modal-utilisateur');
}

async function saveUtilisateur() {
    const id = document.getElementById('u-id').value;
    const isNew = !id;

    const fields = [
        { id: 'u-nom', label: 'Nom complet' },
        { id: 'u-login', label: 'Login' },
        { id: 'u-role', label: 'Rôle' },
    ];
    if (isNew) fields.push({ id: 'u-password', label: 'Mot de passe' });
    if (!validateRequiredFields(fields)) return;

    const payload = {
        nom_complet: document.getElementById('u-nom').value.trim(),
        nom_utilisateur: document.getElementById('u-login').value.trim(),
        role: document.getElementById('u-role').value,
    };
    if (isNew) payload.mot_de_passe = document.getElementById('u-password').value;

    try {
        if (isNew) {
            await apiFetch('/utilisateurs/', { method: 'POST', body: JSON.stringify(payload) });
        } else {
            await apiFetch(`/utilisateurs/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        }
        closeModal('modal-utilisateur');
        loadUtilisateurs();
        showToast('Utilisateur enregistré !', 'success');
    } catch(e) { showToast(e.message || 'Erreur', 'error'); }
}

async function deleteUtilisateur(id, login) {
    openConfirmModal(`Supprimer l'utilisateur « ${login} » ? Cette action est irréversible.`, async () => {
        try {
            await apiFetch(`/utilisateurs/${id}`, { method: 'DELETE' });
            loadUtilisateurs();
            showToast('Utilisateur supprimé', 'success');
        } catch(e) { showToast(e.message || 'Erreur lors de la suppression', 'error'); }
    });
}

function openChangePasswordModal(id) {
    document.getElementById('pwd-id').value = id;
    document.getElementById('pwd-new').value = '';
    document.getElementById('pwd-confirm').value = '';
    openModal('modal-password');
}

async function savePassword() {
    const id = document.getElementById('pwd-id').value;
    const pwd = document.getElementById('pwd-new').value;
    const confirm = document.getElementById('pwd-confirm').value;

    if (!validateRequiredFields([
        { id: 'pwd-new', label: 'Nouveau mot de passe' },
        { id: 'pwd-confirm', label: 'Confirmation' },
    ])) return;
    if (pwd !== confirm) {
        showToast('Les mots de passe ne correspondent pas', 'error');
        document.getElementById('pwd-confirm').classList.add('input-error');
        return;
    }
    try {
        await apiFetch(`/utilisateurs/${id}/password`, { method: 'PUT', body: JSON.stringify({ mot_de_passe: pwd }) });
        closeModal('modal-password');
        showToast('Mot de passe mis à jour !', 'success');
    } catch(e) { showToast(e.message || 'Erreur', 'error'); }
}

// Mon compte : l'admin peut changer son propre login et/ou mot de passe
async function saveMonCompte() {
    const newLogin = document.getElementById('mc-login').value.trim();
    const newPwd = document.getElementById('mc-password').value;
    const confirmPwd = document.getElementById('mc-password-confirm').value;

    if (!newLogin && !newPwd) {
        showToast('Saisissez un nouveau login et/ou un nouveau mot de passe', 'warning');
        return;
    }
    if (newPwd && newPwd !== confirmPwd) {
        showToast('Les mots de passe ne correspondent pas', 'error');
        document.getElementById('mc-password-confirm').classList.add('input-error');
        return;
    }

    const currentId = getCurrentUserId();
    if (!currentId) { showToast('Impossible de récupérer votre identifiant', 'error'); return; }

    try {
        if (newLogin) {
            const currentU = utilisateursData.find(u => u.id === currentId);
            await apiFetch(`/utilisateurs/${currentId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    nom_utilisateur: newLogin,
                    nom_complet: currentU?.nom_complet || '',
                    role: currentU?.role || 'admin',
                })
            });
            localStorage.setItem('nom_utilisateur', newLogin);
            const userEl = document.getElementById('user-name');
            if (userEl) userEl.textContent = '👤 ' + newLogin;
        }
        if (newPwd) {
            await apiFetch(`/utilisateurs/${currentId}/password`, {
                method: 'PUT',
                body: JSON.stringify({ mot_de_passe: newPwd })
            });
        }
        document.getElementById('mc-login').value = '';
        document.getElementById('mc-password').value = '';
        document.getElementById('mc-password-confirm').value = '';
        showToast('Modifications enregistrées ! Reconnectez-vous si vous avez changé votre login.', 'success', 4000);
        loadUtilisateurs();
    } catch(e) { showToast(e.message || 'Erreur', 'error'); }
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
    if (!validateRequiredFields([
        { id: 'me-nom', label: 'Nom' },
    ])) return;

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

// Examens - Configuration (Catégories & Types)
let categoriesExamensData = [];

async function loadExamensConfig() {
    try {
        const [categories, types] = await Promise.all([
            apiFetch('/examens-categories').then(r => r.json()),
            apiFetch('/examens-types').then(r => r.json())
        ]);
        categoriesExamensData = categories;
        typesExamensData = types;
        renderCategoriesExamens(categoriesExamensData);
        renderTypesExamens(typesExamensData);
    } catch(e) {
        document.getElementById('table-categories-examens').innerHTML = '<tr><td colspan="2">Erreur</td></tr>';
        document.getElementById('table-types-examens').innerHTML = '<tr><td colspan="4">Erreur</td></tr>';
    }
}

function renderCategoriesExamens(data) {
    const tbody = document.getElementById('table-categories-examens');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="2">Aucune catégorie</td></tr>'; return; }
    tbody.innerHTML = data.map(c => `<tr>
        <td>${c.nom}</td>
        <td>
            <button class="btn btn-sm" onclick="editCategorieExamen(${c.id})">Modifier</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCategorieExamen(${c.id})">Supprimer</button>
        </td>
    </tr>`).join('');
}

function renderTypesExamens(data) {
    const tbody = document.getElementById('table-types-examens');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="4">Aucun type d\'examen</td></tr>'; return; }
    tbody.innerHTML = data.map(t => `<tr>
        <td>${t.type_nom || '-'}</td>
        <td>${t.nom}</td>
        <td>${(t.tarif || 0).toLocaleString()} FCFA</td>
        <td>
            <button class="btn btn-sm" onclick="editTypeExamen(${t.id})">Modifier</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTypeExamen(${t.id})">Supprimer</button>
        </td>
    </tr>`).join('');
}

function populateCategorieExamenSelect(selected) {
    const select = document.getElementById('te-categorie');
    select.innerHTML = categoriesExamensData.map(c => `<option value="${c.id}">${c.nom}</option>`).join('');
    select.value = selected || '';
}

function openNewCategorieExamenModal() {
    document.getElementById('modal-categorie-examen-title').textContent = 'Nouvelle Catégorie';
    document.getElementById('ce-id').value = '';
    document.getElementById('ce-nom').value = '';
    openModal('modal-categorie-examen');
}

function editCategorieExamen(id) {
    const categorie = categoriesExamensData.find(c => c.id === id);
    if (!categorie) return;
    document.getElementById('modal-categorie-examen-title').textContent = 'Modifier Catégorie';
    document.getElementById('ce-id').value = categorie.id;
    document.getElementById('ce-nom').value = categorie.nom || '';
    openModal('modal-categorie-examen');
}

async function saveCategorieExamen() {
    if (!validateRequiredFields([
        { id: 'ce-nom', label: 'Nom' },
    ])) return;

    const id = document.getElementById('ce-id').value;
    const categorie = { nom: document.getElementById('ce-nom').value };
    try {
        if (id) {
            await apiFetch(`/examens-categories/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(categorie) });
        } else {
            await apiFetch('/examens-categories', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(categorie) });
        }
        closeModal('modal-categorie-examen');
        typesExamensData = [];
        loadExamensConfig();
        showToast('Catégorie enregistrée !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deleteCategorieExamen(id) {
    if (!confirm('Voulez-vous vraiment supprimer cette catégorie ?')) return;
    try {
        await apiFetch(`/examens-categories/${id}`, { method: 'DELETE' });
        loadExamensConfig();
    } catch(e) {
        if (e.status === 409) showToast(e.detail, 'error');
        else showToast('Erreur lors de la suppression : ' + e.message, 'error');
    }
}

function openNewTypeExamenModal() {
    document.getElementById('modal-type-examen-title').textContent = "Nouveau Type d'examen";
    document.getElementById('te-id').value = '';
    populateCategorieExamenSelect('');
    document.getElementById('te-nom').value = '';
    document.getElementById('te-prix').value = '';
    openModal('modal-type-examen');
}

function editTypeExamen(id) {
    const type = typesExamensData.find(t => t.id === id);
    if (!type) return;
    document.getElementById('modal-type-examen-title').textContent = "Modifier Type d'examen";
    document.getElementById('te-id').value = type.id;
    populateCategorieExamenSelect(type.type_examen_id);
    document.getElementById('te-nom').value = type.nom || '';
    document.getElementById('te-prix').value = type.tarif || 0;
    openModal('modal-type-examen');
}

async function saveTypeExamen() {
    if (!validateRequiredFields([
        { id: 'te-categorie', label: 'Catégorie' },
        { id: 'te-nom', label: 'Nom' },
        { id: 'te-prix', label: 'Prix', min: 0 },
    ])) return;

    const id = document.getElementById('te-id').value;
    const type = {
        type_examen_id: parseInt(document.getElementById('te-categorie').value),
        nom: document.getElementById('te-nom').value,
        tarif: parseFloat(document.getElementById('te-prix').value) || 0,
    };
    try {
        if (id) {
            await apiFetch(`/examens-types/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(type) });
        } else {
            await apiFetch('/examens-types', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(type) });
        }
        closeModal('modal-type-examen');
        typesExamensData = [];
        loadExamensConfig();
        showToast('Type d\'examen enregistré !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deleteTypeExamen(id) {
    if (!confirm('Voulez-vous vraiment supprimer ce type d\'examen ?')) return;
    try {
        await apiFetch(`/examens-types/${id}`, { method: 'DELETE' });
        typesExamensData = [];
        loadExamensConfig();
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
    if (!validateRequiredFields([
        { id: 'fo-nom', label: 'Nom' },
    ])) return;

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

// Dépenses
async function loadDepenses() {
    try {
        const [depenses, types] = await Promise.all([
            apiFetch('/depenses').then(r => r.json()),
            apiFetch('/type-depense').then(r => r.json())
        ]);
        depensesData = depenses;
        typesDepenseData = types;
        populateTypeDepenseFilter();
        renderDepenses(depensesData);
    } catch(e) { document.getElementById('table-depenses').innerHTML = '<tr><td colspan="4">Erreur</td></tr>'; }
}

function renderDepenses(data) {
    const tbody = document.getElementById('table-depenses');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="5">Aucune dépense</td></tr>'; return; }
    tbody.innerHTML = data.map(d => {
        const actions = d.achat_id
            ? `<span class="status status-ok" title="Générée automatiquement depuis l'achat #${d.achat_id}. Modifiez ou annulez cet achat pour la mettre à jour.">Liée à l'achat #${d.achat_id}</span>`
            : `<button class="btn btn-sm" onclick="editDepense(${d.id_depense})">Modifier</button>
               <button class="btn btn-sm btn-danger" onclick="deleteDepense(${d.id_depense})">Supprimer</button>`;
        return `<tr>
        <td>${formatDateFR(d.date_depense)}</td><td>${d.type_depense}</td><td>${(d.montant || 0).toLocaleString()} FCFA</td><td>${d.description || '-'}</td>
        <td>${actions}</td>
    </tr>`;
    }).join('');
}

function populateTypeDepenseFilter() {
    const select = document.getElementById('filter-type-depense');
    select.innerHTML = '<option value="">Tous les types</option>' + typesDepenseData.map(t => `<option value="${t.nom}">${t.nom}</option>`).join('');
}

function getFilteredDepenses() {
    const type = document.getElementById('filter-type-depense').value;
    const dateDebut = parseDateFR(document.getElementById('filter-depenses-date-debut').value);
    const dateFin = parseDateFR(document.getElementById('filter-depenses-date-fin').value);
    return depensesData.filter(d => {
        const matchType = !type || d.type_depense === type;
        const matchDateDebut = !dateDebut || (d.date_depense && d.date_depense >= dateDebut);
        const matchDateFin = !dateFin || (d.date_depense && d.date_depense <= dateFin);
        return matchType && matchDateDebut && matchDateFin;
    });
}

function filterDepenses() {
    renderDepenses(getFilteredDepenses());
}

function resetFilterDepenses() {
    document.getElementById('filter-type-depense').value = '';
    clearFlatpickr('filter-depenses-date-debut');
    clearFlatpickr('filter-depenses-date-fin');
    renderDepenses(depensesData);
}

function exportDepensesExcel() {
    const data = getFilteredDepenses();
    if (!data.length) { showToast('Aucune dépense à exporter', 'warning'); return; }
    const rows = data.map(d => ({
        'Date': formatDateFR(d.date_depense),
        'Type': d.type_depense || '',
        'Montant': d.montant || 0,
        'Description': d.description || '',
        "Lié à l'achat": d.achat_id ? `#${d.achat_id}` : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dépenses');
    XLSX.writeFile(wb, `depenses_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function populateTypeDepenseSelect(selected) {
    const select = document.getElementById('de-type');
    select.innerHTML = typesDepenseData.map(t => `<option value="${t.nom}">${t.nom}</option>`).join('')
        + '<option value="__new__">+ Nouveau type...</option>';
    if (selected) select.value = selected;
    toggleNewTypeDepense();
}

function toggleNewTypeDepense() {
    const isNew = document.getElementById('de-type').value === '__new__';
    document.getElementById('de-type-new-row').style.display = isNew ? '' : 'none';
    if (!isNew) document.getElementById('de-type-new').value = '';
}

function openNewDepenseModal() {
    document.getElementById('modal-depense-title').textContent = 'Nouvelle Dépense';
    document.getElementById('de-id').value = '';
    document.getElementById('de-date').value = '';
    populateTypeDepenseSelect('');
    document.getElementById('de-montant').value = '';
    document.getElementById('de-description').value = '';
    openModal('modal-depense');
}

function editDepense(id) {
    const depense = depensesData.find(d => d.id_depense === id);
    if (!depense) return;
    document.getElementById('modal-depense-title').textContent = 'Modifier Dépense';
    document.getElementById('de-id').value = depense.id_depense;
    document.getElementById('de-date').value = depense.date_depense;
    populateTypeDepenseSelect(depense.type_depense);
    document.getElementById('de-montant').value = depense.montant;
    document.getElementById('de-description').value = depense.description || '';
    openModal('modal-depense');
}

async function saveDepense() {
    const isNewType = document.getElementById('de-type').value === '__new__';
    const fields = [
        { id: 'de-date', label: 'Date' },
        { id: 'de-type', label: 'Type' },
        { id: 'de-montant', label: 'Montant', min: 0.01 },
    ];
    if (isNewType) fields.push({ id: 'de-type-new', label: 'Nouveau type de dépense' });
    if (!validateRequiredFields(fields)) return;

    const id = document.getElementById('de-id').value;
    let typeDepense = document.getElementById('de-type').value;

    if (isNewType) {
        const nouveauType = document.getElementById('de-type-new').value.trim();
        try {
            await apiFetch('/type-depense/', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ nom: nouveauType }) });
        } catch(e) {
            showToast('Erreur lors de la création du type de dépense : ' + e.message, 'error');
            return;
        }
        typeDepense = nouveauType;
    }

    const depense = {
        date_depense: document.getElementById('de-date').value,
        type_depense: typeDepense,
        montant: parseFloat(document.getElementById('de-montant').value) || 0,
        description: document.getElementById('de-description').value,
    };
    try {
        if (id) {
            await apiFetch(`/depenses/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(depense) });
        } else {
            await apiFetch('/depenses', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(depense) });
        }
        closeModal('modal-depense');
        loadDepenses();
        showToast('Dépense enregistrée !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deleteDepense(id) {
    if (!confirm('Voulez-vous vraiment supprimer cette dépense ?')) return;
    try {
        await apiFetch(`/depenses/${id}`, { method: 'DELETE' });
        loadDepenses();
        showToast('Dépense supprimée !', 'success');
    } catch(e) { showToast('Erreur lors de la suppression : ' + e.message, 'error'); }
}

// Achats
let achatsData = [];
const statutPaiementClasses = { 'Payé': 'status-ok', 'Non payé': 'status-danger', 'Partiel': 'status-warning' };

async function loadAchats() {
    try {
        const [achats] = await Promise.all([apiFetch('/achats').then(r => r.json()), ensureFournisseursLoaded()]);
        achatsData = achats;
        renderAchats(achatsData);
    } catch(e) { document.getElementById('table-achats').innerHTML = '<tr><td colspan="6">Erreur</td></tr>'; }
}

function renderAchats(data) {
    const tbody = document.getElementById('table-achats');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="6">Aucun achat</td></tr>'; return; }
    tbody.innerHTML = data.map(a => `<tr>
        <td>${a.numero_facture || '-'}</td>
        <td>${formatDateFR(a.date_achat)}</td>
        <td>${a.fournisseur_nom || '-'}</td>
        <td>${(a.montant_total || 0).toLocaleString()} FCFA</td>
        <td><span class="status ${statutPaiementClasses[a.statut_paiement] || 'status-warning'}">${a.statut_paiement || ''}</span></td>
        <td>
            <button class="btn btn-sm" onclick="editAchat(${a.id})">Modifier</button>
            <button class="btn btn-sm btn-danger" onclick="deleteAchat(${a.id})">Supprimer</button>
        </td>
    </tr>`).join('');
}

function getFilteredAchats() {
    const q = document.getElementById('search-achats').value.toLowerCase();
    const dateDebut = parseDateFR(document.getElementById('filter-achats-date-debut').value);
    const dateFin = parseDateFR(document.getElementById('filter-achats-date-fin').value);
    return achatsData.filter(a => {
        const matchQ = (a.numero_facture||'').toLowerCase().includes(q)
            || (a.fournisseur_nom||'').toLowerCase().includes(q)
            || (a.statut_paiement||'').toLowerCase().includes(q);
        const matchDateDebut = !dateDebut || (a.date_achat && a.date_achat >= dateDebut);
        const matchDateFin = !dateFin || (a.date_achat && a.date_achat <= dateFin);
        return matchQ && matchDateDebut && matchDateFin;
    });
}

function filterAchats() {
    renderAchats(getFilteredAchats());
}

function resetFilterAchats() {
    document.getElementById('search-achats').value = '';
    clearFlatpickr('filter-achats-date-debut');
    clearFlatpickr('filter-achats-date-fin');
    renderAchats(achatsData);
}

function exportAchatsExcel() {
    const data = getFilteredAchats();
    if (!data.length) { showToast('Aucun achat à exporter', 'warning'); return; }
    const rows = data.map(a => ({
        'N° Facture': a.numero_facture || '',
        'Date': formatDateFR(a.date_achat),
        'Fournisseur': a.fournisseur_nom || '',
        'Montant total': a.montant_total || 0,
        'Statut paiement': a.statut_paiement || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Achats');
    XLSX.writeFile(wb, `achats_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function openNewAchatModal() {
    document.getElementById('modal-achat-title').textContent = 'Nouvel Achat';
    document.getElementById('ac-id').value = '';
    await Promise.all([ensureFournisseursLoaded(), ensureStockLoaded()]);
    populateStockDesignationsDatalist();
    populateFournisseurSelect('', 'ac-fournisseur', 'id');
    document.getElementById('ac-numero-facture').value = '';
    document.getElementById('ac-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('ac-statut-paiement').value = 'Non payé';
    document.getElementById('ac-notes').value = '';
    document.getElementById('lignes-achat').innerHTML = '';
    addLigneAchat();
    updateAchatTotal();
    openModal('modal-achat');
}

async function editAchat(id) {
    document.getElementById('modal-achat-title').textContent = 'Modifier Achat';
    document.getElementById('ac-id').value = id;
    try {
        // Force-reload du stock pour inclure les articles créés lors du premier enregistrement de cet achat.
        // ensureStockLoaded() utilise le cache et raterait les nouveaux articles, causant un doublon à la modification.
        const [, stockRaw, achat] = await Promise.all([
            ensureFournisseursLoaded(),
            apiFetch('/stock').then(r => r.json()),
            apiFetch(`/achats/${id}`).then(r => r.json())
        ]);
        stockData = Array.isArray(stockRaw) ? stockRaw : [];
        populateStockDesignationsDatalist();
        populateFournisseurSelect(achat.fournisseur_id || '', 'ac-fournisseur', 'id');
        document.getElementById('ac-numero-facture').value = achat.numero_facture || '';
        document.getElementById('ac-date').value = achat.date_achat || '';
        document.getElementById('ac-statut-paiement').value = achat.statut_paiement || 'Non payé';
        document.getElementById('ac-notes').value = achat.notes || '';

        document.getElementById('lignes-achat').innerHTML = '';
        if (achat.lignes && achat.lignes.length) {
            achat.lignes.forEach(ligne => addLigneAchat(ligne));
        } else {
            addLigneAchat();
        }
        updateAchatTotal();

        openModal('modal-achat');
    } catch(e) { showToast('Erreur lors du chargement de l\'achat', 'error'); }
}

function addLigneAchat(ligne) {
    const container = document.getElementById('lignes-achat');
    const wrapper = document.createElement('div');
    wrapper.className = 'ligne-achat-wrapper';
    wrapper.innerHTML = `
        <div class="ligne-achat">
            <input type="text" placeholder="Désignation *" class="la-designation" list="stock-designations" value="${ligne ? (ligne.designation || '') : ''}" oninput="onLigneAchatDesignationInput(this)">
            <input type="number" placeholder="Qté *" class="la-quantite" value="${ligne ? (ligne.quantite || 1) : 1}" min="1" oninput="updateLigneAchatMontant(this)">
            <input type="number" placeholder="Prix unitaire *" class="la-prix-unitaire" value="${ligne ? (ligne.prix_unitaire || 0) : 0}" min="0" oninput="updateLigneAchatMontant(this)">
            <input type="number" placeholder="Montant" class="la-montant" value="${ligne ? (ligne.montant || 0) : 0}" readonly>
            <button class="btn-remove" onclick="this.closest('.ligne-achat-wrapper').remove(); updateAchatTotal();">✕</button>
        </div>
        <input type="hidden" class="la-stock-id" value="${ligne && ligne.stock_id ? ligne.stock_id : ''}">
        <div class="ligne-achat-info"></div>
        <div class="ligne-achat-nouvel" style="display:none;">
            <input type="number" placeholder="Prix de vente" class="la-prix-vente" min="0">
            <input type="number" placeholder="Seuil alerte" class="la-seuil-alerte" min="0">
            <input type="text" placeholder="Dosage (ex: 500mg)" class="la-dosage">
            <select class="la-forme">
                <option value="">-- Forme --</option>
                <option value="Comprimé">Comprimé</option>
                <option value="Sirop">Sirop</option>
                <option value="Injectable">Injectable</option>
                <option value="Sachet">Sachet</option>
                <option value="Pommade">Pommade</option>
                <option value="Suppositoire">Suppositoire</option>
                <option value="Goutte">Goutte</option>
                <option value="Autre">Autre</option>
            </select>
            <input type="date" placeholder="Date péremption" class="la-date-peremption">
        </div>
    `;
    container.appendChild(wrapper);
    refreshLigneAchatInfo(wrapper);
    updateAchatTotal();
}

// Detecte si la designation saisie correspond a un article existant du stock :
// si oui, lie la ligne a cet article (stock_id) et affiche sa quantite actuelle ;
// sinon, affiche les champs additionnels pour la creation d'un nouvel article.
function refreshLigneAchatInfo(wrapper) {
    const designation = wrapper.querySelector('.la-designation').value.trim();
    const stockIdField = wrapper.querySelector('.la-stock-id');
    const infoDiv = wrapper.querySelector('.ligne-achat-info');
    const nouvelDiv = wrapper.querySelector('.ligne-achat-nouvel');

    let match = null;
    if (stockIdField.value) {
        match = stockData.find(s => String(s.idStock) === String(stockIdField.value));
    }
    if (!match && designation) {
        match = stockData.find(s => (s.Designation || '').trim().toLowerCase() === designation.toLowerCase());
    }

    if (designation && match) {
        stockIdField.value = match.idStock;
        const details = [match.Dosage, match.Forme].filter(Boolean).join(' - ');
        infoDiv.innerHTML = `<span class="status status-ok">Article existant</span> En stock : <strong>${match.Quantite}</strong>` + (details ? ` · ${details}` : '');
        nouvelDiv.style.display = 'none';

        const prixInput = wrapper.querySelector('.la-prix-unitaire');
        if ((parseFloat(prixInput.value) || 0) === 0 && match.PrixAchat) {
            prixInput.value = match.PrixAchat;
            updateLigneAchatMontant(prixInput);
        }
    } else if (designation) {
        stockIdField.value = '';
        infoDiv.innerHTML = `<span class="status status-warning">Nouvel article</span> sera ajouté au stock à l'enregistrement`;
        nouvelDiv.style.display = '';
    } else {
        stockIdField.value = '';
        infoDiv.innerHTML = '';
        nouvelDiv.style.display = 'none';
    }
}

function onLigneAchatDesignationInput(input) {
    const wrapper = input.closest('.ligne-achat-wrapper');
    wrapper.querySelector('.la-stock-id').value = '';
    refreshLigneAchatInfo(wrapper);
}

function updateLigneAchatMontant(input) {
    const div = input.parentElement;
    const quantite = parseFloat(div.querySelector('.la-quantite').value) || 0;
    const prixUnitaire = parseFloat(div.querySelector('.la-prix-unitaire').value) || 0;
    div.querySelector('.la-montant').value = quantite * prixUnitaire;
    updateAchatTotal();
}

function updateAchatTotal() {
    const total = Array.from(document.querySelectorAll('.ligne-achat')).reduce((sum, div) => {
        return sum + (parseFloat(div.querySelector('.la-montant').value) || 0);
    }, 0);
    document.getElementById('ac-montant-total').textContent = total.toLocaleString();
}

async function saveAchat() {
    if (!validateRequiredFields([
        { id: 'ac-date', label: 'Date' },
    ])) return;

    if (!validateLignes('.ligne-achat', '.la-designation', ['.la-quantite', '.la-prix-unitaire'], 'Ajoutez au moins un article')) return;

    const id = document.getElementById('ac-id').value;
    const lignes = Array.from(document.querySelectorAll('.ligne-achat-wrapper')).map(wrapper => {
        const ligne = {
            designation: wrapper.querySelector('.la-designation').value,
            quantite: parseFloat(wrapper.querySelector('.la-quantite').value) || 1,
            prix_unitaire: parseFloat(wrapper.querySelector('.la-prix-unitaire').value) || 0,
        };
        const stockId = wrapper.querySelector('.la-stock-id').value;
        if (stockId) {
            ligne.stock_id = parseInt(stockId);
        } else {
            const prixVente = wrapper.querySelector('.la-prix-vente').value;
            const seuilAlerte = wrapper.querySelector('.la-seuil-alerte').value;
            const dosage = wrapper.querySelector('.la-dosage').value;
            const forme = wrapper.querySelector('.la-forme').value;
            const datePeremption = wrapper.querySelector('.la-date-peremption').value;
            if (prixVente) ligne.prix_vente = parseFloat(prixVente);
            if (seuilAlerte) ligne.seuil_alerte = parseInt(seuilAlerte);
            if (dosage) ligne.dosage = dosage;
            if (forme) ligne.forme = forme;
            if (datePeremption) ligne.date_peremption = datePeremption;
        }
        return ligne;
    }).filter(l => l.designation.trim() !== '');

    const fournisseurId = document.getElementById('ac-fournisseur').value;
    const data = {
        fournisseur_id: fournisseurId ? parseInt(fournisseurId) : null,
        numero_facture: document.getElementById('ac-numero-facture').value,
        date_achat: document.getElementById('ac-date').value,
        statut_paiement: document.getElementById('ac-statut-paiement').value,
        notes: document.getElementById('ac-notes').value,
        lignes: lignes
    };

    try {
        if (id) {
            await apiFetch(`/achats/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        } else {
            await apiFetch('/achats', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        }
        closeModal('modal-achat');
        loadAchats();
        showToast('Achat enregistré !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

function deleteAchat(id) {
    openConfirmModal('Êtes-vous sûr de vouloir supprimer définitivement cet achat ? Cette action est irréversible.', async () => {
        try {
            await apiFetch(`/achats/${id}`, { method: 'DELETE' });
            loadAchats();
            showToast('Achat supprimé', 'success');
        } catch(e) { showToast('Erreur lors de la suppression : ' + e.message, 'error'); }
    });
}

// =====================================================================
// MODULE SOINS
// =====================================================================
let soinsData = { enregistre: [], externe: [] };
let typeSoinsData = [];

async function loadSoins() {
    showSoinsTab(currentSoinsTab || 'enregistre');
}

let currentSoinsTab = 'enregistre';

function showSoinsTab(tab) {
    currentSoinsTab = tab;
    ['enregistre', 'externe'].forEach(t => {
        document.getElementById('soins-tab-' + t).style.display = t === tab ? '' : 'none';
        document.getElementById('tab-soins-' + t).className = t === tab ? 'btn btn-primary' : 'btn';
    });
    loadSoinsTab(tab);
}

async function loadSoinsTab(tab) {
    const tbody = document.getElementById('table-soins-' + tab);
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Chargement...</td></tr>';
    try {
        const params = new URLSearchParams({ type_patient: tab });
        const dateDebut = parseDateFR(document.getElementById(`filter-soins-${tab}-date-debut`).value);
        const dateFin = parseDateFR(document.getElementById(`filter-soins-${tab}-date-fin`).value);
        if (dateDebut) params.set('date_debut', dateDebut);
        if (dateFin) params.set('date_fin', dateFin);
        soinsData[tab] = await apiFetch(`/soins/?${params.toString()}`).then(r => r.json());
        renderSoinsTab(tab);
    } catch(e) { tbody.innerHTML = '<tr><td colspan="6">Erreur</td></tr>'; }
}

function getFilteredSoinsTab(tab) {
    const q = document.getElementById('search-soins-' + tab).value.toLowerCase();
    return soinsData[tab].filter(s => {
        const nom = tab === 'enregistre'
            ? `${s.patient_nom || ''} ${s.patient_prenom || ''}`.toLowerCase()
            : (s.nom_patient_externe || '').toLowerCase();
        return nom.includes(q) || (s.type_soin_nom || '').toLowerCase().includes(q);
    });
}

function filterSoinsTab(tab) {
    renderSoinsTab(tab);
}

function resetFilterSoins(tab) {
    clearFlatpickr(`filter-soins-${tab}-date-debut`);
    clearFlatpickr(`filter-soins-${tab}-date-fin`);
    document.getElementById('search-soins-' + tab).value = '';
    loadSoinsTab(tab);
}

function renderSoinsTab(tab) {
    const tbody = document.getElementById('table-soins-' + tab);
    const data = getFilteredSoinsTab(tab);
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="6">Aucun soin</td></tr>'; return; }
    tbody.innerHTML = data.map(s => {
        const patient = tab === 'enregistre'
            ? `${s.patient_nom || ''} ${s.patient_prenom || ''}`.trim() || '-'
            : (s.nom_patient_externe || '-');
        return `<tr>
            <td>${formatDateFR(s.date_soin)}</td>
            <td>${escapeHtml(patient)}</td>
            <td>${escapeHtml(s.type_soin_nom || '-')}</td>
            <td>${(s.prix_applique || 0).toLocaleString()} FCFA</td>
            <td>${escapeHtml(s.notes || '-')}</td>
            <td>
                <button class="btn btn-sm" onclick="editSoin(${s.id}, '${tab}')">Modifier</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSoin(${s.id}, '${tab}')">Supprimer</button>
                <button class="btn btn-sm" onclick="printSoin(${s.id}, '${tab}')">🖨️ Imprimer</button>
            </td>
        </tr>`;
    }).join('');
}

function exportSoinsExcel(tab) {
    const data = getFilteredSoinsTab(tab);
    if (!data.length) { showToast('Aucun soin à exporter', 'warning'); return; }
    const rows = data.map(s => ({
        'Date': formatDateFR(s.date_soin),
        'Patient': tab === 'enregistre'
            ? `${s.patient_nom || ''} ${s.patient_prenom || ''}`.trim()
            : (s.nom_patient_externe || ''),
        'Type de soin': s.type_soin_nom || '',
        'Prix appliqué': s.prix_applique || 0,
        'Notes': s.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Soins');
    XLSX.writeFile(wb, `soins_${tab}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function ensureTypeSoinsLoaded() {
    if (typeSoinsData.length) return;
    try {
        typeSoinsData = await apiFetch('/type-soins/').then(r => r.json());
    } catch(e) { typeSoinsData = []; }
}

function populateTypeSoinSelect(selectId, selectedId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- Choisir --</option>'
        + typeSoinsData.map(t => `<option value="${t.id}" data-prix="${t.prix_defaut}">${t.nom} (${(t.prix_defaut||0).toLocaleString()} FCFA)</option>`).join('');
    if (selectedId) select.value = selectedId;
}

function onTypeSoinChange(selectId, prixInputId) {
    const select = document.getElementById(selectId);
    const opt = select.options[select.selectedIndex];
    const prixDefaut = opt ? parseFloat(opt.dataset.prix || 0) : 0;
    const prixInput = document.getElementById(prixInputId);
    if (prixInput && !prixInput.dataset.modified) {
        prixInput.value = prixDefaut;
    }
}

async function openNewSoinModal(tab) {
    currentSoinsTab = tab;
    document.getElementById('modal-soin-title').textContent = 'Nouveau Soin';
    document.getElementById('sn-id').value = '';

    await Promise.all([ensureTypeSoinsLoaded(), patientsData.length ? null : loadPatients()].filter(Boolean));
    populateTypeSoinSelect('sn-type-soin', '');
    document.getElementById('sn-prix').value = '';
    document.getElementById('sn-prix').dataset.modified = '';
    document.getElementById('sn-date').value = formatDateFR(new Date().toISOString().split('T')[0]);
    document.getElementById('sn-notes').value = '';

    const isEnregistre = tab === 'enregistre';
    document.getElementById('sn-patient-group').style.display = isEnregistre ? '' : 'none';
    document.getElementById('sn-externe-group').style.display = isEnregistre ? 'none' : '';
    if (isEnregistre) {
        resetPatientCombo('sn');
    } else {
        document.getElementById('sn-nom-externe').value = '';
    }
    openModal('modal-soin');
}

async function editSoin(id, tab) {
    currentSoinsTab = tab;
    const soin = soinsData[tab].find(s => s.id === id);
    if (!soin) return;

    document.getElementById('modal-soin-title').textContent = 'Modifier Soin';
    document.getElementById('sn-id').value = soin.id;

    await Promise.all([ensureTypeSoinsLoaded(), patientsData.length ? null : loadPatients()].filter(Boolean));
    populateTypeSoinSelect('sn-type-soin', soin.type_soin_id);
    document.getElementById('sn-prix').value = soin.prix_applique || 0;
    document.getElementById('sn-prix').dataset.modified = 'yes';
    document.getElementById('sn-date').value = formatDateFR(soin.date_soin);
    document.getElementById('sn-notes').value = soin.notes || '';

    const isEnregistre = tab === 'enregistre';
    document.getElementById('sn-patient-group').style.display = isEnregistre ? '' : 'none';
    document.getElementById('sn-externe-group').style.display = isEnregistre ? 'none' : '';
    if (isEnregistre) {
        setPatientComboValue('sn', soin.patient_id);
    } else {
        document.getElementById('sn-nom-externe').value = soin.nom_patient_externe || '';
    }
    openModal('modal-soin');
}

async function saveSoin() {
    const isEnregistre = currentSoinsTab === 'enregistre';
    const requiredFields = [
        { id: 'sn-type-soin', label: 'Type de soin' },
        { id: 'sn-date', label: 'Date' },
        { id: 'sn-prix', label: 'Prix', min: 0 },
    ];
    if (isEnregistre) requiredFields.push({ id: 'sn-patient', label: 'Patient', highlightId: 'sn-patient-search' });
    else requiredFields.push({ id: 'sn-nom-externe', label: 'Nom du patient externe' });
    if (!validateRequiredFields(requiredFields)) return;

    const id = document.getElementById('sn-id').value;
    const data = {
        type_soin_id: parseInt(document.getElementById('sn-type-soin').value),
        prix_applique: parseFloat(document.getElementById('sn-prix').value) || 0,
        date_soin: parseDateFR(document.getElementById('sn-date').value) || document.getElementById('sn-date').value,
        notes: document.getElementById('sn-notes').value || null,
        patient_id: isEnregistre ? (parseInt(document.getElementById('sn-patient').value) || null) : null,
        nom_patient_externe: isEnregistre ? null : (document.getElementById('sn-nom-externe').value || null),
    };
    try {
        if (id) {
            await apiFetch(`/soins/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        } else {
            await apiFetch('/soins/', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        }
        closeModal('modal-soin');
        loadSoinsTab(currentSoinsTab);
        showToast('Soin enregistré !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deleteSoin(id, tab) {
    if (!confirm('Voulez-vous vraiment supprimer ce soin ?')) return;
    try {
        await apiFetch(`/soins/${id}`, { method: 'DELETE' });
        loadSoinsTab(tab);
        showToast('Soin supprimé', 'success');
    } catch(e) { showToast('Erreur lors de la suppression : ' + e.message, 'error'); }
}

function printSoin(id, tab) {
    const s = soinsData[tab] && soinsData[tab].find(x => x.id === id);
    if (!s) { showToast('Données du soin non disponibles', 'error'); return; }
    const patient = tab === 'enregistre'
        ? `${s.patient_nom || ''} ${s.patient_prenom || ''}`.trim() || '-'
        : (s.nom_patient_externe || '-');
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Fiche Soin</title>
<style>
  body{font-family:Arial,sans-serif;padding:30px;max-width:600px;margin:0 auto;color:#222}
  h1{color:#1565C0;font-size:18px;border-bottom:2px solid #1565C0;padding-bottom:8px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  td{padding:8px 12px;border:1px solid #ddd;vertical-align:top}
  td:first-child{font-weight:bold;background:#f0f4f8;width:38%}
  .footer{margin-top:40px;font-size:11px;color:#888;text-align:center;border-top:1px solid #ddd;padding-top:10px}
  @media print{body{padding:10px}.footer{position:fixed;bottom:0;width:100%}}
</style>
</head>
<body>
<h1>Cabinet Médical BabaMouneissa — Fiche de Soin</h1>
<table>
<tr><td>Date</td><td>${escapeHtml(formatDateFR(s.date_soin))}</td></tr>
<tr><td>Patient</td><td>${escapeHtml(patient)}</td></tr>
<tr><td>Type de soin</td><td>${escapeHtml(s.type_soin_nom || '-')}</td></tr>
<tr><td>Prix appliqué</td><td>${(s.prix_applique || 0).toLocaleString()} FCFA</td></tr>
<tr><td>Notes / Observations</td><td>${escapeHtml(s.notes || '-')}</td></tr>
</table>
<div class="footer">Imprimé le ${new Date().toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric'})}</div>
</body>
</html>`;
    const win = window.open('', '_blank', 'width=700,height=500,scrollbars=yes');
    if (!win) { showToast('Veuillez autoriser les pop-ups pour imprimer', 'error'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.onload = () => win.print();
}

// --- Gestion des types de soins (admin) ---
let typeSoinsAdminData = [];

async function loadTypeSoinsAdmin() {
    document.getElementById('table-type-soins').innerHTML = '<tr><td colspan="3" class="loading">Chargement...</td></tr>';
    try {
        const res = await apiFetch('/type-soins/');
        if (!res) return;
        typeSoinsAdminData = await res.json();
        typeSoinsData = typeSoinsAdminData;
        renderTypeSoinsAdmin(typeSoinsAdminData);
    } catch(e) {
        const msg = e.message || 'Erreur inconnue';
        document.getElementById('table-type-soins').innerHTML =
            `<tr><td colspan="3">Erreur de chargement : ${escapeHtml(msg)}
            &nbsp;<button class="btn btn-sm" onclick="loadTypeSoinsAdmin()">Réessayer</button></td></tr>`;
    }
}

function renderTypeSoinsAdmin(data) {
    const tbody = document.getElementById('table-type-soins');
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="3">Aucun type de soin</td></tr>'; return; }
    tbody.innerHTML = data.map(t => `<tr>
        <td>${escapeHtml(t.nom)}</td>
        <td>${(t.prix_defaut || 0).toLocaleString()} FCFA</td>
        <td>
            <button class="btn btn-sm" onclick="editTypeSoin(${t.id})">Modifier</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTypeSoin(${t.id})">Supprimer</button>
        </td>
    </tr>`).join('');
}

function openNewTypeSoinModal() {
    document.getElementById('modal-type-soin-title').textContent = 'Nouveau Type de Soin';
    document.getElementById('ts-id').value = '';
    document.getElementById('ts-nom').value = '';
    document.getElementById('ts-prix').value = '';
    openModal('modal-type-soin');
}

function editTypeSoin(id) {
    const t = typeSoinsAdminData.find(x => x.id === id);
    if (!t) return;
    document.getElementById('modal-type-soin-title').textContent = 'Modifier Type de Soin';
    document.getElementById('ts-id').value = t.id;
    document.getElementById('ts-nom').value = t.nom || '';
    document.getElementById('ts-prix').value = t.prix_defaut || 0;
    openModal('modal-type-soin');
}

async function saveTypeSoin() {
    if (!validateRequiredFields([
        { id: 'ts-nom', label: 'Nom' },
        { id: 'ts-prix', label: 'Prix par défaut', min: 0 },
    ])) return;
    const id = document.getElementById('ts-id').value;
    const data = {
        nom: document.getElementById('ts-nom').value,
        prix_defaut: parseFloat(document.getElementById('ts-prix').value) || 0,
    };
    try {
        if (id) {
            await apiFetch(`/type-soins/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        } else {
            await apiFetch('/type-soins/', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        }
        closeModal('modal-type-soin');
        typeSoinsData = [];
        loadTypeSoinsAdmin();
        showToast('Type de soin enregistré !', 'success');
    } catch(e) { showToast('Erreur lors de l\'enregistrement : ' + e.message, 'error'); }
}

async function deleteTypeSoin(id) {
    if (!confirm('Voulez-vous vraiment supprimer ce type de soin ?')) return;
    try {
        await apiFetch(`/type-soins/${id}`, { method: 'DELETE' });
        typeSoinsData = [];
        loadTypeSoinsAdmin();
        showToast('Type de soin supprimé', 'success');
    } catch(e) {
        if (e.status === 409) showToast(e.detail, 'error');
        else showToast('Erreur lors de la suppression : ' + e.message, 'error');
    }
}