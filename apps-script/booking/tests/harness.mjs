/* テスト共通：模擬スプレッドシートの上で実際の lib.gs / Code.gs を動かす土台。 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const lib = readFileSync(join(here, "..", "lib.gs"), "utf8");
const code = readFileSync(join(here, "..", "Code.gs"), "utf8");

/* ---- 模擬シート ---- */
export function makeSheet(name, values) {
  const v = values.map((r) => r.slice());
  const width = () => Math.max(0, ...v.map((r) => r.length));
  const cellIn = (x) => (typeof x === "string" && x.startsWith("'") ? x.slice(1) : x); // ' は文字列指定
  return {
    v,
    getName: () => name,
    getLastRow: () => v.length,
    getLastColumn: () => width(),
    getDataRange: () => ({ getValues: () => v.map((r) => { const o = r.slice(); while (o.length < width()) o.push(""); return o; }) }),
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (v[r - 1 + i] || [])[c - 1 + j] ?? "")),
      setValues: (vals) => vals.forEach((row, i) => row.forEach((x, j) => { (v[r - 1 + i] ||= [])[c - 1 + j] = cellIn(x); })),
      getValue: () => (v[r - 1] || [])[c - 1] ?? "",
      setValue: (x) => { (v[r - 1] ||= [])[c - 1] = cellIn(x); },
    }),
    appendRow: (row) => v.push(row.map(cellIn)),
    deleteRow: (r) => v.splice(r - 1, 1),
  };
}

export function load(sheets, props = {}, extra = {}) {
  const pad = (n) => String(n).padStart(2, "0");
  const ctx = {
    console,
    Logger: { log: () => {} },
    Utilities: {
      formatDate: (d, tz, fmt) => {
        const j = new Date(d.getTime() + 9 * 3600e3);
        const Y = j.getUTCFullYear(), M = j.getUTCMonth() + 1, D = j.getUTCDate(), h = j.getUTCHours(), m = j.getUTCMinutes(), s = j.getUTCSeconds();
        return fmt.replace("yyyyMMddHHmmss", `${Y}${pad(M)}${pad(D)}${pad(h)}${pad(m)}${pad(s)}`).replace("yyyy", Y).replace("MM", pad(M)).replace("dd", pad(D)).replace("HH", pad(h)).replace("mm", pad(m)).replace("ss", pad(s)).replace(/\bM\b/, M).replace(/\bd\b/, D).replace(/\bH\b/, h);
      },
      base64Decode: (b64) => [...Buffer.from(b64, "base64")],
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString("utf8") }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ...extra,
  };
  vm.createContext(ctx);
  vm.runInContext(lib.replace(/if \(typeof module[\s\S]*$/, ""), ctx);
  vm.runInContext(code, ctx);
  const history = [];
  vm.runInContext("1", ctx);
  ctx.book_ = () => ({ getSheetByName: (n) => sheets[n] || null, getSheets: () => Object.values(sheets) });
  ctx.requireStaff_ = () => "staff@example.com";
  ctx.logHistory_ = (...a) => history.push(a);
  ctx.readLedger_ = () => ctx.__ledger || [];
  ctx.todayJst_ = () => "2026/10/7";
  ctx.__history = history;
  return ctx;
}

export const plain = (x) => JSON.parse(JSON.stringify(x)); // VMの別領域の配列を通常の配列に
