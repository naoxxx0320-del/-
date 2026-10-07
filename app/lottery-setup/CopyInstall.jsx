"use client";
import { useRef, useState } from "react";
import styles from "./page.module.css";
export default function CopyInstall({ copyLabel = "設定用コードをコピー" }) {
  const codeField = useRef(null);
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function load(copy) {
    if (busy) return;
    setBusy(true);
    try {
      let content = source;
      if (!content) {
        const response = await fetch("../lottery-url-install.gs.txt", { cache: "no-store" });
        if (!response.ok) throw new Error("load");
        content = await response.text();
        if (!content.includes("function setupUrlLottery()")) throw new Error("load");
        setSource(content);
      }
      if (copy) {
        try { await navigator.clipboard.writeText(content); setStatus("設定用コードをコピーしました。"); }
        catch (_) { setStatus("下のコード欄を選択してコピーしてください。"); }
      } else setStatus("コードを表示しました。全て選択してコピーできます。");
    } catch (_) { setStatus("コードを読み込めませんでした。下のダウンロードリンクをお使いください。"); }
    finally { setBusy(false); }
  }
  return <div className={styles.copy}>
    <button className={styles.primary} type="button" disabled={busy} onClick={() => load(true)}>{busy ? "読み込み中…" : copyLabel}</button>
    <button className={styles.secondary} type="button" disabled={busy} onClick={() => load(false)}>コードを表示する</button>
    <p role="status">{status}</p>
    {source && <details open><summary>設定用コード</summary><textarea ref={codeField} aria-label="Apps Scriptに貼り付ける設定用コード" readOnly value={source} onFocus={(event) => event.currentTarget.select()} /><button className={styles.secondary} type="button" onClick={() => { codeField.current.focus(); codeField.current.select(); }}>コード全文を選択</button></details>}
    <a className={styles.download} href="../lottery-url-install.gs.txt" download="lottery-url-install.gs">設定用ファイルをダウンロード ↓</a>
  </div>;
}
