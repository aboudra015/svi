import test from "node:test";
import assert from "node:assert/strict";
import {
  addAudioAsset,
  addCallback,
  addEndpoint,
  assignAudioPrompt,
  buildConfigurationExport,
  buildEndpointExport,
  createInitialState,
  getMetrics,
  normalizeState,
  removeAudioAsset,
  removeEndpoint,
  recordCall,
  updateEndpoint,
  updateCallbackStatus,
  validateAudioFile,
  validatePhone,
} from "../src/domain.js";

test("phone validation accepts local and +223 numbers but rejects malformed input", () => {
  assert.equal(validatePhone("70 12 34 56"), true);
  assert.equal(validatePhone("+223 70 12 34 56"), true);
  assert.equal(validatePhone("1234567"), false);
  assert.equal(validatePhone("+224 70 12 34 56"), false);
});

test("callback requests retain only the requested number and a coarse reason", () => {
  const state = createInitialState();
  const callback = addCallback(state, { phone: "+223 70 12 34 56", reason: "information" });
  assert.equal(callback.phone, "+22370123456");
  assert.equal(callback.status, "pending");
  assert.equal("callerId" in callback, false);
  assert.equal("recording" in callback, false);
  assert.throws(() => addCallback(state, { phone: "123", reason: "information" }), TypeError);
  assert.throws(() => addCallback(state, { phone: "70123456", reason: "résultat médical" }), TypeError);
});

test("call reports are aggregate-only and callback status is tracked", () => {
  const state = createInitialState();
  const callback = addCallback(state, { phone: "70123456", reason: "rendez-vous" });
  recordCall(state, { option: "3", outcome: "rappel_demande" });
  recordCall(state, { option: "0", outcome: "transfert_simule" });
  const metrics = getMetrics(state);
  assert.equal(metrics.total, 2);
  assert.equal(metrics.callbacks, 1);
  assert.equal(metrics.transferRate, 50);
  assert.deepEqual(Object.keys(state.calls[0]).sort(), ["createdAt", "option", "outcome"]);
  assert.equal(updateCallbackStatus(state, callback.id, "completed"), true);
  assert.equal(getMetrics(state).callbacks, 0);
});

test("normalization enforces recording-off and removes expired records", () => {
  const oldDate = new Date(Date.now() - 31 * 86_400_000).toISOString();
  const state = normalizeState({
    config: { ...createInitialState().config, openingTime: "bad-time" },
    recordingEnabled: true,
    calls: [{ option: "1", outcome: "information", createdAt: oldDate }],
    callbacks: [{
      id: "expired", phone: "70123456", reason: "autre", status: "pending", createdAt: oldDate,
    }],
  });
  assert.equal(state.recordingEnabled, false);
  assert.equal(state.config.openingTime, "08:00");
  assert.equal(state.calls.length, 0);
  assert.equal(state.callbacks.length, 0);
});

test("invalid aggregate call events are rejected", () => {
  const state = createInitialState();
  assert.throws(() => recordCall(state, { option: "9", outcome: "information" }), TypeError);
  assert.throws(() => recordCall(state, { option: "1", outcome: "audio_enregistre" }), TypeError);
});

test("softphone profiles are local configuration and export no SIP secrets", () => {
  const state = createInitialState();
  state.config.pbxHost = "pbx.example.ml";
  state.config.sipPort = 5061;
  state.config.sipTransport = "tls";
  const endpoint = addEndpoint(state, {
    extension: "2001",
    label: "Accueil principal",
    type: "softphone",
  });
  assert.equal(endpoint.type, "softphone");
  assert.throws(() => addEndpoint(state, {
    extension: "2001", label: "Doublon", type: "softphone",
  }), /existe déjà/);
  assert.throws(() => addEndpoint(state, {
    extension: "20", label: "Trop court", type: "softphone",
  }), /3 à 6 chiffres/);
  const profile = buildEndpointExport(state, endpoint.id, "2026-11-12T00:00:00.000Z");
  assert.equal(profile.sipProfile.username, "2001");
  assert.equal(profile.sipProfile.server, "pbx.example.ml");
  assert.equal(profile.sipProfile.port, 5061);
  assert.equal(profile.sipProfile.transport, "tls");
  assert.equal(profile.sipProfile.password, null);
  assert.equal(profile.sipProfile.credentialsIncluded, false);
  assert.equal(profile.provisioningPerformed, false);
  assert.equal("password" in profile.endpoint, false);
  assert.equal(removeEndpoint(state, endpoint.id), true);
  assert.equal(removeEndpoint(state, endpoint.id), false);
});

test("analog endpoints require and retain FXS gateway and port descriptions", () => {
  const state = createInitialState();
  assert.throws(() => addEndpoint(state, {
    extension: "2100", label: "Poste accueil", type: "analog",
  }), /passerelle FXS/);
  const endpoint = addEndpoint(state, {
    extension: "2100",
    label: "Poste accueil",
    type: "analog",
    gateway: "Passerelle accueil",
    port: "FXS 1",
  });
  assert.equal(endpoint.gateway, "Passerelle accueil");
  assert.equal(endpoint.port, "FXS 1");
  const profile = buildEndpointExport(state, endpoint.id);
  assert.equal(profile.sipProfile, null);
  assert.match(profile.note, /n’est pas piloté par Internet/);
  assert.throws(() => updateEndpoint(state, endpoint.id, {
    extension: "2100", label: "Poste accueil", gateway: "", port: "",
  }), /passerelle FXS/);
  assert.equal(updateEndpoint(state, endpoint.id, {
    extension: "2101", label: "Accueil secondaire", gateway: "Passerelle accueil", port: "FXS 2",
  }), true);
  assert.equal(endpoint.port, "FXS 2");
});

test("audio prompt assets are validated, associated, removable, and excluded from parameter exports", () => {
  const state = createInitialState();
  const asset = {
    id: "audio-1",
    fileName: "accueil-fr.wav",
    mimeType: "audio/wav",
    size: 128,
    uploadedAt: "2026-11-12T00:00:00.000Z",
  };
  addAudioAsset(state, asset);
  assert.throws(() => addAudioAsset(state, { ...asset, id: "audio-invalid", size: 10 * 1024 * 1024 + 1 }), /Fichier audio invalide/);
  assignAudioPrompt(state, "greeting", asset.id);
  assignAudioPrompt(state, "3", asset.id);
  assert.throws(() => assignAudioPrompt(state, "medical", asset.id), /Emplacement/);
  assert.throws(() => assignAudioPrompt(state, "1", "missing"), /n’existe pas/);
  const exported = buildConfigurationExport(state, "2026-11-12T00:00:00.000Z");
  assert.equal(exported.audioPrompts.find((item) => item.key === "greeting").asset.fileName, "accueil-fr.wav");
  assert.equal(exported.audioPrompts.find((item) => item.key === "3").asset.mimeType, "audio/wav");
  assert.equal(exported.limits.audioFilesIncluded, false);
  assert.equal(exported.limits.provisioningPerformed, false);
  assert.equal(JSON.stringify(exported).includes("blob"), false);
  assert.equal(removeAudioAsset(state, asset.id), true);
  assert.equal(state.config.audioPrompts.greeting, null);
  assert.equal(state.config.audioPrompts["3"], null);
  assert.equal(removeAudioAsset(state, asset.id), false);
});

test("audio upload accepts supported formats and enforces a 10 MB limit", () => {
  assert.equal(validateAudioFile({ name: "message.mp3", type: "", size: 1024 }), "audio/mpeg");
  assert.equal(validateAudioFile({ name: "message.wav", type: "audio/wav", size: 1 }), "audio/wav");
  assert.throws(() => validateAudioFile({
    name: "message.exe", type: "application/octet-stream", size: 1024,
  }), /Format non pris en charge/);
  assert.throws(() => validateAudioFile({
    name: "message.mp3", type: "audio/mpeg", size: 10 * 1024 * 1024 + 1,
  }), /10 Mo/);
});

test("normalization drops invalid endpoints and prompt links to missing local media", () => {
  const state = normalizeState({
    ...createInitialState(),
    endpoints: [
      { id: "valid", extension: "2001", label: "Softphone", type: "softphone" },
      { id: "invalid-analog", extension: "2002", label: "Poste", type: "analog" },
    ],
    config: {
      ...createInitialState().config,
      pbxHost: "https://not-a-pbx.example",
      sipPort: 70000,
      audioPrompts: { greeting: "missing" },
    },
    audioAssets: [],
  });
  assert.equal(state.endpoints.length, 1);
  assert.equal(state.config.pbxHost, "");
  assert.equal(state.config.sipPort, 5060);
  assert.equal(state.config.audioPrompts.greeting, null);
});
