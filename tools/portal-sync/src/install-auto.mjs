#!/usr/bin/env node
// 自動実行の設定（Mac の launchd）。Mac を使っているユーザーとして動く（管理者の権限は使わない）。
//   node src/install-auto.mjs install    … 2つを登録して開始する
//   node src/install-auto.mjs uninstall  … 止めて登録を外す
//   node src/install-auto.mjs status     … 登録されているかを表示
// 登録するもの（~/Library/LaunchAgents）：
//   ・jp.aromadiamond.portal-browser：作業用ブラウザを開いたままにする（閉じたら開き直す）。caffeinate で Mac のスリープを止める
//     （-i：操作がないときのスリープ、-s：電源アダプタ接続中のスリープ。バッテリーでふたを閉じたときのスリープは止められない）
//   ・jp.aromadiamond.portal-auto   ：1時間ごと（毎時7分）に src/auto.mjs を実行する
// 記録：tools/portal-sync/out/launchd-*.log
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(HERE, "out");
const AGENTS = join(homedir(), "Library", "LaunchAgents");
const NODE = process.execPath;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const JOBS = {
  "jp.aromadiamond.portal-browser": {
    args: ["/usr/bin/caffeinate", "-i", "-s", NODE, join(HERE, "src", "browser.mjs")],
    extra: "<key>RunAtLoad</key><true/>\n  <key>KeepAlive</key><true/>\n  <key>ThrottleInterval</key><integer>60</integer>",
  },
  "jp.aromadiamond.portal-auto": {
    args: [NODE, join(HERE, "src", "auto.mjs")],
    extra: "<key>StartCalendarInterval</key><dict><key>Minute</key><integer>7</integer></dict>",
  },
};
function plist(label, job) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
${job.args.map((a) => `    <string>${esc(a)}</string>`).join("\n")}
  </array>
  <key>WorkingDirectory</key><string>${esc(HERE)}</string>
  <key>StandardOutPath</key><string>${esc(join(OUT, `launchd-${label.split(".").pop()}.log`))}</string>
  <key>StandardErrorPath</key><string>${esc(join(OUT, `launchd-${label.split(".").pop()}.log`))}</string>
  ${job.extra}
</dict>
</plist>
`;
}
const lc = (...a) => spawnSync("/bin/launchctl", a, { encoding: "utf8" });
const uid = String(process.getuid());

const cmd = process.argv[2] || "status";
if (process.platform !== "darwin") throw new Error("Mac でだけ使えます");
if (cmd === "install") {
  mkdirSync(AGENTS, { recursive: true }); mkdirSync(OUT, { recursive: true, mode: 0o700 });
  for (const [label, job] of Object.entries(JOBS)) {
    const file = join(AGENTS, `${label}.plist`);
    lc("bootout", `gui/${uid}/${label}`);
    writeFileSync(file, plist(label, job));
    const r = lc("bootstrap", `gui/${uid}`, file);
    console.log(`${label}：${r.status === 0 ? "登録して開始しました" : "登録できませんでした " + (r.stderr || "").trim()}`);
  }
} else if (cmd === "uninstall") {
  for (const label of Object.keys(JOBS)) {
    lc("bootout", `gui/${uid}/${label}`);
    const file = join(AGENTS, `${label}.plist`);
    if (existsSync(file)) unlinkSync(file);
    console.log(`${label}：止めて登録を外しました`);
  }
} else {
  for (const label of Object.keys(JOBS)) {
    const r = lc("print", `gui/${uid}/${label}`);
    console.log(`${label}：${r.status === 0 ? "登録あり（" + ((r.stdout.match(/state = (\w+)/) || [])[1] || "?") + "）" : "登録なし"}`);
  }
}
