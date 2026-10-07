"use client";

import { useEffect, useRef, useState } from "react";
import links from "../../data/links.json";
import prizeCatalog from "../../data/lottery-prizes.json";
import campaign from "../../data/lottery-campaign.json";
import styles from "./lottery.module.css";
const prizes = prizeCatalog.filter((prize) => campaign.prizeRules.some((rule) => rule.id === prize.id && rule.probability > 0));

const GEMS = [
  { name: "ルビー", word: "PASSION", color: "#ef8caa", dark: "#8b2447" },
  { name: "シャンパンダイヤ", word: "ELEGANCE", color: "#ffe7aa", dark: "#b28744" },
  { name: "サファイア", word: "SERENITY", color: "#b2c9f5", dark: "#4e608d" },
];

function Gem({ index = 1, large = false }) {
  const gem = GEMS[index];
  return (
    <svg className={large ? styles.largeGem : styles.gem} viewBox="0 0 120 110" fill="none" aria-hidden="true">
      <path d="M26 16h68l20 30-54 58L6 46Z" fill={gem.dark} />
      <path d="M26 16 6 46h34Z" fill={gem.color} opacity=".72" />
      <path d="m26 16 14 30 20-30Z" fill={gem.color} />
      <path d="m60 16 20 30 14-30Z" fill={gem.color} opacity=".88" />
      <path d="m94 16-14 30h34Z" fill={gem.color} opacity=".48" />
      <path d="m40 46 20-30 20 30Z" fill="#fff9ec" opacity=".85" />
      <path d="M6 46h34l20 58Z" fill={gem.color} opacity=".52" />
      <path d="M40 46h40l-20 58Z" fill={gem.color} opacity=".85" />
      <path d="M80 46h34l-54 58Z" fill={gem.dark} />
      <path d="M26 16h68l20 30-54 58L6 46Zm-20 30h108M26 16l14 30 20 58 20-58 14-30M40 46l20-30 20 30" stroke="#fff3d4" strokeWidth="1" opacity=".75" />
      <path d="M26 7v18m-9-9h18" stroke="white" strokeWidth="2" />
    </svg>
  );
}

export default function LotteryGame() {
  const [selected, setSelected] = useState(null);
  const [phase, setPhase] = useState("choose");
  const [result, setResult] = useState(null);
  const [demoOutcome, setDemoOutcome] = useState("random");
  const timer = useRef(null);
  const drawing = useRef(false);
  const resultHeading = useRef(null);
  const firstGem = useRef(null);
  const prize = prizes.find((item) => result === `prize_${item.id}`);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (phase === "result") resultHeading.current?.focus();
  }, [phase]);

  const draw = () => {
    if (selected === null || phase !== "choose" || drawing.current) return;
    drawing.current = true;
    setPhase("drawing");
    // Demo only: never issues a prize, verifies LINE, or consumes a winner slot.
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    const outcomes = [...prizes.map((item) => `prize_${item.id}`), "lose"];
    const outcome = demoOutcome === "random" ? outcomes[value[0] % outcomes.length] : demoOutcome;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => {
      setResult(outcome);
      setPhase("result");
      drawing.current = false;
    }, reduce ? 100 : 2200);
  };

  const reset = () => {
    clearTimeout(timer.current);
    drawing.current = false;
    setSelected(null);
    setResult(null);
    setPhase("choose");
    requestAnimationFrame(() => firstGem.current?.focus());
  };

  return (
    <section id="jewel-game" className={styles.game} aria-label="宝石の抽選ゲーム体験版" aria-busy={phase === "drawing"}>
      <div className={styles.gameTop}><span>THE JEWEL DRAW</span><span className={styles.demoPill}>DEMO</span></div>
      <div className={styles.gameInner}>
        {phase === "choose" ? (
          <>
            <div className={styles.orbit} aria-hidden="true"><Gem index={selected ?? 1} large /><span className={styles.sparkOne}>✦</span><span className={styles.sparkTwo}>✧</span></div>
            <p className={styles.gameEyebrow}>CHOOSE YOUR JEWEL</p>
            <h2>心が惹かれる宝石を、ひとつ。</h2>
            <p className={styles.gameLead}>あなたの直感で選んでください。</p>
            <div className={styles.gemChoices} role="group" aria-label="宝石をひとつ選ぶ">
              {GEMS.map((gem, i) => (
                <button key={gem.name} ref={i === 0 ? firstGem : undefined} type="button" className={`${styles.gemChoice} ${selected === i ? styles.selected : ""}`} aria-pressed={selected === i} onClick={() => setSelected(i)}>
                  <span className={styles.selectionMark} aria-hidden="true">{selected === i ? "✓" : "◇"}</span>
                  <Gem index={i} /><b>{gem.name}</b><small>{gem.word}</small>
                </button>
              ))}
            </div>
            <p className={styles.selectionText} role="status">{selected === null ? "宝石を選ぶと、抽選を始められます。" : `${GEMS[selected].name}を選択しました。`}</p>
            <button type="button" className={styles.drawButton} disabled={selected === null} onClick={draw}>この宝石で抽選を体験する <span aria-hidden="true">↗</span></button>
            <p className={styles.gameFootnote}>体験版は何度でも遊べます。実際の応募にはなりません。</p>
          </>
        ) : phase === "drawing" ? (
          <div className={styles.drawing}>
            <div className={`${styles.orbit} ${styles.drawingOrbit}`} aria-hidden="true"><Gem index={selected} large /><span className={styles.sparkOne}>✦</span><span className={styles.sparkTwo}>✧</span></div>
            <p className={styles.gameEyebrow}>A MOMENT OF MAGIC</p>
            <h2>宝石が、きらめきを集めています。</h2>
            <p role="status">抽選演出中です。まもなく結果が表示されます。</p>
            <div className={styles.loadingDots} aria-hidden="true"><span /><span /><span /></div>
          </div>
        ) : (
          <div className={`${styles.result} ${prize ? styles.win : ""}`}>
            <div className={styles.resultArt} aria-hidden="true"><Gem index={selected} large />{prize && Array.from({ length: 12 }, (_, i) => <span key={i} style={{ "--angle": `${i * 30}deg`, "--delay": `${i * 35}ms` }}>✦</span>)}</div>
            <p className={styles.gameEyebrow}>{prize ? `DEMO · ${prize.rank}` : "DEMO · TRY AGAIN"}</p>
            <h2 ref={resultHeading} tabIndex={-1}>{prize ? `${prize.rank}の当選演出です！` : "今回は、落選の演出です。"}</h2>
            {prize && <p className={styles.resultPrize}>{prize.label}</p>}
            {prize && <aside className={styles.screenshot} aria-label="当選結果の保存"><strong>当選した結果は<br />スクリーンショットを<br />撮ってください。</strong></aside>}
            <p className={styles.resultMessage}>{prize ? "宝石が、特別なきらめきを届けました。" : "選んでいただき、ありがとうございます。もう一度、別の宝石でもお楽しみください。"}</p>
            <div className={styles.resultNotice}><b>これは体験版の結果です</b><p>無料特典の権利やクーポンは発行されません。<br />実際の当選者としては登録されません。</p></div>
            <button type="button" className={styles.drawButton} onClick={reset}>もう一度体験する <span aria-hidden="true">↻</span></button>
            <a className={styles.lineLink} href={links.line} target="_blank" rel="noopener noreferrer">公式LINEを見る ↗</a>
            <p className={styles.gameFootnote}>LINEを開いても、この体験結果は送信されません。</p>
          </div>
        )}
      </div>
      <details className={styles.demoTools}>
        <summary>体験版の演出を選ぶ</summary>
        <label htmlFor="demo-outcome">次の抽選で表示する演出</label>
        <select id="demo-outcome" value={demoOutcome} disabled={phase === "drawing"} onChange={(e) => setDemoOutcome(e.target.value)}>
          <option value="random">ランダム</option>{prizes.map((item) => <option key={item.id} value={`prize_${item.id}`}>{item.rank}：{item.label}</option>)}<option value="lose">落選の演出</option>
        </select>
        <p>見た目の確認用です。賞品や当選枠には影響しません。</p>
      </details>
      <noscript><p className={styles.noScript}>ゲームを体験するにはJavaScriptを有効にしてください。</p></noscript>
    </section>
  );
}
