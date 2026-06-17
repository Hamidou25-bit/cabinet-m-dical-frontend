# Cabinet Médical BabaMouneissa — Frontend (HTML/CSS/JS vanilla)

Dépôt : https://github.com/Hamidou25-bit/cabinet-m-dical-frontend (privé, branche `main`)

## Stack technique

- HTML/CSS/JS vanilla (pas de framework)
- Design bleu médical (`--primary: #1565C0`)
- Sidebar fixe, navigation via `showPage()`
- Appels API via `apiFetch()` (défini dans `js/auth.js` — gère le token JWT automatiquement)

## Convention pour chaque nouvelle page/fonctionnalité

1. **Menu sidebar** — ajouter dans `index.html` :
   ```html
   <div class="menu-item" onclick="showPage('nom')"><span class="icon">🔤</span> Nom</div>
   ```

2. **Page** — ajouter dans `index.html`, avant le commentaire `<!-- STOCK -->` :
   ```html
   <div id="page-nom" class="page">...</div>
   ```

3. **Modal** (si besoin) — ajouter après le dernier modal existant, avant `<script src="js/app.js"></script>`

4. **JS** :
   - Ajouter `'nom'` dans le dictionnaire `titles` de `showPage()`
   - Ajouter `if (page === 'nom') loadNom();`

5. **Appels API** : toujours via `apiFetch('/route/')`, **jamais** `fetch()` directement.

## Authentification / topbar

- Bouton déconnexion : `onclick="logout()"` (défini dans `js/auth.js`)
- Nom utilisateur affiché via `localStorage.getItem('nom_utilisateur')`

## Lancer / tester en local

Le frontend est statique (HTML/CSS/JS). Pour tester avec l'API en local, l'API tourne sur `http://localhost:8001` (voir `api/CLAUDE.md`). Vérifier que les appels `apiFetch()` pointent vers la bonne base URL selon l'environnement.

## État des pages frontend

| Page | Statut |
|---|---|
| Authentification (login/logout) | ✅ |
| Dashboard (alertes stock/RDV + badges sidebar, RDV du jour, statistiques médicales + graphique Chart.js) | ✅ |
| Rendez-vous (réactivé Phase 11 : agenda filtrable date/statut, changement de statut en ligne, bouton "Créer consultation") | ✅ |
| Patients (liste + création) | ✅ |
| Dossier patient (page dédiée 5 onglets : consultations/ordonnances/soins/examens/vaccinations, résumé financier, export PDF/Excel, impression) | ✅ |
| Consultations (liste, champ "traitement après diagnostic" supprimé, mode de paiement + mutuelle, génération certificats médicaux) | ✅ |
| Stock (liste + alertes, export Excel articles, alerte visuelle ligne sous seuil ; "Historique des sorties" retiré) | ✅ |
| Ordonnances (3 volets patients/tiers/interne, filtres date, export Excel, CRUD, impression avec choix PDF/impression directe, type_beneficiaire auto selon l'onglet, mode de paiement + mutuelle) | ✅ |
| Examens complémentaires (sélection multiple de types d'examens avec total + page admin "Types d'examens" : catégories/types/prix) | ✅ |
| Mutuelles (page admin CRUD) | ✅ |
| Personnel | ❌ à faire |
| Comptabilité | 🟡 en cours (onglets Dépenses : liste + filtre par type, Synthèse : recettes/dépenses/profit + graphique + répartition par mode de paiement) |
| Rapports | ❌ à faire |
| CRUD Patients (modifier/supprimer) | ❌ à faire |
| CRUD Stock (entrées/sorties) | 🟡 sortie uniquement (bouton "Sortie") |

## Déploiement

```bash
cd /var/www/html && sudo /usr/local/bin/deploy-frontend.sh
```

Vérifier en ligne : http://51.161.10.252/index.html

## Points d'attention

- Le préfixe des routes API peut contenir un tiret — vérifier avec `curl` avant de coder un appel `apiFetch()`.
- CORS est ouvert à tous côté API (`allow_origins=["*"]`), donc pas de blocage CORS attendu en local.

## Format des dates (affichage)

Toute date affichée à l'utilisateur (listes, détails, exports Excel, impressions) doit être formatée en `JJ/MM/AAAA` via la fonction `formatDateFR(dateStr)` (définie en haut de `js/app.js`). Exceptions : les champs `<input type="date">` (doivent rester en ISO `YYYY-MM-DD` pour le sélecteur natif) et les noms de fichiers d'export (ne peuvent pas contenir `/`). Le stockage en base et les échanges avec l'API restent en ISO.
