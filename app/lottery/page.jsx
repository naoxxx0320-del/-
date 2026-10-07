import campaign from "../../data/lottery-campaign.json";
import prizes from "../../data/lottery-prizes.json";
import config from "../../data/lottery-public-config.json";
import { participationUrl } from "./participation.mjs";
import styles from "./production.module.css";

const url = participationUrl(config);
export const metadata = {
  title: url ? "宝石の抽選" : "宝石の抽選｜準備中",
  description: "宝石を選んで、その場で結果が分かるAROMA DAIAMONDの抽選キャンペーン。",
  robots: { index: false, follow: false }, alternates: { canonical: null },
};
export default function LotteryPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.brand}>AROMA DAIAMOND</p>
        <p className={styles.badge}>{url ? "宝石の抽選キャンペーン" : "抽選の受付準備中"}</p>
        <h1>運命の宝石を、ひとつ。</h1>
        <p className={styles.lead}>{url ? "参加ページで宝石を選ぶと、その場で結果が分かります。LINEログインは不要です。" : "ただいま抽選の受付を準備しています。受付開始後、このページから参加できます。"}</p>
        <ul className={styles.prizes}>{prizes.map((prize) => <li key={prize.id}><b>{prize.rank}</b><span>{prize.label}</span></li>)}</ul>
        {url ? <a className={styles.primary} href={url}>宝石を選んで抽選する ↗</a> : <p className={styles.wait} role="status">受付開始までお待ちください</p>}
        <section className={styles.terms} aria-label="キャンペーンの条件">
          <p>開催期限：{campaign.deadlineLabel}<br />特典の有効期限：{campaign.benefitExpiryLabel}</p>
          <p>1等は0.1％（1,000分の1）、最大3名。2〜4等は各33.3％、人数上限なし。ハズレなしです。1等が3名に達した後は、2〜4等を各3分の1で抽選します。</p>
          <p>同じブラウザーでの抽選は1回です。別の端末・ブラウザーや保存データの削除による再参加は防げないため、1人1回を保証する方式ではありません。</p>
        </section>
        <a className={styles.back} href="../">サイトトップへ戻る</a>
      </div>
    </main>
  );
}
