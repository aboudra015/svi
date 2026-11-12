import test from "node:test";
import assert from "node:assert/strict";
import {
  addCallback,
  createInitialState,
  getMetrics,
  normalizeState,
  recordCall,
  updateCallbackStatus,
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
