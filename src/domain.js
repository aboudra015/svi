export const STORAGE_KEY = "svi-mali-demo-v1";
export const CALL_RETENTION_DAYS = 30;
export const CALLBACK_RETENTION_DAYS = 30;
export const CLOSED_CALLBACK_RETENTION_DAYS = 7;

export const DEFAULT_CONFIG = Object.freeze({
  organization: "Administration centrale",
  greeting: "Bonjour et bienvenue. Pour le français, restez en ligne. Pour parler à un agent, tapez 0.",
  openingTime: "08:00",
  closingTime: "16:30",
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
      services: DEFAULT_CONFIG.services.map((defaultService) => {
        const service = validServices.find((item) => item.key === defaultService.key);
        return {
          ...defaultService,
          label: cleanText(service?.label, defaultService.label, 48),
          destination: cleanText(service?.destination, defaultService.destination, 48),
        };
      }),
    },
    calls: Array.isArray(value.calls)
      ? value.calls.filter(isValidCall).filter((call) => isWithinDays(call.createdAt, CALL_RETENTION_DAYS))
      : [],
    callbacks: Array.isArray(value.callbacks)
      ? value.callbacks.filter(isValidCallback).filter(isCallbackRetained)
      : [],
    recordingEnabled: false,
  };
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

function createId() {
  return globalThis.crypto?.randomUUID?.() ??
    `rappel-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
