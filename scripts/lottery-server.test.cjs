const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../apps-script/lottery.gs'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/lottery-prizes.json'), 'utf8'));
const campaign = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/lottery-campaign.json'), 'utf8'));
const campaignProperties = JSON.parse(fs.readFileSync(path.join(__dirname, '../apps-script/lottery-properties.example.json'), 'utf8'));
function prizeRules(probabilities = [1, 0, 0, 0], caps = [3, null, null, null]) {
  return JSON.stringify(probabilities.map((probability, i) => ({ id: i + 1, probability, maxWinners: caps[i] })));
}

function server(options = {}) {
  const rows = options.rows || [];
  const properties = {
    LOTTERY_CAMPAIGN_ID: 'test-campaign', LINE_LOGIN_CHANNEL_ID: '123456', LOTTERY_SHEET_ID: 'test-only-sheet',
    LOTTERY_STARTS_AT: '2025-01-01T00:00:00+09:00', LOTTERY_ENDS_AT: '2100-01-01T00:00:00+09:00',
    LOTTERY_PRIZE_RULES: prizeRules(), ...options.properties,
  };
  let held = false, nextId = 0, failFlush = Boolean(options.failFlush);
  const calls = [];
  const lock = {
    tryLock() { calls.push('lock'); held = !options.busy; return held; },
    hasLock() { return held; },
    releaseLock() { assert.equal(held, true); calls.push('unlock'); held = false; },
  };
  const sheet = {
    getDataRange() { assert.ok(held); return { getValues: () => [context.LOTTERY_HEADERS.slice(), ...rows.map(r => r.slice())] }; },
    appendRow(row) { assert.ok(held); calls.push('write'); rows.push(Array.from(row)); },
  };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] ?? null }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => lock },
    SpreadsheetApp: {
      openById() { assert.ok(held); return { getSheetByName: () => sheet }; },
      flush() { assert.ok(held); calls.push('flush'); if (failFlush) { failFlush = false; throw new Error('simulated response failure'); } },
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_alg, value) => [...crypto.createHash('sha256').update(value).digest()],
      getUuid: () => 'test-draw-' + (++nextId),
    },
    UrlFetchApp: {
      fetch(url, input = {}) {
        assert.equal(held, false, 'verify LINE identity before taking the write lock');
        let data, ok = true;
        const token = input.payload?.id_token || new URL(url).searchParams.get('access_token') || input.headers?.Authorization?.slice(7);
        const who = token === 'token-B' ? 'b' : token === 'token-C' ? 'c' : token === 'token-D' ? 'd' : 'a';
        if (token === 'invalid') ok = false;
        if (url.endsWith('/verify') && input.method === 'post') {
          data = { sub: 'U' + who.repeat(32), aud: options.wrongAudience ? 'wrong' : '123456', iss: 'https://access.line.me', exp: options.expired ? 0 : Math.floor(Date.now()/1000) + 3600 };
        } else if (url.includes('/verify?')) data = { client_id: '123456', expires_in: 3600 };
        else if (url.endsWith('/profile')) data = { userId: 'U' + (options.mismatch ? 'f' : who).repeat(32) };
        else if (url.endsWith('/status')) data = { friendFlag: options.friend !== false };
        else throw new Error('Unexpected LINE endpoint');
        return { getResponseCode: () => ok ? 200 : 401, getContentText: () => JSON.stringify(data) };
      },
    },
  });
  vm.runInContext(source, context);
  function call(action = 'draw', token = 'token-A', extra = {}) {
    const request = { action, campaignId: 'test-campaign', gemIndex: '1', idToken: token, accessToken: token, ...extra };
    const result = JSON.parse(context.doPost({ parameter: request }).text);
    assert.equal(held, false, 'always release acquired lock');
    return result;
  }
  return { call, rows, calls, context };
}

test('same verified account gets one persisted result, including from a fresh server context', () => {
  const first = server();
  const original = first.call();
  assert.equal(original.ok, true); assert.equal(original.repeated, false);
  const again = first.call('draw', 'token-A', { gemIndex: '2', userId: 'forged-client-id' });
  assert.equal(again.repeated, true); assert.deepEqual(again.result, original.result);
  const otherDevice = server({ rows: first.rows });
  assert.deepEqual(otherDevice.call('status').result, original.result);
  assert.equal(first.rows.length, 1);
});

test('all writes and flush happen inside the lock; repeated calls do not write', () => {
  const s = server(); s.call(); s.call();
  assert.deepEqual(s.calls, ['lock', 'write', 'flush', 'unlock', 'lock', 'unlock']);
});

test('three winners is the absolute cap and existing winners can still retrieve their results', () => {
  const s = server();
  for (const token of ['token-A', 'token-B', 'token-C']) assert.equal(s.call('draw', token).result.outcome, 'win');
  assert.equal(s.call('draw', 'token-D').error, 'SOLD_OUT');
  assert.equal(s.rows.length, 3);
  assert.equal(s.call('status', 'token-A').repeated, true);
});

test('a losing result is just as permanent as a winning result', () => {
  const s = server({ properties: { LOTTERY_PRIZE_RULES: prizeRules([0.000000000001, 0, 0, 0]) } });
  // Force a losing server random value, without changing production probability defaults.
  vm.runInContext('Math.random = function () { return 0.9; };', s.context);
  const first = s.call(); assert.equal(first.result.outcome, 'lose');
  assert.deepEqual(s.call().result, first.result); assert.equal(s.rows.length, 1);
});

test('status does not consume an entry or select an outcome', () => {
  const s = server(); assert.deepEqual(s.call('status'), { ok: true, eligible: true }); assert.equal(s.rows.length, 0);
});

test('invalid tokens, expired tokens, wrong audience, or mismatched token users cannot draw', () => {
  for (const options of [{}, { expired: true }, { wrongAudience: true }, { mismatch: true }]) {
    const s = server(options);
    assert.equal(s.call('draw', Object.keys(options).length ? 'token-A' : 'invalid').error, 'LINE_AUTH_FAILED');
    assert.equal(s.rows.length, 0); assert.equal(s.calls.length, 0);
  }
});

test('friendship is verified on the server, not accepted from a request flag', () => {
  const s = server({ friend: false });
  assert.equal(s.call('draw', 'token-A', { friendFlag: 'true' }).error, 'FRIEND_REQUIRED'); assert.equal(s.rows.length, 0);
});

test('existing results survive campaign end or later unfriend', () => {
  const s = server(); const first = s.call();
  const ended = server({ rows: s.rows, friend: false, properties: { LOTTERY_ENDS_AT: '2025-02-01T00:00:00+09:00' } });
  assert.deepEqual(ended.call().result, first.result);
});

test('before start, after end, invalid campaign and invalid selection are rejected without saving', () => {
  assert.equal(server({ properties: { LOTTERY_STARTS_AT: '2099-01-01T00:00:00+09:00' } }).call().error, 'NOT_STARTED');
  assert.equal(server({ properties: { LOTTERY_ENDS_AT: '2025-02-01T00:00:00+09:00' } }).call().error, 'ENDED');
  const s = server();
  assert.equal(s.call('draw', 'token-A', { campaignId: 'different' }).error, 'INVALID_REQUEST');
  assert.equal(s.call('draw', 'token-A', { gemIndex: '' }).error, 'INVALID_REQUEST');
  assert.equal(s.call('draw', 'token-A', { gemIndex: '7' }).error, 'INVALID_REQUEST'); assert.equal(s.rows.length, 0);
});

test('busy lock and missing server settings fail closed', () => {
  const busy = server({ busy: true }); assert.equal(busy.call().error, 'BUSY'); assert.equal(busy.rows.length, 0);
  const missing = server({ properties: { LOTTERY_PRIZE_RULES: null } }); assert.equal(missing.call().error, 'NOT_CONFIGURED'); assert.equal(missing.rows.length, 0);
});

test('a response failure after a saved draw does not cause a second draw on retry', () => {
  const s = server({ failFlush: true }); assert.equal(s.call().error, 'SERVER_ERROR'); assert.equal(s.rows.length, 1);
  const retry = s.call(); assert.equal(retry.ok, true); assert.equal(retry.repeated, true); assert.equal(s.rows.length, 1);
});

test('damaged or duplicate rows fail closed rather than creating additional draws', () => {
  const s = server(); s.call(); s.rows.push(s.rows[0].slice());
  assert.equal(s.call('draw', 'token-B').error, 'DATA_ERROR'); assert.equal(s.rows.length, 2);
});

test('all four prizes are drawn, named and permanently stored correctly', () => {
  for (const [sample, rank] of [[0.05, 1], [0.2, 2], [0.4, 3], [0.65, 4], [0.9, null]]) {
    const s = server({ properties: { LOTTERY_PRIZE_RULES: prizeRules([0.1, 0.2, 0.3, 0.1]) } });
    vm.runInContext(`Math.random = function () { return ${sample}; };`, s.context);
    const first = s.call('draw', 'token-A', { prizeId: '4' });
    assert.equal(first.result.prizeId, rank);
    assert.equal(first.result.prizeLabel, rank ? catalog[rank - 1].label : null);
    assert.equal(s.rows[0][2], rank ? `prize_${rank}` : 'lose');
    assert.deepEqual(s.call().result, first.result);
  }
});

test('rank 1 remains capped at three while other configured prizes remain available', () => {
  const s = server({ properties: { LOTTERY_PRIZE_RULES: prizeRules([0.5, 0.5, 0, 0]) } });
  vm.runInContext('Math.random = function () { return 0; };', s.context);
  for (const token of ['token-A', 'token-B', 'token-C']) assert.equal(s.call('draw', token).result.prizeId, 1);
  assert.equal(s.call('draw', 'token-D').result.prizeId, 2);
  assert.equal(s.rows.filter(r => r[2] === 'prize_1').length, 3);
});

test('exhausting a lower prize does not increase the other prize probabilities', () => {
  const s = server({ properties: { LOTTERY_PRIZE_RULES: prizeRules([0.1, 0.9, 0, 0], [3, 1, null, null]) } });
  vm.runInContext('Math.random = function () { return 0.5; };', s.context);
  assert.equal(s.call('draw', 'token-A').result.prizeId, 2);
  assert.equal(s.call('draw', 'token-B').result.outcome, 'lose');
  assert.equal(s.rows.filter(r => r[2] === 'prize_2').length, 1);
});

test('old unranked winners keep their saved entry and count toward the rank 1 limit', () => {
  const s = server(); s.call(); s.rows[0][2] = 'win';
  assert.equal(s.call().result.prizeId, 1); assert.equal(s.rows.length, 1);
  s.call('draw', 'token-B'); s.call('draw', 'token-C');
  assert.equal(s.call('draw', 'token-D').error, 'SOLD_OUT');
});

test('incomplete, invalid, or excessive prize rules cannot enable the campaign', () => {
  const variants = [null, '[]', '{', '[null,null,null,null]', prizeRules([0.5, 0.5, 0.5, 0]), prizeRules([1, 0, 0, 0], [4, null, null, null]), prizeRules([1, 0, 0, 0], [3, undefined, null, null]), prizeRules([0, 0, 0, 0])];
  for (const raw of variants) {
    const s = server({ properties: { LOTTERY_PRIZE_RULES: raw } });
    assert.equal(s.call().error, 'NOT_CONFIGURED'); assert.equal(s.rows.length, 0);
  }
});

test('server prize catalog matches the specified prize labels', () => {
  const s = server();
  assert.deepEqual(JSON.parse(JSON.stringify(s.context.LOTTERY_PRIZES)), catalog);
});

function campaignServer(extra = {}) {
  return server({ properties: { ...campaignProperties, LINE_LOGIN_CHANNEL_ID: '123456', LOTTERY_SHEET_ID: 'test-only-sheet', ...extra } });
}
function campaignDecision(s, sample, now = Date.parse(campaign.startsAt), rows = []) {
  return s.context.lotteryDecide_(
    { action: 'draw', campaignId: campaign.campaignId, gemIndex: '0' }, rows,
    s.context.lotteryConfig_(), { accountKey: 'd'.repeat(64), friend: true }, now,
    () => sample, () => 'test-campaign-result'
  );
}

test('configured campaign gives first prize one interval in 1000 and equally divides the rest', () => {
  const s = campaignServer();
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < 1000; i++) {
    const decision = campaignDecision(s, (i + 0.5) / 1000);
    assert.equal(decision.response.ok, true);
    assert.equal(decision.response.result.outcome, 'win');
    counts[decision.response.result.prizeId - 1]++;
  }
  assert.deepEqual(counts, [1, 333, 333, 333]);
  assert.equal(campaignDecision(s, 0.000999999).response.result.prizeId, 1);
  assert.equal(campaignDecision(s, 0.001).response.result.prizeId, 2);
});

test('after three first prizes, every remaining interval is divided equally among lower prizes', () => {
  const s = campaignServer();
  const rows = ['a', 'b', 'c'].map((key) => [campaign.campaignId, key.repeat(64), 'prize_1', 0, campaign.startsAt, 'winner-' + key]);
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < 300; i++) {
    const decision = campaignDecision(s, (i + 0.5) / 300, Date.parse(campaign.startsAt), rows);
    assert.equal(decision.response.result.outcome, 'win');
    counts[decision.response.result.prizeId - 1]++;
  }
  assert.deepEqual(counts, [0, 100, 100, 100]);
  assert.equal(campaignDecision(s, 1 - Number.EPSILON, Date.parse(campaign.startsAt), rows).response.result.prizeId, 4);
});

test('November 30 Japan deadline accepts the last millisecond and preserves results indefinitely', () => {
  const s = campaignServer();
  const end = Date.parse(campaign.endsAt);
  assert.equal(end, Date.parse('2026-11-30T15:00:00Z'));
  const last = campaignDecision(s, 0.5, end - 1);
  assert.equal(last.response.ok, true);
  assert.equal(campaignDecision(s, 0.5, end).response.error, 'ENDED');
  const saved = campaignDecision(s, 0, Date.parse('2126-10-07T00:00:00+09:00'), [last.row]);
  assert.equal(saved.response.repeated, true);
  assert.deepEqual(saved.response.result, last.response.result);
  assert.equal(campaign.benefitExpiresAt, null);
});

test('no-losing policy rejects capped lower prizes or unequal lower probabilities', () => {
  for (const rules of [prizeRules([0.001, 0.333, 0.333, 0.333], [3, 1, null, null]), prizeRules([0.001, 0.2, 0.2, 0.2])]) {
    const s = campaignServer({ LOTTERY_PRIZE_RULES: rules });
    assert.throws(() => s.context.lotteryConfig_(), /NOT_CONFIGURED/);
  }
  assert.deepEqual(JSON.parse(campaignProperties.LOTTERY_PRIZE_RULES), campaign.prizeRules);
  assert.equal(campaignProperties.LOTTERY_ENDS_AT, campaign.endsAt);
  assert.equal(campaignProperties.LOTTERY_CAMPAIGN_ID, campaign.campaignId);
});
