#!/usr/bin/env node
// 作業用のブラウザ（Google Chrome）を開いたままにする。各サイトへのログインは、利用者がこの画面で行う。
// 開いている間は、diff / apply がこのブラウザ（ログイン済み）を使う。終わったらウィンドウを閉じる。
//   node src/browser.mjs [最初に開くURL]
import { chromium } from "playwright";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const conf = existsSync(join(HERE, "config.local.json")) ? JSON.parse(readFileSync(join(HERE, "config.local.json"), "utf8")) : {};
const profile = resolve(conf.browserProfile || join(HERE, "..", "..", "..", ".profile")); // ログイン状態が入る。Git に入れない
mkdirSync(profile, { recursive: true, mode: 0o700 });
const port = new URL(conf.browserCdpUrl || "http://127.0.0.1:9333").port || "9333";
const ctx = await chromium.launchPersistentContext(profile, {
  channel: "chrome", headless: false, viewport: null,
  args: [`--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1"],
});
// このブラウザに別のツール（diff / apply）がつないだページでも、確認画面（confirm など）を勝手に閉じないようにする。
// Playwright は受け手のいない確認画面を自動で閉じるため、何もしない受け手を付けて、判断をツール（または利用者）に任せる。
const keepDialogs = (pg) => pg.on("dialog", () => {});
ctx.pages().forEach(keepDialogs);
ctx.on("page", keepDialogs);
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(process.argv[2] || "about:blank");
console.log("作業用ブラウザを開きました。各サイトにログインしてから diff / apply を実行してください。終わったらウィンドウを閉じます。");
ctx.on("close", () => process.exit(0));
