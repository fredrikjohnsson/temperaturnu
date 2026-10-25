const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createHash } = require('node:crypto');

function harness() {
  const timers = new Map();
  const calls = [];
  const responses = [];
  const cache = new Map();
  let sequence = 0;
  const setTimer = (fn, ms) => { const id = ++sequence; timers.set(id, { fn, ms }); return id; };
  const clearTimer = (id) => timers.delete(id);
  class Base {
    constructor() {
      this.setting = 'evenas'; this.available = true; this.values = []; this.events = []; this.logs = [];
      this.homey = {
        setTimeout: setTimer, clearTimeout: clearTimer,
        geolocation: { getLatitude: () => 58, getLongitude: () => 12 },
        flow: {
          getDeviceTriggerCard: () => ({ trigger: async (device, tokens) => this.events.push(tokens) }),
          getActionCard: () => ({ registerRunListener: (fn) => { this.action = fn; } }),
        },
      };
    }
    getSetting() { return this.setting; }
    getData() { return { id: 'test-device' }; }
    log(...args) { this.logs.push(args); }
    error(...args) { this.logs.push(args); }
    async setAvailable() { this.available = true; }
    async setUnavailable(message) { this.available = false; this.message = message; }
    async unsetWarning() {}
    async setCapabilityValue(key, value) { this.values.push(value); }
  }
  const https = { get(url, callback) {
    const req = new EventEmitter(); req.destroy = () => { req.destroyed = true; };
    calls.push({ url, req });
    const answer = responses.shift();
    req.respond = (spec) => {
      if (req.destroyed) return;
      if (spec.error) { req.emit('error', new Error(spec.error)); return; }
      const res = new EventEmitter(); res.statusCode = spec.status || 200;
      res.destroy = () => { res.destroyed = true; };
      callback(res);
      if (!res.destroyed) {
        res.emit('data', Buffer.from(spec.body || ''));
        if (spec.aborted) res.emit('aborted');
        else if (!spec.hang && !res.destroyed) res.emit('end');
      }
    };
    if (answer) queueMicrotask(() => req.respond(answer));
    return req;
  } };
  function load(file) {
    const filename = path.resolve(__dirname, '../.homeybuild', file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      module, exports: module.exports, Buffer, URL, setTimeout: setTimer, clearTimeout: clearTimer,
      require(id) {
        if (id === 'homey') return { App: Base, Device: Base, Driver: Base, env: {} };
        if (id === 'https') return https;
        if (id.startsWith('.')) return load(path.relative(path.resolve(__dirname, '../.homeybuild'), path.resolve(path.dirname(filename), id + '.js')));
        return require(id);
      },
    }, { filename });
    return module.exports;
  }
  const json = (stations = [{ id: 'evenas', title: 'Evenås', temp: '12.3' }], client = 'unsigned') => ({
    body: JSON.stringify({ title: 'Temperatur.nu API 1.20', client, stations }),
  });
  return { timers, calls, responses, load, json, Device: load('drivers/temperature/device.js'), Driver: load('drivers/temperature/driver.js'), App: load('app.js'), api: load('lib/api.js') };
}

test('outage marks unavailable, successful retry restores availability and updates before trigger', async () => {
  const h = harness(); const d = new h.Device();
  h.responses.push({ error: 'offline' }); await d.onInit(); assert.equal(d.available, false);
  h.responses.push(h.json()); await d.fetchTemperature();
  assert.equal(d.available, true); assert.equal(d.values[0], 12.3); assert.equal(d.events.length, 1);
  assert.equal(h.timers.size, 1);
});

for (const [label, answer] of [
  ['empty stations', () => ({ body: '{"title":"Temperatur.nu API 1.20","client":"unsigned","stations":[]}' })],
  ['invalid JSON', () => ({ body: '<html>bad</html>' })],
  ['null station', h => h.json([null])],
  ['wrong station', h => h.json([{ id: 'wrong', title: 'Wrong', temp: '12' }])],
  ['blocked client', h => h.json(undefined, 'blocked')],
  ['stale temperature', h => h.json([{ id: 'evenas', title: 'Evenås', temp: 'N/A' }])],
  ['HTTP failure', () => ({ status: 503 })],
]) test(label + ' is handled without triggering a flow', async () => {
  const h = harness(); const d = new h.Device(); h.responses.push(answer(h)); await d.onInit();
  assert.equal(d.available, false); assert.equal(d.events.length, 0); assert.equal(h.timers.size, 1);
});

test('missing station does not make a network request', async () => {
  const h = harness(); const d = new h.Device(); d.setting = null; await d.onInit();
  assert.equal(d.available, false); assert.equal(h.calls.length, 0);
});

test('strict numeric validation rejects malformed, missing and nonfinite readings', () => {
  const h = harness();
  for (const value of ['12junk', '', ' ', 'Infinity', Infinity, NaN, null, undefined, [], true, '12,3']) assert.throws(() => h.api.temperatureValue(value));
  assert.equal(h.api.temperatureValue('-12.3'), -12.3); assert.equal(h.api.temperatureValue(0), 0);
});

test('concurrent refreshes share a request and deletion cancels it without updates or new timers', async () => {
  const h = harness(); const d = new h.Device(); const first = d.onInit(); const second = d.fetchTemperature();
  assert.equal(h.calls.length, 1); await d.onDeleted(); await Promise.all([first, second]);
  assert.equal(h.calls[0].req.destroyed, true); assert.equal(d.events.length, 0); assert.equal(h.timers.size, 0);
  assert.equal(await d.fetchTemperature(), false);
});

test('uninitialization clears pending polling', async () => {
  const h = harness(); const d = new h.Device(); h.responses.push(h.json()); await d.onInit(); await d.onUninit();
  assert.equal(h.timers.size, 0);
});

test('the next scheduled poll runs after five minutes and schedules exactly one successor', async () => {
  const h = harness(); const d = new h.Device(); h.responses.push(h.json()); await d.onInit();
  const [timerId, timer] = [...h.timers.entries()][0];
  assert.equal(timer.ms, 300000); h.timers.delete(timerId);
  h.responses.push(h.json([{ id: 'evenas', title: 'Evenås', temp: '13.1' }]));
  timer.fn(); await d.inFlight; await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(d.values, [12.3, 13.1]); assert.equal(d.events.length, 2);
  assert.equal(h.timers.size, 1);
});

test('station change cancels old request and fetches the supplied new setting', async () => {
  const h = harness(); const d = new h.Device(); const initial = d.onInit();
  h.responses.push(h.json([{ id: 'hogenorum', title: 'Högenorum', temp: '8.1' }]));
  await d.onSettings({ newSettings: { stationid: ' HOGENORUM ' }, changedKeys: ['stationid'] }); await initial;
  assert.equal(h.calls.length, 2); assert.equal(h.calls[0].req.destroyed, true);
  assert.equal(h.calls[1].url.searchParams.get('p'), 'hogenorum'); assert.deepEqual(d.values, [8.1]);
  assert.equal(h.timers.size, 1);
  await assert.rejects(d.onSettings({ newSettings: { stationid: '' }, changedKeys: ['stationid'] }));
});

test('failed capability write never fires the update trigger', async () => {
  const h = harness(); const d = new h.Device(); d.setCapabilityValue = async () => { throw Error('write failed'); };
  h.responses.push(h.json()); await d.onInit(); assert.equal(d.events.length, 0); assert.equal(d.available, false);
});

test('update trigger waits until the capability write has completed', async () => {
  const h = harness(); const d = new h.Device(); let finishWrite;
  d.setCapabilityValue = () => new Promise(resolve => { finishWrite = resolve; });
  h.responses.push(h.json()); const update = d.onInit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof finishWrite, 'function'); assert.equal(d.events.length, 0);
  finishWrite(); await update; assert.equal(d.events.length, 1);
});

test('signed API responses accepted and signatures cover the exact encoded URL', async () => {
  const h = harness(); h.responses.push(h.json(undefined, 'signed'));
  await h.api.getStations({ p: 'evenas' }, { clientId: 'test@example.com', clientKey: 'dummy' });
  const url = h.calls[0].url; const signature = url.searchParams.get('sign'); url.searchParams.delete('sign');
  assert.equal(signature, createHash('md5').update(url.host + url.pathname + url.search + '+dummy').digest('hex'));
  assert.equal(url.protocol, 'https:');
});

test('pairing network and malformed response failures fall back to a usable station', async () => {
  const h = harness(); const d = new h.Driver(); h.responses.push({ error: 'offline' });
  const station = await d.getNearestStation(); assert.equal(station.stationId, 'hogenorum');
  h.responses.push(h.json([])); assert.equal((await d.getNearestStation()).stationId, 'hogenorum');
});

test('report action waits for confirmation, redacts secrets, and rejects service errors', async () => {
  const h = harness(); const app = new h.App(); await app.onInit(); let done = false;
  const action = app.action({ hash: 'secret123', temperature: 12 }).then(value => { done = true; return value; });
  await Promise.resolve(); assert.equal(done, false);
  h.calls[0].req.respond({ body: 'ok\n' }); assert.equal(await action, true);
  assert.equal(JSON.stringify(app.logs).includes('secret123'), false);
  h.responses.push({ body: 'not accepted' }); await assert.rejects(app.action({ hash: 'secret123', temperature: 12 }), /rejected/);
  h.responses.push({ status: 500 }); await assert.rejects(app.action({ hash: 'secret123', temperature: 12 }), /HTTP 500/);
  h.responses.push({ error: 'secret123' }); await assert.rejects(app.action({ hash: 'secret123', temperature: 12 }), /^Error: Could not reach/);
});

test('requests have an absolute timeout and size bound and reject interrupted bodies and redirects', async () => {
  const h = harness(); const pending = h.api.requestText(new URL('https://example.com'));
  const timeout = [...h.timers.values()].find(t => t.ms === 15000); timeout.fn(); await assert.rejects(pending, /timed out/);
  assert.equal(h.calls[0].req.destroyed, true);
  for (const answer of [{ body: 'x'.repeat(256 * 1024 + 1) }, { body: 'ok', aborted: true }, { status: 302 }]) {
    h.responses.push(answer); await assert.rejects(h.api.requestText(new URL('https://example.com')));
  }
  assert.equal(h.timers.size, 0);
});
