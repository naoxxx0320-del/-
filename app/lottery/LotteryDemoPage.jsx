import LotteryGame from "./LotteryGame";
import styles from "./lottery.module.css";
import { SITE } from "../_lib/site";
import prizes from "../../data/lottery-prizes.json";
import campaign from "../../data/lottery-campaign.json";

export const metadata = {
  title: "宝石の抽選ゲーム｜体験版",
  description: "AROMA DAIAMONDの宝石を選ぶ抽選ゲーム体験版。実際の応募・当選は発生しません。",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function LotteryPage() {
  return (
    <main className={styles.page}>
      <div className={styles.demoBanner}>
        <span>体験版</span> 実際の応募・当選にはなりません
      </div>
      <header className={styles.header}>
        <a href="../" aria-label="AROMA DAIAMOND トップへ">
          <span className={styles.brandMark} aria-hidden="true">◇</span>
          <span>{SITE.name}<small>{SITE.area} · PRIVATE SALON</small></span>
        </a>
        <span className={styles.headerTag}>SPECIAL EXPERIENCE</span>
      </header>
      <div className={styles.layout}>
        <section className={styles.intro} aria-labelledby="campaign-title">
          <p className={styles.eyebrow}>A LITTLE LUCK. A LUXURIOUS MOMENT.</p>
          <h1 id="campaign-title">あなたの運命を、<br />ひとつの宝石に。</h1>
          <p className={styles.lead}>きらめく宝石を選んで、特別なひとときへ。<br />結果は、その場で。</p>
          <div className={styles.prize}>
            <p>CAMPAIGN PLAN</p>
            <div>1等は最大 <strong>3</strong> 名様に</div>
            <h2>施術90分無料</h2>
            <ul className={styles.prizeList}>{prizes.map((item) => <li key={item.id}><b>{item.rank}</b><span>{item.label}</span></li>)}</ul>
            <small>開催期限：{campaign.deadlineLabel}<br />特典の有効期限：{campaign.benefitExpiryLabel}</small>
            <small>本番の確率：1等0.1％、2〜4等は各33.3％。ハズレなし。<br />1等は最大3名。上限到達後は2〜4等を各3分の1で抽選します。<br />2〜4等の人数上限はありません。必ず3名が1等に当選するものではありません。</small>
            <small>開催予定のキャンペーンです。現在はゲームの体験版です。</small>
          </div>
          <a className={styles.jumpLink} href="#jewel-game">宝石を選んで体験する <span aria-hidden="true">↓</span></a>
          <ol className={styles.steps} aria-label="正式開催時の参加の流れ">
            <li><span>01</span><div><b>届いた参加URLを開く</b><small>スマホのブラウザーから参加</small></div></li>
            <li><span>02</span><div><b>好きな宝石をひとつ選ぶ</b><small>直感で、あなたらしいひとつを</small></div></li>
            <li><span>03</span><div><b>その場で結果をチェック</b><small>光の先に、特別なひととき</small></div></li>
          </ol>
        </section>
        <LotteryGame />
      </div>
      <section className={styles.notes} aria-label="体験版について">
        <p>ABOUT THIS EXPERIENCE</p>
        <h2>今は、ゲームだけをお楽しみください。</h2>
        <div>
          <p>体験版はURLを開くだけで遊べます。表示される結果に施術無料の権利はなく、当選枠も消費しません。</p>
          <p>表示される体験版のランダム演出は、本番の当選確率とは異なります。対象コース・予約時の利用条件は、開催前にご案内します。</p>
        </div>
      </section>
      <footer className={styles.footer}><a href="../">サイトトップへ戻る ↗</a><span>{SITE.name}</span></footer>
    </main>
  );
}
