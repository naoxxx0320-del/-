import campaign from "../../data/lottery-campaign.json";
import prizes from "../../data/lottery-prizes.json";
import config from "../../data/lottery-public-config.json";
import { participationUrl } from "./participation.mjs";
import styles from "./production.module.css";

const url = participationUrl(config);
const activePrizes = prizes.filter((prize) => campaign.prizeRules.some((rule) => rule.id === prize.id && rule.probability > 0));
export const metadata = {
  title: url ? "宝石の抽選" : "宝石の抽選｜準備中",
  description: "宝石を選んで、その場で結果が分かるAROMA DIAMONDの抽選キャンペーン。",
  robots: { index: false, follow: false }, alternates: { canonical: null },
};
export default function LotteryPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.brand}>AROMA DIAMOND</p>
        <p className={styles.badge}>{url ? "宝石の抽選キャンペーン" : "抽選の受付準備中"}</p>
        <h1>運命の宝石を、ひとつ。</h1>
        <p className={styles.lead}>{url ? "参加ページで宝石を選ぶと、その場で結果が分かります。LINEログインは不要です。" : "ただいま抽選の受付を準備しています。受付開始後、このページから参加できます。"}</p>
        <ul className={styles.prizes}>{activePrizes.map((prize) => <li key={prize.id}><b>{prize.rank}</b><span>{prize.label}</span></li>)}</ul>
        {url ? <a className={styles.primary} href={url}>宝石を選んで抽選する ↗</a> : <p className={styles.wait} role="status">受付開始までお待ちください</p>}
        <aside className={styles.screenshot} aria-label="当選結果の保存"><strong>当選した結果は<br />スクリーンショットを<br />撮ってください。</strong></aside>
        <a className={styles.back} href="../">サイトトップへ戻る</a>
      </div>
    </main>
  );
}
