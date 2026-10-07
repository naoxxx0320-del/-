const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const install = fs.readFileSync(path.join(__dirname, '../apps-script/lottery-install.gs'), 'utf8');
const expected = JSON.parse(fs.readFileSync(path.join(__dirname, '../apps-script/lottery-properties.example.json'), 'utf8'));

function setup(options = {}) {
  const properties = { unrelated: 'keep', ...options.properties };
  const rows = options.rows || [];
  const beforeRows = JSON.stringify(rows);
  let held = false, writes = 0, alerts = 0, reads = 0;
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties[key] || null,
      setProperties(next, deleteOthers) {
        assert.equal(held, true); assert.equal(deleteOthers, false);
        Object.assign(properties, next); writes++;
      },
    }) },
    LockService: { getScriptLock: () => ({
      tryLock() { held = !options.busy; return held; },
      hasLock() { return held; }, releaseLock() { held = false; },
    }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => options.unbound ? null : { getId: () => 'dedicated-sheet' },
      getUi: () => ({
        Button: { OK: 'ok' }, ButtonSet: { OK_CANCEL: 'ok-cancel' },
        prompt: () => ({ getSelectedButton: () => options.cancel ? 'cancel' : 'ok', getResponseText: () => options.channelId || '123456' }),
        alert: () => alerts++,
      }),
      openById(id) {
        assert.equal(id, 'dedicated-sheet'); assert.equal(held, true); reads++;
        return { getSheetByName: () => ({ getDataRange: () => ({
          getValues: () => [options.damaged ? ['wrong-header'] : Array.from(context.LOTTERY_HEADERS), ...rows],
        }) }) };
      },
      flush() { assert.equal(held, true); if (options.failFlush) throw new Error('write failure'); },
    },
  });
  vm.runInContext(install, context);
  return { run: () => context.setupLottery(), properties, rows, beforeRows, stats: () => ({ held, writes, alerts, reads }) };
}

test('setup saves current conditions while retaining the existing ledger and unrelated settings', () => {
  const s = setup({ rows: [['aroma-20261006', 'existing-account', 'prize_1', 0, 'saved-date', 'saved-id']] });
  s.run();
  assert.deepEqual(s.properties, { unrelated: 'keep', ...expected, LINE_LOGIN_CHANNEL_ID: '123456', LOTTERY_SHEET_ID: 'dedicated-sheet' });
  assert.equal(JSON.stringify(s.rows), s.beforeRows);
  s.run();
  assert.equal(JSON.stringify(s.rows), s.beforeRows);
  assert.deepEqual(s.stats(), { held: false, writes: 2, alerts: 2, reads: 2 });
});

test('setup refuses to change an existing campaign, LINE channel, or sheet', () => {
  for (const properties of [{ LOTTERY_CAMPAIGN_ID: 'other' }, { LINE_LOGIN_CHANNEL_ID: '999999' }, { LOTTERY_SHEET_ID: 'other-sheet' }]) {
    const s = setup({ properties });
    const before = JSON.stringify(s.properties);
    assert.throws(s.run, /既存の接続設定/);
    assert.equal(JSON.stringify(s.properties), before);
    assert.deepEqual(s.stats(), { held: false, writes: 0, alerts: 0, reads: 0 });
  }
});

test('cancel, invalid input, unavailable lock, damaged sheet, and flush failure cannot save settings', () => {
  for (const options of [{ cancel: true }, { channelId: 'not-a-channel' }, { unbound: true }, { busy: true }, { damaged: true }, { failFlush: true }]) {
    const s = setup(options);
    if (options.cancel) s.run(); else assert.throws(s.run);
    assert.equal(s.stats().writes, 0);
    assert.equal(s.stats().held, false);
    assert.deepEqual(s.properties, { unrelated: 'keep' });
  }
});
