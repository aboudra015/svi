import {
  DEFAULT_CONFIG,
  STORAGE_KEY,
  addCallback,
  createInitialState,
  getMetrics,
  normalizeState,
  recordCall,
  updateCallbackStatus,
  validatePhone,
} from "./domain.js";

const pageContent = document.querySelector("#page-content");
const overlayRoot = document.querySelector("#overlay-root");
const breadcrumb = document.querySelector("#breadcrumb-current");
const titles = {
  accueil: "Vue d’ensemble",
  parcours: "Parcours vocal",
  architecture: "Architecture téléphonique",
  rappels: "Demandes de rappel",
  rapports: "Rapports",
  reglages: "Réglages",
};

let state = loadState();
let activePage = "accueil";
let simulator = null;
let selectedArchitecture = "local-fxo";
let toastTimer;

document.querySelector("#current-year").textContent = new Date().getFullYear();
document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.page));
});
document.querySelector(".brand").addEventListener("click", (event) => {
  event.preventDefault();
  navigate("accueil");
});
document.querySelector("#help-button").addEventListener("click", showAbout);
document.addEventListener("click", handleClick, true);
document.addEventListener("submit", handleSubmit);
document.addEventListener("keydown", handleKeydown);

render();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return normalizeState(saved ? JSON.parse(saved) : createInitialState());
  } catch (error) {
    console.error("Impossible de lire les données de démonstration.", error);
    return createInitialState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Impossible d’enregistrer les données de démonstration.", error);
    showToast("Enregistrement impossible dans ce navigateur.", "error");
  }
}

function navigate(page) {
  if (!titles[page]) return;
  if (simulator) closeSimulator(false);
  activePage = page;
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });
  breadcrumb.textContent = titles[page];
  document.title = `${titles[page]} — SVI Mali`;
  render();
}

function render() {
  document.querySelector("#callback-count").textContent =
    state.callbacks.filter((item) => item.status === "pending").length;
  const views = {
    accueil: renderHome,
    parcours: renderFlow,
    architecture: renderArchitecture,
    rappels: renderCallbacks,
    rapports: renderReports,
    reglages: renderSettings,
  };
  pageContent.innerHTML = views[activePage]();
}

function renderArchitecture() {
  const options = [
    {
      id: "local-fxo",
      title: "PBX local + FXO",
      tag: "Référence pilote",
      intro: "Ligne analogique → port FXO → PBX/SVI local → postes",
      internet: "Le menu et le routage local peuvent continuer sans Internet si la ligne et les équipements sont alimentés. L’administration distante et la supervision s’interrompent.",
      needs: "Accès physique à la ligne, PBX ou passerelle FXO, plan de secours électrique et essais sur site.",
      tone: "recommended",
    },
    {
      id: "operator-forward",
      title: "Renvoi opérateur",
      tag: "À confirmer",
      intro: "Numéro existant → renvoi réseau → SVI hébergé",
      internet: "Le service hébergé dépend de son accès réseau. Le renvoi peut être indisponible ou facturé et doit être confirmé par l’opérateur.",
      needs: "Accord écrit sur le renvoi, numéro de destination, tarif, présentation du numéro et procédure de panne.",
      tone: "",
    },
    {
      id: "existing-pbx",
      title: "PBX existant",
      tag: "Audit requis",
      intro: "Ligne existante → standard existant avec auto-attendant ou interface compatible",
      internet: "Dépend du fonctionnement local du standard existant; les fonctions de supervision distante peuvent être interrompues.",
      needs: "Modèle, ports, licences, documentation et méthode de retour arrière validés avant intégration.",
      tone: "",
    },
    {
      id: "hybrid",
      title: "Hybride FXO + SIP",
      tag: "Évolution",
      intro: "PBX local → ligne FXO de secours + trunk SIP opérateur",
      internet: "La voie FXO locale peut rester disponible sans WAN. La voie SIP et ses appels dépendent du transport fourni par l’opérateur.",
      needs: "Trunk et canaux contractuels, règles de bascule testées, SBC ou frontière sécurisée, restrictions d’accès.",
      tone: "",
    },
    {
      id: "cloud-sip",
      title: "SVI cloud / SIP",
      tag: "Selon le site",
      intro: "Ligne livrée en SIP ou renvoyée par l’opérateur → PBX hébergé",
      internet: "Un site analogique non renvoyé et non raccordé à une passerelle ne peut pas être piloté par Internet seul. Le cloud dépend du WAN et de l’opérateur.",
      needs: "SIP ou renvoi réellement fourni, réseau mesuré, contrat d’hébergement, solution de secours et plan de sortie.",
      tone: "",
    },
  ];
  const selected = options.find((option) => option.id === selectedArchitecture) ?? options[0];
  return `
    <section class="page-heading"><div><p class="eyebrow">RACCORDEMENT TÉLÉPHONIQUE</p><h1>Une ligne classique n’est pas une ligne IP</h1><p class="muted">L’accès Internet, à lui seul, ne transforme pas une ligne analogique et ne connecte pas un SVI.</p></div><span class="subtle-badge">Choix à valider par site</span></section>
    <div class="notice notice-warn"><span class="notice-icon">!</span><div><strong>Aucun raccordement n’est provisionné</strong><p>Le dépôt ne contient ni contrat opérateur, ni renvoi, ni PBX, ni trunk SIP. Ces scénarios sont des options d’architecture, pas des services déjà disponibles.</p></div></div>
    <section class="panel architecture-reference"><div class="panel-heading"><div><h2>Référence recommandée pour un pilote sur ligne analogique</h2><p>Traitement local des appels; Internet réservé à l’administration et à la supervision.</p></div><span class="subtle-badge">Menu local sans WAN</span></div>
      <div class="architecture-flow" aria-label="Flux d’architecture recommandé"><div class="architecture-node"><span class="architecture-node-icon">☏</span><strong>Réseau opérateur</strong><small>Ligne analogique<br>1 voie par ligne, en général</small></div><span class="architecture-arrow">→</span><div class="architecture-node fxo-node"><span class="port-label">FXO</span><strong>PBX / SVI local</strong><small>Menu et routage<br>sur le site</small></div><span class="architecture-arrow">→</span><div class="architecture-node"><span class="architecture-node-icon">⌂</span><strong>Postes agents</strong><small>Téléphones IP sur LAN<br>ou téléphone via FXS</small></div></div>
      <div class="internet-lane"><span class="internet-symbol">◎</span><div><strong>Internet · voie distincte</strong><small>Administration distante, mises à jour et supervision seulement. Si le WAN tombe, le menu local peut continuer; l’accès distant s’arrête.</small></div></div>
    </section>
    <div class="architecture-heading"><div><h2>Comparer les scénarios</h2><p>Sélectionnez une option pour consulter ses prérequis et ses limites.</p></div></div>
    <div class="architecture-options">${options.map((option) => `<button class="architecture-option ${option.tone} ${selected.id === option.id ? "selected" : ""}" data-action="select-architecture" data-id="${option.id}"><span class="architecture-option-head"><strong>${escapeHtml(option.title)}</strong><span class="option-tag">${escapeHtml(option.tag)}</span></span><span>${escapeHtml(option.intro)}</span></button>`).join("")}</div>
    <section class="panel architecture-detail"><div class="panel-heading"><div><h2>${escapeHtml(selected.title)}</h2><p>${escapeHtml(selected.intro)}</p></div><span class="subtle-badge">Étude requise</span></div><div class="architecture-detail-grid"><div><span class="detail-label">Dépendance Internet</span><p>${escapeHtml(selected.internet)}</p></div><div><span class="detail-label">À valider avant déploiement</span><p>${escapeHtml(selected.needs)}</p></div></div></section>
    <section class="panel interface-panel"><div class="panel-heading"><div><h2>Ne pas confondre les interfaces</h2><p>Le type de port détermine ce qui peut y être raccordé.</p></div></div><div class="interface-grid"><article><span class="interface-badge fxo-badge">FXO</span><strong>Entrée de ligne</strong><p>Reçoit la ligne analogique fournie par l’opérateur; raccorde celle-ci au PBX/SVI. C’est l’interface de référence pour une ligne PSTN classique.</p></article><article><span class="interface-badge fxs-badge">FXS</span><strong>Sortie vers téléphone</strong><p>Fournit une ligne à un téléphone analogique ou un fax. Ce n’est pas le port pour raccorder directement la ligne opérateur.</p></article><article><span class="interface-badge ata-badge">ATA</span><strong>Adaptateur de terminal</strong><p>Relie un téléphone analogique à un compte SIP via un port FXS. Un ATA seul ne convertit pas une ligne opérateur entrante et ne crée pas un SVI.</p></article><article><span class="interface-badge sip-badge">SIP</span><strong>Trunk opérateur</strong><p>Accès téléphonique IP contractuel avec capacité en canaux. La présence d’Internet ne prouve ni l’existence d’un trunk ni son autorisation.</p></article></div></section>
    <div class="continuity-grid"><section class="panel"><div class="panel-heading"><div><h2>Continuité et énergie</h2><p>La résilience ne se limite pas à la connexion Internet.</p></div></div><ul class="check-list"><li><span>✓</span>Prévoir une UPS pour PBX, passerelle FXO et équipements réseau critiques.</li><li><span>✓</span>Vérifier si la ligne analogique est alimentée par un ONT ou un équipement actif.</li><li><span>✓</span>Documenter le téléphone, numéro ou chemin de secours réellement testé.</li><li><span>✓</span>Si le WAN tombe, différencier le menu local de la supervision distante.</li></ul></section><section class="panel"><div class="panel-heading"><div><h2>Recette téléphonique</h2><p>À effectuer sur site avant toute mise en service.</p></div></div><ul class="check-list"><li><span>✓</span>Tester appels entrants, DTMF, absence de saisie et répétition du menu.</li><li><span>✓</span>Vérifier transfert, audio bidirectionnel et raccrochage avec un agent.</li><li><span>✓</span>Simuler saturation de ligne, panne Internet, panne PBX et retour arrière.</li><li><span>✓</span>Restreindre le SIP aux réseaux opérateur ou tunnel approuvé; aucun port public ouvert.</li></ul></section></div>`;
}

function renderHome() {
  const metrics = getMetrics(state);
  const max = Math.max(1, ...metrics.daily.map((day) => day.count));
  const name = escapeHtml(state.config.organization);
  return `
    <section class="page-heading">
      <div><p class="eyebrow">TABLEAU DE BORD</p><h1>Bonjour, équipe 👋</h1><p class="muted">Voici l’activité de votre accueil téléphonique.</p></div>
      <button class="button button-primary" data-action="start-simulation"><span>＋</span> Tester le parcours</button>
    </section>
    <div class="notice notice-demo"><span class="notice-icon">i</span><div><strong>Environnement de démonstration</strong><p>Aucun appel ni transfert téléphonique réel. Les données restent dans ce navigateur et servent uniquement à tester le parcours.</p></div></div>
    <div class="kpi-grid">
      ${metricCard("Appels simulés", metrics.total, `${metrics.today} aujourd’hui`, "↗")}
      ${metricCard("Demandes de rappel", metrics.callbacks, "En attente d’un agent", "◷")}
      ${metricCard("Transferts simulés", metrics.outcomes.transferred, "Vers un service ou un agent", "⇢")}
      ${metricCard("Taux de transfert", `${metrics.transferRate}%`, "Sur les appels simulés", "◉")}
    </div>
    <div class="dashboard-grid">
      <section class="panel activity-panel">
        <div class="panel-heading"><div><h2>Activité des 7 derniers jours</h2><p>Appels de démonstration, sans identifiant d’appelant</p></div><span class="subtle-badge">Agrégé</span></div>
        ${metrics.total ? `<div class="chart" role="img" aria-label="Graphique des appels simulés sur les sept derniers jours">${metrics.daily.map((day) => `<div class="chart-column"><span class="chart-value">${day.count || ""}</span><div class="chart-bar-wrap"><div class="chart-bar" style="height:${Math.max(3, (day.count / max) * 100)}%"></div></div><span class="chart-label">${escapeHtml(day.label)}</span></div>`).join("")}</div>` : `<div class="empty-chart"><span class="empty-chart-icon">▥</span><strong>Pas encore d’activité</strong><span>Lancez une simulation pour voir les premiers indicateurs.</span></div>`}
      </section>
      <section class="panel quick-panel">
        <div class="panel-heading"><div><h2>Votre parcours vocal</h2><p>${name} · Français</p></div><span class="status-label"><span class="status-dot"></span>Prêt à tester</span></div>
        <div class="flow-preview"><div class="flow-node"><span class="flow-node-icon">◖</span><span><strong>Message d’accueil</strong><small>${escapeHtml(truncate(state.config.greeting, 73))}</small></span></div><div class="flow-connector"></div><div class="flow-node"><span class="flow-node-icon alt">⌘</span><span><strong>Menu à 3 choix</strong><small>Information, services, demande de rappel</small></span></div><div class="flow-connector"></div><div class="flow-node"><span class="flow-node-icon warm">↗</span><span><strong>Agent humain</strong><small>Option 0 · Transfert simulé</small></span></div></div>
        <button class="text-button" data-page-link="parcours">Configurer le parcours <span>→</span></button>
      </section>
    </div>
    <div class="bottom-grid">
      <section class="panel"><div class="panel-heading"><div><h2>Demandes de rappel récentes</h2><p>Numéro utilisé uniquement pour le rappel demandé</p></div><button class="text-button" data-page-link="rappels">Tout voir →</button></div>${renderRecentCallbacks()}</section>
      <section class="panel privacy-panel"><div class="privacy-lock">⌑</div><div><h2>Confidentialité intégrée</h2><p>Pas d’enregistrement audio. Les rapports sont agrégés et n’incluent jamais le numéro d’appelant.</p><span class="privacy-tag">ENREGISTREMENT DÉSACTIVÉ</span></div></section>
    </div>`;
}

function renderFlow() {
  return `
    <section class="page-heading"><div><p class="eyebrow">CONCEPTION DU PARCOURS</p><h1>Un accueil simple, un agent toujours accessible</h1><p class="muted">Configurez le message d’accueil et les destinations de démonstration.</p></div><button class="button button-primary" data-action="start-simulation">▷ Lancer une simulation</button></section>
    <div class="notice notice-warn"><span class="notice-icon">!</span><div><strong>Routage fictif</strong><p>Les transferts affichent une confirmation de test seulement. Aucun numéro, trunk SIP ou agent téléphonique n’est configuré.</p></div></div>
    <div class="flow-layout">
      <section class="panel flow-editor"><div class="panel-heading"><div><h2>Configuration du menu</h2><p>3 choix maximum et une sortie agent dédiée</p></div><span class="subtle-badge">Français</span></div>
        <form id="flow-form" class="form-stack">
          <label>Nom de l’organisation<input name="organization" required maxlength="80" value="${escapeAttr(state.config.organization)}"></label>
          <label>Message d’accueil<textarea name="greeting" required maxlength="240" rows="3">${escapeHtml(state.config.greeting)}</textarea><span class="field-hint">Court et clair · ${state.config.greeting.length}/240 caractères</span></label>
          <div class="service-list">${state.config.services.map((service) => `<div class="service-row"><span class="keycap">${service.key}</span><div class="service-fields"><label>Libellé<input name="label-${service.key}" required maxlength="48" value="${escapeAttr(service.label)}"></label><label>Destination de démonstration<input name="destination-${service.key}" required maxlength="48" value="${escapeAttr(service.destination)}"></label></div></div>`).join("")}<div class="service-row"><span class="keycap agent-key">0</span><div class="service-fixed"><strong>Parler à un agent</strong><small>Sortie humaine toujours affichée · transfert simulé</small></div><span class="always-on">TOUJOURS ACTIF</span></div></div>
          <div class="form-actions"><span class="field-hint">Aucun contenu sensible ou médical dans le menu.</span><button class="button button-primary" type="submit">Enregistrer le parcours</button></div>
        </form>
      </section>
      <aside class="panel flow-side"><div class="panel-heading"><div><h2>Règles du parcours</h2><p>Garde-fous du MVP</p></div></div><ul class="check-list"><li><span>✓</span>Un seul niveau de menu</li><li><span>✓</span>Option agent disponible par 0</li><li><span>✓</span>Pas d’enregistrement audio</li><li><span>✓</span>Motif de rappel non sensible</li><li><span>✓</span>Pas de triage médical</li></ul><div class="mini-hours"><span class="mini-icon">◷</span><div><strong>Horaires annoncés</strong><small>${escapeHtml(state.config.openingTime)} – ${escapeHtml(state.config.closingTime)} · lundi au vendredi</small><button class="text-button" data-page-link="reglages">Modifier les horaires →</button></div></div><div class="flow-tip"><strong>Conseil</strong><p>Faites valider les messages et les destinations par le responsable métier avant toute mise en service réelle.</p></div></aside>
    </div>`;
}

function renderCallbacks() {
  const pending = state.callbacks.filter((item) => item.status === "pending");
  const completed = state.callbacks.filter((item) => item.status === "completed");
  return `
    <section class="page-heading"><div><p class="eyebrow">SUIVI DES USAGERS</p><h1>Demandes de rappel</h1><p class="muted">Les numéros ne sont collectés qu’à la demande de l’appelant et ne figurent pas dans les rapports.</p></div><button class="button button-secondary" data-action="start-simulation">＋ Créer par simulation</button></section>
    <div class="notice notice-demo"><span class="notice-icon">i</span><div><strong>Traitement local uniquement</strong><p>Ces demandes sont stockées dans le navigateur, sans notification à un agent. Elles expirent après 30 jours; les demandes clôturées sont supprimées après 7 jours.</p></div></div>
    <section class="panel table-panel"><div class="panel-heading"><div><h2>À traiter <span class="count-chip">${pending.length}</span></h2><p>Les détails sont visibles uniquement sur cet appareil.</p></div></div>${pending.length ? renderCallbackTable(pending) : emptyState("Aucun rappel en attente", "Utilisez la simulation pour créer une demande de test.")}</section>
    ${completed.length ? `<section class="panel table-panel completed-panel"><div class="panel-heading"><div><h2>Terminées <span class="count-chip">${completed.length}</span></h2><p>Supprimées automatiquement après 7 jours.</p></div></div>${renderCallbackTable(completed)}</section>` : ""}`;
}

function renderReports() {
  const metrics = getMetrics(state);
  const max = Math.max(1, ...metrics.daily.map((day) => day.count));
  const totalOutcomes = Math.max(1, metrics.total);
  const items = [
    ["Information diffusée", metrics.outcomes.information, "green"],
    ["Transfert simulé", metrics.outcomes.transferred, "blue"],
    ["Rappel demandé", metrics.outcomes.callback, "gold"],
    ["Appel interrompu", metrics.outcomes.abandoned, "muted"],
  ];
  return `
    <section class="page-heading"><div><p class="eyebrow">MESURE DE L’ACCUEIL</p><h1>Rapports d’activité</h1><p class="muted">Indicateurs issus des simulations sur cet appareil, sans numéro d’appelant ni enregistrement.</p></div><span class="subtle-badge">Rétention : 30 jours</span></section>
    <div class="kpi-grid report-kpis">${metricCard("Appels simulés", metrics.total, "Sur les 30 derniers jours", "◫")}${metricCard("Aujourd’hui", metrics.today, "Appels simulés", "◷")}${metricCard("Rappels demandés", metrics.outcomes.callback, "Historique conservé 30 jours", "↗")}${metricCard("Taux de transfert", `${metrics.transferRate}%`, "Sur les simulations", "⇢")}</div>
    <div class="reports-grid"><section class="panel"><div class="panel-heading"><div><h2>Volume journalier</h2><p>Sept derniers jours · données agrégées</p></div></div>${metrics.total ? `<div class="chart report-chart">${metrics.daily.map((day) => `<div class="chart-column"><span class="chart-value">${day.count || ""}</span><div class="chart-bar-wrap"><div class="chart-bar" style="height:${Math.max(3, (day.count / max) * 100)}%"></div></div><span class="chart-label">${escapeHtml(day.label)}</span></div>`).join("")}</div>` : emptyState("Aucun appel simulé", "Les indicateurs apparaîtront après vos premiers tests.")}</section>
      <section class="panel"><div class="panel-heading"><div><h2>Issue des appels</h2><p>Répartition des sessions simulées</p></div></div><div class="outcome-list">${items.map(([label, count, color]) => `<div class="outcome-item"><span class="outcome-dot ${color}"></span><span>${label}</span><strong>${count}</strong><div class="outcome-track"><span class="${color}" style="width:${(count / totalOutcomes) * 100}%"></span></div></div>`).join("")}</div></section></div>
    <div class="notice notice-neutral"><span class="notice-icon">i</span><div><strong>Ces rapports ne sont pas des statistiques de production</strong><p>Les appels réels, la disponibilité opérateur et les SLA nécessitent une intégration téléphonique et une mesure validée sur site.</p></div></div>`;
}

function renderSettings() {
  return `
    <section class="page-heading"><div><p class="eyebrow">PRÉFÉRENCES ET PROTECTION</p><h1>Réglages</h1><p class="muted">Configuration de la démonstration et limites de traitement des données.</p></div></section>
    <div class="settings-grid"><section class="panel settings-panel"><div class="panel-heading"><div><h2>Horaires d’ouverture</h2><p>Lundi au vendredi, pour l’annonce d’accueil</p></div><span class="settings-icon">◷</span></div><form id="hours-form" class="hours-form"><label>Ouverture<input type="time" name="openingTime" required value="${escapeAttr(state.config.openingTime)}"></label><span class="hours-dash">—</span><label>Fermeture<input type="time" name="closingTime" required value="${escapeAttr(state.config.closingTime)}"></label><button class="button button-primary" type="submit">Enregistrer</button></form></section>
      <section class="panel settings-panel"><div class="panel-heading"><div><h2>Enregistrement des appels</h2><p>Le MVP ne propose pas de capture audio.</p></div><span class="record-off">DÉSACTIVÉ</span></div><div class="setting-row"><span class="setting-symbol lock-symbol">⌑</span><div><strong>Enregistrement vocal</strong><small>Désactivé et non disponible dans ce prototype. Aucun audio n’est créé ni stocké.</small></div><span class="toggle-off" aria-label="Désactivé"><span></span></span></div></section>
      <section class="panel settings-panel"><div class="panel-heading"><div><h2>Données de démonstration</h2><p>Stockées localement dans ce navigateur</p></div><span class="settings-icon">⌂</span></div><div class="retention-list"><div><span>Événements et rapports agrégés</span><strong>30 jours</strong></div><div><span>Rappels en attente</span><strong>30 jours</strong></div><div><span>Rappels clôturés</span><strong>7 jours</strong></div><div><span>Enregistrement audio</span><strong>Aucun</strong></div></div><button class="button button-danger-outline" data-action="clear-data">Effacer les données de démonstration</button></section>
      <section class="panel settings-panel"><div class="panel-heading"><div><h2>Connexion téléphonique</h2><p>Pré-requis à une exploitation réelle</p></div><span class="status-label status-off"><span class="status-dot"></span>Non connecté</span></div><ul class="integration-list"><li><span>Numéro ou renvoi opérateur</span><b>Non provisionné</b></li><li><span>Trunk SIP / PBX</span><b>Non configuré</b></li><li><span>Comptes agents</span><b>Non configurés</b></li><li><span>Authentification administrateur</span><b>Non incluse</b></li></ul><p class="integration-footnote">Ne saisissez aucun secret ni donnée client dans cette démonstration. La mise en service nécessite un audit, un opérateur agréé et une infrastructure sécurisée.</p></section></div>
    <div class="notice notice-warn"><span class="notice-icon">!</span><div><strong>Ne pas utiliser pour des données réelles</strong><p>Cette interface statique ne possède pas de compte utilisateur, serveur ou chiffrement côté serveur. Les données du navigateur ne sont pas protégées contre un autre utilisateur du même appareil.</p></div></div>`;
}

function renderRecentCallbacks() {
  const recent = state.callbacks.slice(0, 3);
  if (!recent.length) return emptyState("Aucune demande de rappel", "Les demandes créées en simulation apparaîtront ici.");
  return `<div class="recent-list">${recent.map((item) => `<div class="recent-row"><span class="callback-avatar">↗</span><div class="recent-detail"><strong>${escapeHtml(maskPhone(item.phone))}</strong><small>${escapeHtml(reasonLabel(item.reason))} · ${formatDate(item.createdAt)}</small></div><span class="callback-status ${item.status}">${item.status === "pending" ? "À traiter" : "Terminée"}</span></div>`).join("")}</div>`;
}

function renderCallbackTable(items) {
  return `<div class="table-scroll"><table><thead><tr><th>Numéro de rappel</th><th>Motif choisi</th><th>Reçu le</th><th>Statut</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${items.map((item) => `<tr><td class="phone-cell">${escapeHtml(item.phone)}</td><td>${escapeHtml(reasonLabel(item.reason))}</td><td>${formatDate(item.createdAt)}</td><td><span class="callback-status ${item.status}">${item.status === "pending" ? "À traiter" : "Terminée"}</span></td><td class="table-actions">${item.status === "pending" ? `<button class="small-action" data-action="complete-callback" data-id="${escapeAttr(item.id)}">Marquer terminée</button>` : ""}<button class="delete-action" data-action="delete-callback" data-id="${escapeAttr(item.id)}" aria-label="Supprimer la demande de rappel">×</button></td></tr>`).join("")}</tbody></table></div>`;
}

function metricCard(title, value, note, icon) {
  return `<article class="kpi-card"><div class="kpi-top"><span>${title}</span><span class="kpi-icon">${icon}</span></div><strong class="kpi-value">${value}</strong><span class="kpi-note">${note}</span></article>`;
}

function emptyState(title, message) {
  return `<div class="empty-state"><span class="empty-state-icon">◌</span><strong>${title}</strong><span>${message}</span></div>`;
}

function handleClick(event) {
  const modal = event.target.closest(".sim-modal, .confirm-modal");
  if (modal && !event.target.closest("button[data-action]")) return;
  const pageLink = event.target.closest("[data-page-link]");
  if (pageLink) return navigate(pageLink.dataset.pageLink);
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "start-simulation") startSimulator();
  if (action === "select-architecture") {
    selectedArchitecture = id;
    render();
  }
  if (action === "sim-key") chooseMenu(button.dataset.key);
  if (action === "sim-close") closeSimulator(true);
  if (action === "sim-back") showSimulatorMenu();
  if (action === "complete-callback") {
    updateCallbackStatus(state, id, "completed");
    saveState();
    render();
    showToast("Demande marquée comme terminée.");
  }
  if (action === "delete-callback") {
    state.callbacks = state.callbacks.filter((item) => item.id !== id);
    saveState();
    render();
    showToast("Demande supprimée.");
  }
  if (action === "clear-data") confirmClearData();
}

function handleSubmit(event) {
  if (event.target.id === "flow-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    state.config.organization = form.get("organization").trim();
    state.config.greeting = form.get("greeting").trim();
    state.config.services = DEFAULT_CONFIG.services.map((service) => ({
      ...service,
      label: form.get(`label-${service.key}`).trim(),
      destination: form.get(`destination-${service.key}`).trim(),
    }));
    saveState();
    render();
    showToast("Parcours vocal enregistré.");
  }
  if (event.target.id === "hours-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const opening = form.get("openingTime");
    const closing = form.get("closingTime");
    if (opening >= closing) return showToast("L’heure d’ouverture doit précéder la fermeture.", "error");
    state.config.openingTime = opening;
    state.config.closingTime = closing;
    saveState();
    render();
    showToast("Horaires enregistrés.");
  }
  if (event.target.id === "callback-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const phone = form.get("phone");
    if (!validatePhone(phone)) {
      document.querySelector("#callback-phone-error").textContent =
        "Entrez 8 chiffres, avec +223 en option.";
      return;
    }
    try {
      addCallback(state, { phone, reason: form.get("reason") });
      recordSimulatorOutcome({ option: "3", outcome: "rappel_demande" });
      saveState();
      finishSimulation("Votre demande de rappel est enregistrée sur cet appareil.");
    } catch (error) {
      showToast(error.message, "error");
    }
  }
}

function handleKeydown(event) {
  if (event.key === "Escape" && simulator) closeSimulator(true);
  if (!simulator || simulator.screen !== "menu") return;
  if (/^\d$/.test(event.key)) chooseMenu(event.key);
}

function startSimulator() {
  simulator = { screen: "menu", invalid: 0, pendingOutcome: null, recorded: false };
  showSimulatorMenu();
}

function showSimulatorMenu() {
  if (!simulator) return;
  simulator.screen = "menu";
  overlayRoot.innerHTML = `<div class="modal-backdrop" data-action="sim-close"><section class="sim-modal" role="dialog" aria-modal="true" aria-labelledby="sim-title" onclick="event.stopPropagation()"><div class="sim-header"><div><span class="sim-live-dot"></span><span>SIMULATION LOCALE</span></div><button class="modal-close" data-action="sim-close" aria-label="Fermer">×</button></div><div class="sim-body"><p class="eyebrow">APPEL ENTRANT · TEST</p><h2 id="sim-title">${escapeHtml(state.config.organization)}</h2><p class="sim-greeting">« ${escapeHtml(state.config.greeting)} »</p><p class="sim-prompt">Choisissez une option pour continuer :</p><div class="sim-options">${state.config.services.map((service) => `<button class="sim-option" data-action="sim-key" data-key="${service.key}"><span class="keycap">${service.key}</span><span>${escapeHtml(service.label)}</span><span class="option-chevron">›</span></button>`).join("")}<button class="sim-option agent-option" data-action="sim-key" data-key="0"><span class="keycap agent-key">0</span><span>Parler à un agent</span><span class="option-chevron">›</span></button></div><p class="sim-hint">Clavier : touches numériques · Aucun appel réel n’est effectué.</p></div><div class="sim-footer"><span>◖ &nbsp;Durée simulée : 00:00</span><button class="text-button hangup-button" data-action="sim-close">Terminer le test</button></div></section></div>`;
  overlayRoot.querySelector(".sim-option").focus();
}

function chooseMenu(key) {
  if (!simulator || simulator.screen !== "menu") return;
  if (key === "1") {
    simulator.pendingOutcome = { option: "1", outcome: "information" };
    simulator.screen = "info";
    overlayRoot.innerHTML = `<div class="modal-backdrop" data-action="sim-close"><section class="sim-modal result-modal" role="dialog" aria-modal="true" aria-labelledby="sim-title" onclick="event.stopPropagation()"><div class="sim-header"><div><span class="sim-live-dot"></span><span>OPTION 1 · INFORMATION</span></div><button class="modal-close" data-action="sim-close" aria-label="Fermer">×</button></div><div class="result-content"><span class="result-icon info-result">i</span><h2 id="sim-title">Information</h2><p>Le service d’accueil est ouvert du lundi au vendredi, de ${escapeHtml(state.config.openingTime)} à ${escapeHtml(state.config.closingTime)}.</p><div class="sim-callout">Message de démonstration · Les horaires doivent être confirmés par l’organisation.</div><button class="button button-primary" data-action="sim-back">Retour au menu</button></div><div class="sim-footer"><span>◖ &nbsp;Résultat enregistré sans donnée d’appelant</span><button class="text-button hangup-button" data-action="sim-close">Terminer</button></div></section></div>`;
  } else if (key === "2" || key === "0") {
    const service = key === "0" ? null : state.config.services.find((item) => item.key === key);
    simulator.pendingOutcome = { option: key, outcome: "transfert_simule" };
    simulator.screen = "transfer";
    overlayRoot.innerHTML = `<div class="modal-backdrop" data-action="sim-close"><section class="sim-modal result-modal" role="dialog" aria-modal="true" aria-labelledby="sim-title" onclick="event.stopPropagation()"><div class="sim-header"><div><span class="sim-live-dot"></span><span>TRANSFERT SIMULÉ</span></div><button class="modal-close" data-action="sim-close" aria-label="Fermer">×</button></div><div class="result-content"><span class="result-icon transfer-result">⇢</span><h2 id="sim-title">${key === "0" ? "Option agent" : escapeHtml(service.label)}</h2><p>Dans un déploiement réel, cet appel serait dirigé vers <strong>${key === "0" ? "un agent" : escapeHtml(service.destination)}</strong>.</p><div class="sim-callout">Aucun poste ou numéro téléphonique n’est configuré. Le transfert n’a pas lieu.</div><button class="button button-primary" data-action="sim-back">Retour au menu</button></div><div class="sim-footer"><span>◖ &nbsp;Résultat enregistré sans donnée d’appelant</span><button class="text-button hangup-button" data-action="sim-close">Terminer</button></div></section></div>`;
  } else if (key === "3") {
    simulator.screen = "callback";
    overlayRoot.innerHTML = `<div class="modal-backdrop" data-action="sim-close"><section class="sim-modal result-modal" role="dialog" aria-modal="true" aria-labelledby="sim-title" onclick="event.stopPropagation()"><div class="sim-header"><div><span class="sim-live-dot"></span><span>OPTION 3 · DEMANDE DE RAPPEL</span></div><button class="modal-close" data-action="sim-close" aria-label="Fermer">×</button></div><div class="result-content callback-form-content"><span class="result-icon callback-result">↗</span><h2 id="sim-title">Être rappelé</h2><p>Seules les informations nécessaires au rappel sont demandées. N’indiquez aucun détail sensible.</p><form id="callback-form" class="form-stack"><label>Numéro de téléphone<input id="callback-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="70 12 34 56" required aria-describedby="callback-phone-error"><span id="callback-phone-error" class="field-error" aria-live="polite"></span></label><label>Motif général<select name="reason" required><option value="information">Demande d’information</option><option value="rendez-vous">Rendez-vous</option><option value="autre">Autre demande</option></select></label><p class="consent-note">En demandant ce rappel, vous acceptez que ce numéro soit utilisé uniquement pour vous recontacter au sujet de cette demande.</p><button class="button button-primary" type="submit">Confirmer ma demande</button></form><button class="text-button back-menu" data-action="sim-back">← Retour au menu</button></div><div class="sim-footer"><span>◖ &nbsp;Le numéro ne sera pas ajouté aux rapports</span><button class="text-button hangup-button" data-action="sim-close">Annuler</button></div></section></div>`;
    document.querySelector("#callback-phone").focus();
  } else {
    simulator.invalid += 1;
    if (simulator.invalid >= 2) {
      simulator.pendingOutcome = { option: "invalide", outcome: "transfert_simule" };
      simulator.screen = "invalid";
      overlayRoot.innerHTML = `<div class="modal-backdrop" data-action="sim-close"><section class="sim-modal result-modal" role="dialog" aria-modal="true" aria-labelledby="sim-title" onclick="event.stopPropagation()"><div class="sim-header"><div><span class="sim-live-dot"></span><span>AUCUNE OPTION SÉLECTIONNÉE</span></div><button class="modal-close" data-action="sim-close" aria-label="Fermer">×</button></div><div class="result-content"><span class="result-icon transfer-result">⇢</span><h2 id="sim-title">Besoin d’aide ?</h2><p>Après deux erreurs, l’appel serait proposé à un agent dans un déploiement réel.</p><div class="sim-callout">Transfert humain simulé · aucun appel réel n’est effectué.</div><button class="button button-primary" data-action="sim-back">Retour au menu</button></div><div class="sim-footer"><span>◖ &nbsp;Aucun enregistrement audio</span><button class="text-button hangup-button" data-action="sim-close">Terminer</button></div></section></div>`;
    } else {
      overlayRoot.querySelector(".sim-prompt").textContent = "Option non reconnue. Vous pouvez réessayer ou choisir 0 pour un agent.";
      overlayRoot.querySelector(".sim-prompt").classList.add("error-text");
    }
  }
}

function finishSimulation(message) {
  simulator.screen = "done";
  overlayRoot.innerHTML = `<div class="modal-backdrop" data-action="sim-close"><section class="sim-modal result-modal" role="dialog" aria-modal="true" aria-labelledby="sim-title" onclick="event.stopPropagation()"><div class="sim-header"><div><span class="sim-live-dot"></span><span>DEMANDE ENREGISTRÉE</span></div><button class="modal-close" data-action="sim-close" aria-label="Fermer">×</button></div><div class="result-content"><span class="result-icon info-result">✓</span><h2 id="sim-title">Merci</h2><p>${escapeHtml(message)}</p><div class="sim-callout">Aucun agent ne sera averti par cette démonstration.</div><button class="button button-primary" data-action="sim-close">Terminer</button></div><div class="sim-footer"><span>◖ &nbsp;Numéro stocké localement</span><span>Fin du test</span></div></section></div>`;
}

function closeSimulator(recordAbandon) {
  if (simulator?.pendingOutcome) {
    recordSimulatorOutcome(simulator.pendingOutcome);
  } else if (recordAbandon && simulator?.screen === "menu" && !simulator.recorded) {
    recordCall(state, { option: "invalide", outcome: "abandon" });
    saveState();
  }
  simulator = null;
  overlayRoot.innerHTML = "";
  render();
}

function recordSimulatorOutcome(outcome) {
  if (!simulator || simulator.recorded) return;
  recordCall(state, outcome);
  simulator.recorded = true;
  simulator.pendingOutcome = null;
  saveState();
}

function confirmClearData() {
  overlayRoot.innerHTML = `<div class="modal-backdrop"><section class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><button class="modal-close" data-action="cancel-clear" aria-label="Fermer">×</button><span class="result-icon danger-result">!</span><h2 id="confirm-title">Effacer toutes les données ?</h2><p>Les simulations, rapports et demandes de rappel stockés dans ce navigateur seront supprimés définitivement.</p><div class="confirm-actions"><button class="button button-secondary" data-action="cancel-clear">Annuler</button><button class="button button-danger" data-action="confirm-clear">Effacer les données</button></div></section></div>`;
  overlayRoot.querySelector('[data-action="confirm-clear"]').addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state = createInitialState();
    overlayRoot.innerHTML = "";
    render();
    showToast("Données de démonstration effacées.");
  }, { once: true });
  overlayRoot.querySelectorAll('[data-action="cancel-clear"]').forEach((button) => {
    button.addEventListener("click", () => { overlayRoot.innerHTML = ""; }, { once: true });
  });
}

function showAbout() {
  overlayRoot.innerHTML = `<div class="modal-backdrop" data-action="dismiss-about"><section class="confirm-modal about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title"><button class="modal-close" data-action="dismiss-about" aria-label="Fermer">×</button><span class="brand-mark about-mark">s</span><h2 id="about-title">SVI Mali · démonstration</h2><p>Prototype d’accueil vocal interactif pour administrations maliennes : menu DTMF, orientation, demandes de rappel minimales et indicateurs agrégés.</p><ul><li>Pas de trunk ou d’opérateur téléphonique connecté.</li><li>Pas de diagnostic médical, paiement ou collecte sensible.</li><li>Enregistrement audio désactivé et non disponible.</li><li>Les données restent dans ce navigateur.</li></ul><button class="button button-primary" data-action="dismiss-about">Compris</button></section></div>`;
  overlayRoot.querySelectorAll('[data-action="dismiss-about"]').forEach((button) => {
    button.addEventListener("click", () => { overlayRoot.innerHTML = ""; });
  });
}

function showToast(message, type = "success") {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  toast.classList.toggle("toast-error", type === "error");
  toast.textContent = message;
  toast.classList.add("toast-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("toast-visible"), 2800);
}

function maskPhone(phone) {
  return phone.replace(/\d(?=\d{2})/g, "•");
}

function reasonLabel(reason) {
  return { information: "Information", "rendez-vous": "Rendez-vous", autre: "Autre demande" }[reason] ?? "Demande";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function truncate(value, limit) {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}
