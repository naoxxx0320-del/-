const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../apps-script/lottery-url-install.gs'), 'utf8');
const campaign = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/lottery-campaign.json'), 'utf8'));

function server(options = {}) {
  const rows = options.rows || [];
  const properties = { LOTTERY_URL_SHEET_ID: 'dedicated', LOTTERY_URL_CAMPAIGN_ID: campaign.campaignId, ...options.properties };
  let held = false, id = 0, failFlush = Boolean(options.failFlush);
  let headers;
  const calls = [];
  class Clock extends Date { static now() { return options.now ?? Date.parse('2026-10-07T12:00:00+09:00'); } }
  let context;
  const sheet = {
    getDataRange() { assert.ok(held); return { getValues: () => [headers || Array.from(context.LOTTERY_HEADERS), ...rows.map(row => row.slice())] }; },
    appendRow(row) { assert.ok(held); calls.push('write'); rows.push(Array.from(row)); },
  };
  context = vm.createContext({
    Date: Clock,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties[key] || null,
      setProperties(next, wipe) { assert.ok(held); assert.equal(wipe, false); Object.assign(properties, next); },
    }) },
    LockService: { getScriptLock: () => ({
      tryLock() { calls.push('lock'); held = !options.busy; return held; },
      hasLock: () => held,
      releaseLock() { assert.ok(held); held = false; calls.push('unlock'); },
    }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getId: () => 'dedicated' }),
      getUi: () => ({ alert() { calls.push('alert'); } }),
      openById(value) { assert.ok(held); assert.equal(value, 'dedicated'); return { getSheetByName: () => sheet }; },
      flush() { assert.ok(held); calls.push('flush'); if (failFlush) { failFlush = false; throw new Error('response failure'); } },
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_alg, value) => [...crypto.createHash('sha256').update(value).digest()],
      getUuid: () => 'url-result-' + (++id),
    },
    HtmlService: { createHtmlOutput: html => ({ html, setTitle() { return this; }, addMetaTag(name, value) { this.viewport = [name, value]; return this; } }) },
    UrlFetchApp: { fetch() { throw new Error('URL mode must not call LINE'); } },
  });
  vm.runInContext(source, context);
  if (options.damaged) headers = ['incorrect'];
  function call(action = 'draw', browserId = 'a'.repeat(64), extra = {}) {
    const result = context.lotteryUrlRequest({ action, browserId, campaignId: campaign.campaignId, gemIndex: '1', ...extra });
    assert.equal(held, false);
    return JSON.parse(JSON.stringify(result));
  }
  return { call, context, rows, properties, calls };
}

test('URL draw uses no LINE credentials, persists once, and ignores posted prize and probability', () => {
  const s = server();
  assert.deepEqual(s.call('status'), { ok: true, eligible: true });
  assert.equal(s.rows.length, 0);
  vm.runInContext('Math.random = () => 0.5', s.context);
  const first = s.call('draw', 'a'.repeat(64), { prizeId: 1, probability: 1, outcome: 'prize_1' });
  assert.equal(first.result.prizeId, 3);
  assert.deepEqual(s.call('draw', 'a'.repeat(64), { gemIndex: '2' }).result, first.result);
  assert.deepEqual(server({ rows: s.rows }).call('status').result, first.result);
  assert.equal(s.rows.length, 1);
  assert.deepEqual(s.calls, ['lock', 'unlock', 'lock', 'write', 'flush', 'unlock', 'lock', 'unlock']);
  assert.notEqual(s.rows[0][1], 'a'.repeat(64), 'only hashed browser identity is stored');
});

test('global first-prize inventory stops at three, with lower prizes continuing without losses', () => {
  const s = server();
  vm.runInContext('Math.random = () => 0', s.context);
  for (const key of ['a', 'b', 'c']) assert.equal(s.call('draw', key.repeat(64)).result.prizeId, 1);
  assert.equal(s.call('draw', 'd'.repeat(64), { prizeId: 1, probability: 1 }).result.prizeId, 2);
  assert.equal(s.rows.filter(row => row[2] === 'prize_1').length, 3);
  assert.equal(s.call('status', 'c'.repeat(64)).repeated, true);
});

test('URL backend uses configured probability boundaries and accepts another browser as another entry', () => {
  for (const [sample, rank] of [[0.000099999, 1], [0.0001, 2], [0.3334, 3], [0.6667, 4], [0.999999, 4]]) {
    const s = server(); vm.runInContext(`Math.random = () => ${sample}`, s.context);
    assert.equal(s.call().result.prizeId, rank);
  }
  const s = server(); s.call(); s.call('draw', 'b'.repeat(64));
  assert.equal(s.rows.length, 2, 'browser identification is deliberately not person authentication');
});

test('invalid identity, action, campaign, selection, missing configuration and busy lock save no entries', () => {
  const cases = [
    { browserId: 'short' }, { browserId: 'g'.repeat(64) }, { browserId: 123 },
    { campaignId: 'other' }, { action: 'change-result' }, { gemIndex: '3' },
  ];
  for (const extra of cases) { const s = server(); assert.equal(s.call('draw', 'a'.repeat(64), extra).error, 'INVALID_REQUEST'); assert.equal(s.rows.length, 0); }
  for (const [options, code] of [[{ properties: { LOTTERY_URL_SHEET_ID: '' } }, 'NOT_CONFIGURED'], [{ properties: { LOTTERY_URL_CAMPAIGN_ID: 'other' } }, 'NOT_CONFIGURED'], [{ busy: true }, 'BUSY'], [{ damaged: true }, 'DATA_ERROR']]) {
    const s = server(options); assert.equal(s.call().error, code); assert.equal(s.rows.length, 0);
  }
});

test('a write followed by failure is recovered through status without rerolling', () => {
  const s = server({ failFlush: true });
  assert.equal(s.call().error, 'SERVER_ERROR'); assert.equal(s.rows.length, 1);
  assert.equal(s.call('status').repeated, true); assert.equal(s.rows.length, 1);
});

test('November deadline is server-enforced and saved results remain available after it', () => {
  assert.equal(server({ now: Date.parse(campaign.startsAt) - 1 }).call().error, 'NOT_STARTED');
  const last = server({ now: Date.parse(campaign.endsAt) - 1 }); const first = last.call(); assert.equal(first.ok, true);
  const ended = server({ now: Date.parse(campaign.endsAt), rows: last.rows });
  assert.deepEqual(ended.call('status').result, first.result);
  assert.equal(ended.call('draw', 'b'.repeat(64)).error, 'ENDED');
});

test('URL deployment serves the actual campaign page and bootstrap preserves existing results', () => {
  const s = server(); s.call(); const original = JSON.stringify(s.rows);
  s.context.setupUrlLottery(); assert.equal(JSON.stringify(s.rows), original);
  const page = s.context.doGet();
  assert.equal(page.html.includes('class="info campaign-terms"'), false);
  assert.ok(page.html.includes('<li><b>1等</b>'));
  assert.ok(page.html.includes('aria-label="当選結果の保存"'));
  assert.ok(page.html.includes('google.script.run'));
  assert.equal(page.html.includes('liff.init'), false);
  assert.equal(page.html.includes('id="outcome"'), false);
  assert.equal(page.html.includes('id="reset"'), false);
  assert.deepEqual(page.viewport, ['viewport', 'width=device-width, initial-scale=1']);
  for (const properties of [{ LOTTERY_URL_CAMPAIGN_ID: 'other' }, { LOTTERY_URL_SHEET_ID: 'other' }, { LINE_LOGIN_CHANNEL_ID: '123' }, { LOTTERY_SHEET_ID: 'legacy' }]) {
    const other = server({ properties }); const before = JSON.stringify(other.properties);
    assert.throws(() => other.context.setupUrlLottery(), /既存の接続設定/);
    assert.equal(JSON.stringify(other.properties), before);
  }
  const remote = server();
  const before = JSON.stringify(remote.properties);
  remote.context.SpreadsheetApp.getUi = () => { throw new Error('not a spreadsheet editor context'); };
  assert.throws(() => remote.context.setupUrlLottery(), /spreadsheet editor/);
  assert.equal(JSON.stringify(remote.properties), before);
  assert.deepEqual(remote.calls, []);
});

test('changing probability does not alter a previously stored first-prize result', () => {
  const s = server(); s.call(); s.rows[0][2] = 'prize_1';
  const previous = s.call('status').result;
  assert.equal(previous.prizeId, 1);
  assert.equal(previous.prizeLabel, '施術90分無料');
  assert.deepEqual(s.call().result, previous);
  assert.equal(s.rows.length, 1);
  vm.runInContext('Math.random = () => 0.5', s.context);
  assert.equal(s.call('draw', 'b'.repeat(64)).result.prizeId, 3);
});
