export const STORAGE_KEY = "svi-mali-demo-v1";
export const CALL_RETENTION_DAYS = 30;
export const CALLBACK_RETENTION_DAYS = 30;
export const CLOSED_CALLBACK_RETENTION_DAYS = 7;
export const SUPPORTED_AUDIO_TYPES = Object.freeze([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
]);
export const AUDIO_PROMPT_KEYS = Object.freeze(["greeting", "1", "2", "3", "closed"]);

export const DEFAULT_CONFIG = Object.freeze({
  organization: "Administration centrale",
  greeting: "Bonjour et bienvenue. Pour le français, restez en ligne. Pour parler à un agent, tapez 0.",
  openingTime: "08:00",
  closingTime: "16:30",
  pbxHost: "",
  sipPort: 5060,
  sipTransport: "udp",
  audioPrompts: {
    greeting: null,
    "1": null,
    "2": null,
    "3": null,
    closed: null,
  },
  services: [
    { key: "1", label: "Horaires et informations", destination: "Accueil général" },
    { key: "2", label: "Services administratifs", destination: "Accueil général" },
    { key: "3", label: "Demander un rappel", destination: "Rappel par un agent" },
  ],
});

const CALLBACK_REASONS = new Set(["information", "rendez-vous", "autre"]);

export function createInitialState() {
  return {
    config: structuredClone(DEFAULT_CONFIG),
    endpoints: [],
    audioAssets: [],
    calls: [],
    callbacks: [],
    recordingEnabled: false,
  };
}

export function normalizeState(value) {
  if (!value || typeof value !== "object") return createInitialState();
  const config = value.config && typeof value.config === "object" ? value.config : {};
  const validServices = Array.isArray(config.services)
    ? config.services.filter((service) => service && ["1", "2", "3"].includes(service.key))
    : [];
  return {
    config: {
      organization: cleanText(config.organization, DEFAULT_CONFIG.organization, 80),
      greeting: cleanText(config.greeting, DEFAULT_CONFIG.greeting, 240),
      openingTime: validTime(config.openingTime) ? config.openingTime : DEFAULT_CONFIG.openingTime,
      closingTime: validTime(config.closingTime) ? config.closingTime : DEFAULT_CONFIG.closingTime,
      pbxHost: validatePbxHost(config.pbxHost) ? config.pbxHost : "",
      sipPort: validSipPort(config.sipPort) ? Number(config.sipPort) : DEFAULT_CONFIG.sipPort,
      sipTransport: ["udp", "tcp", "tls"].includes(config.sipTransport)
        ? config.sipTransport
        : DEFAULT_CONFIG.sipTransport,
      audioPrompts: normalizeAudioPrompts(config.audioPrompts, value.audioAssets),
      services: DEFAULT_CONFIG.services.map((defaultService) => {
        const service = validServices.find((item) => item.key === defaultService.key);
        return {
          ...defaultService,
          label: cleanText(service?.label, defaultService.label, 48),
          destination: cleanText(service?.destination, defaultService.destination, 48),
        };
      }),
    },
    endpoints: Array.isArray(value.endpoints)
      ? value.endpoints.filter(isValidEndpoint).map((endpoint) => ({
        id: endpoint.id,
        extension: endpoint.extension,
        label: endpoint.label,
        type: endpoint.type,
        gateway: endpoint.type === "analog" ? endpoint.gateway : "",
        port: endpoint.type === "analog" ? endpoint.port : "",
      }))
      : [],
    audioAssets: Array.isArray(value.audioAssets)
      ? value.audioAssets.filter(isValidAudioAsset).slice(0, 100)
      : [],
    calls: Array.isArray(value.calls)
      ? value.calls.filter(isValidCall).filter((call) => isWithinDays(call.createdAt, CALL_RETENTION_DAYS))
      : [],
    callbacks: Array.isArray(value.callbacks)
      ? value.callbacks.filter(isValidCallback).filter(isCallbackRetained)
      : [],
    recordingEnabled: false,
  };
}

export function addEndpoint(state, { extension, label, type, gateway = "", port = "" }) {
  const cleanExtension = String(extension ?? "").trim();
  const cleanLabel = cleanText(label, "", 60);
  if (!/^\d{3,6}$/.test(cleanExtension)) {
    throw new TypeError("Le numéro d’extension doit contenir 3 à 6 chiffres.");
  }
  if (state.endpoints.some((endpoint) => endpoint.extension === cleanExtension)) {
    throw new TypeError("Ce numéro d’extension existe déjà.");
  }
  if (!cleanLabel) throw new TypeError("Saisissez un nom pour ce poste.");
  if (!["softphone", "analog"].includes(type)) throw new TypeError("Type de poste invalide.");
  const cleanGateway = type === "analog" ? cleanText(gateway, "", 60) : "";
  const cleanPort = type === "analog" ? cleanText(port, "", 30) : "";
  if (type === "analog" && (!cleanGateway || !cleanPort)) {
    throw new TypeError("Indiquez la passerelle FXS et le port auxquels le téléphone analogique est raccordé.");
  }
  const endpoint = {
    id: createId(),
    extension: cleanExtension,
    label: cleanLabel,
    type,
    gateway: cleanGateway,
    port: cleanPort,
  };
  state.endpoints.push(endpoint);
  return endpoint;
}

export function updateEndpoint(state, id, updates) {
  const endpoint = state.endpoints.find((item) => item.id === id);
  if (!endpoint) return false;
  const updated = {
    ...endpoint,
    extension: String(updates.extension ?? endpoint.extension).trim(),
    label: cleanText(updates.label, endpoint.label, 60),
  };
  if (!/^\d{3,6}$/.test(updated.extension)) {
    throw new TypeError("Le numéro d’extension doit contenir 3 à 6 chiffres.");
  }
  if (state.endpoints.some((item) => item.id !== id && item.extension === updated.extension)) {
    throw new TypeError("Ce numéro d’extension existe déjà.");
  }
  if (!updated.label) throw new TypeError("Saisissez un nom pour ce poste.");
  if (endpoint.type === "analog") {
    updated.gateway = typeof updates.gateway === "string"
      ? updates.gateway.trim().slice(0, 60)
      : endpoint.gateway;
    updated.port = typeof updates.port === "string"
      ? updates.port.trim().slice(0, 30)
      : endpoint.port;
    if (!updated.gateway || !updated.port) {
      throw new TypeError("Indiquez la passerelle FXS et le port auxquels le téléphone analogique est raccordé.");
    }
  }
  Object.assign(endpoint, updated);
  return true;
}

export function removeEndpoint(state, id) {
  const originalLength = state.endpoints.length;
  state.endpoints = state.endpoints.filter((endpoint) => endpoint.id !== id);
  return state.endpoints.length !== originalLength;
}

export function addAudioAsset(state, asset) {
  if (!isValidAudioAsset(asset)) throw new TypeError("Fichier audio invalide.");
  if (state.audioAssets.length >= 100) throw new TypeError("La bibliothèque est limitée à 100 fichiers audio.");
  const normalized = {
    id: asset.id,
    fileName: cleanText(asset.fileName, "message-audio", 120),
    mimeType: asset.mimeType,
    size: asset.size,
    uploadedAt: asset.uploadedAt ?? new Date().toISOString(),
  };
  state.audioAssets.push(normalized);
  return normalized;
}

export function assignAudioPrompt(state, promptKey, assetId) {
  if (!AUDIO_PROMPT_KEYS.includes(promptKey)) throw new TypeError("Emplacement d’annonce audio invalide.");
  if (assetId !== null && !state.audioAssets.some((asset) => asset.id === assetId)) {
    throw new TypeError("Le fichier audio sélectionné n’existe pas.");
  }
  state.config.audioPrompts[promptKey] = assetId;
}

export function removeAudioAsset(state, assetId) {
  const originalLength = state.audioAssets.length;
  state.audioAssets = state.audioAssets.filter((asset) => asset.id !== assetId);
  if (state.audioAssets.length === originalLength) return false;
  for (const promptKey of AUDIO_PROMPT_KEYS) {
    if (state.config.audioPrompts[promptKey] === assetId) state.config.audioPrompts[promptKey] = null;
  }
  return true;
}

export function buildConfigurationExport(state, exportedAt = new Date().toISOString()) {
  return {
    format: "svi-mali-configuration-v1",
    exportedAt,
    organization: state.config.organization,
    voiceSettings: {
      openingTime: state.config.openingTime,
      closingTime: state.config.closingTime,
      greetingText: state.config.greeting,
    },
    sipProfile: {
      server: state.config.pbxHost,
      port: state.config.sipPort,
      transport: state.config.sipTransport,
      credentialsIncluded: false,
    },
    endpoints: state.endpoints.map((endpoint) => ({ ...endpoint })),
    audioPrompts: AUDIO_PROMPT_KEYS.map((key) => {
      const asset = state.audioAssets.find((item) => item.id === state.config.audioPrompts[key]);
      return {
        key,
        asset: asset ? {
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          size: asset.size,
        } : null,
      };
    }),
    limits: {
      provisioningPerformed: false,
      audioFilesIncluded: false,
      analogDevicesRequireFxSGateway: true,
      note: "Descriptif uniquement. Configurer le PBX, les identifiants, la passerelle et les téléphones séparément sur une infrastructure sécurisée.",
    },
  };
}

export function buildEndpointExport(state, endpointId, exportedAt = new Date().toISOString()) {
  const endpoint = state.endpoints.find((item) => item.id === endpointId);
  if (!endpoint) throw new TypeError("Extension introuvable.");
  return {
    format: "svi-mali-endpoint-v1",
    exportedAt,
    organization: state.config.organization,
    endpoint: { ...endpoint },
    sipProfile: endpoint.type === "softphone" ? {
      username: endpoint.extension,
      server: state.config.pbxHost,
      port: state.config.sipPort,
      transport: state.config.sipTransport,
      password: null,
      credentialsIncluded: false,
    } : null,
    provisioningPerformed: false,
    note: endpoint.type === "analog"
      ? "Configuration descriptive uniquement. Raccorder le poste au port FXS documenté de la passerelle; le téléphone analogique n’est pas piloté par Internet."
      : "Profil de préparation uniquement. Renseigner un secret séparément sur le PBX sécurisé et configurer le softphone manuellement. Aucun accès réseau n’est testé.",
  };
}

export function validateAudioFile({ name, type, size }) {
  const extensionType = {
    ".aac": "audio/aac",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".oga": "audio/ogg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".weba": "audio/webm",
    ".webm": "audio/webm",
  }[String(name ?? "").toLowerCase().match(/\.[^.]+$/)?.[0]];
  const mimeType = SUPPORTED_AUDIO_TYPES.includes(type) ? type : extensionType;
  if (!mimeType) throw new TypeError("Format non pris en charge. Utilisez WAV, MP3, OGG, AAC, M4A ou WebM.");
  if (!Number.isSafeInteger(size) || size <= 0 || size > 10 * 1024 * 1024) {
    throw new TypeError("Le fichier audio doit peser entre 1 octet et 10 Mo.");
  }
  return mimeType;
}

export function validatePbxHost(value) {
  if (typeof value !== "string" || value.length > 253) return false;
  return value.split(".").every((label) =>
    label.length > 0 &&
    label.length <= 63 &&
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label),
  );
}

export function validatePhone(value) {
  const compact = String(value ?? "").replace(/[\s().-]/g, "");
  const local = /^\d{8}$/.test(compact);
  const international = /^\+223\d{8}$/.test(compact);
  return local || international;
}

export function recordCall(state, { option, outcome, createdAt = new Date().toISOString() }) {
  if (!["1", "2", "3", "0", "invalide"].includes(option)) {
    throw new TypeError("Option de menu invalide.");
  }
  if (!["information", "transfert_simule", "rappel_demande", "abandon"].includes(outcome)) {
    throw new TypeError("Résultat d’appel invalide.");
  }
  state.calls.push({ option, outcome, createdAt });
  state.calls = state.calls.filter((call) => isWithinDays(call.createdAt, CALL_RETENTION_DAYS));
}

export function addCallback(state, { phone, reason, createdAt = new Date().toISOString() }) {
  if (!validatePhone(phone)) {
    throw new TypeError("Saisissez un numéro malien valide de 8 chiffres, avec +223 en option.");
  }
  if (!CALLBACK_REASONS.has(reason)) throw new TypeError("Motif de rappel invalide.");
  const callback = {
    id: createId(),
    phone: String(phone).replace(/[\s().-]/g, ""),
    reason,
    status: "pending",
    createdAt,
  };
  state.callbacks.unshift(callback);
  return callback;
}

export function updateCallbackStatus(state, id, status, updatedAt = new Date().toISOString()) {
  if (!["pending", "completed"].includes(status)) throw new TypeError("Statut de rappel invalide.");
  const callback = state.callbacks.find((item) => item.id === id);
  if (!callback) return false;
  callback.status = status;
  if (status === "completed") callback.completedAt = updatedAt;
  else delete callback.completedAt;
  return true;
}

export function getMetrics(state, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const todayCalls = state.calls.filter((call) => call.createdAt.startsWith(today));
  const callbacks = state.callbacks.filter((callback) => callback.status === "pending").length;
  const transferred = state.calls.filter((call) => call.outcome === "transfert_simule").length;
  const transferRate = state.calls.length
    ? Math.round((transferred / state.calls.length) * 100)
    : 0;
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      label: new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date).replace(".", ""),
      count: state.calls.filter((call) => call.createdAt.startsWith(key)).length,
    };
  });
  return {
    total: state.calls.length,
    today: todayCalls.length,
    callbacks,
    transferRate,
    daily,
    outcomes: {
      information: state.calls.filter((call) => call.outcome === "information").length,
      transferred,
      callback: state.calls.filter((call) => call.outcome === "rappel_demande").length,
      abandoned: state.calls.filter((call) => call.outcome === "abandon").length,
    },
  };
}

function isValidCall(call) {
  return (
    call &&
    ["1", "2", "3", "0", "invalide"].includes(call.option) &&
    ["information", "transfert_simule", "rappel_demande", "abandon"].includes(call.outcome) &&
    typeof call.createdAt === "string" &&
    Number.isFinite(Date.parse(call.createdAt))
  );
}

function isValidEndpoint(endpoint) {
  return (
    endpoint &&
    typeof endpoint.id === "string" &&
    /^\d{3,6}$/.test(endpoint.extension) &&
    typeof endpoint.label === "string" &&
    endpoint.label.trim().length > 0 &&
    ["softphone", "analog"].includes(endpoint.type) &&
    (endpoint.type !== "analog" ||
      (typeof endpoint.gateway === "string" && endpoint.gateway.trim() &&
        typeof endpoint.port === "string" && endpoint.port.trim()))
  );
}

function isValidAudioAsset(asset) {
  return (
    asset &&
    typeof asset.id === "string" &&
    typeof asset.fileName === "string" &&
    SUPPORTED_AUDIO_TYPES.includes(asset.mimeType) &&
    Number.isSafeInteger(asset.size) &&
    asset.size > 0 &&
    asset.size <= 10 * 1024 * 1024 &&
    typeof asset.uploadedAt === "string" &&
    Number.isFinite(Date.parse(asset.uploadedAt))
  );
}

function normalizeAudioPrompts(value, assets) {
  const availableIds = new Set(
    Array.isArray(assets) ? assets.filter(isValidAudioAsset).map((asset) => asset.id) : [],
  );
  return Object.fromEntries(AUDIO_PROMPT_KEYS.map((key) => [
    key,
    typeof value?.[key] === "string" && availableIds.has(value[key]) ? value[key] : null,
  ]));
}

function isValidCallback(callback) {
  return (
    callback &&
    typeof callback.id === "string" &&
    validatePhone(callback.phone) &&
    CALLBACK_REASONS.has(callback.reason) &&
    ["pending", "completed"].includes(callback.status) &&
    typeof callback.createdAt === "string" &&
    Number.isFinite(Date.parse(callback.createdAt))
  );
}

function isCallbackRetained(callback) {
  if (!isWithinDays(callback.createdAt, CALLBACK_RETENTION_DAYS)) return false;
  return callback.status !== "completed" ||
    !callback.completedAt ||
    isWithinDays(callback.completedAt, CLOSED_CALLBACK_RETENTION_DAYS);
}

function isWithinDays(value, days) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= Date.now() - days * 86_400_000;
}

function cleanText(value, fallback, maxLength) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value.trim().slice(0, maxLength);
}

function validTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validSipPort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ??
    `rappel-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
