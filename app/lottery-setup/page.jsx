import CopyInstall from "./CopyInstall";
import campaign from "../../data/lottery-campaign.json";
import styles from "./page.module.css";
export const metadata = { title: "URL抽選の公開設定", robots: { index: false, follow: false }, alternates: { canonical: null } };
export default function LotterySetupPage() {
  return <main className={styles.page}><div className={styles.card}>
    <p className={styles.brand}>AROMA DAIAMOND</p><p className={styles.badge}>管理者向けの公開設定</p>
    <h1>URL抽選を公開する</h1>
    <p className={styles.lead}>LINE設定は不要です。Googleに専用の抽選台帳とページを作ると、参加者に送れるURLが発行されます。</p>
    <p className={styles.notice}>このページは管理者用の手順です。参加者へは、公開・確認後の抽選URLを送ってください。</p>
    <ol className={styles.steps}>
      <li><h2>新しい専用シートを作成</h2><p><a href="https://sheets.google.com/create" target="_blank" rel="noopener noreferrer">Googleスプレッドシートを新規作成 ↗</a>し、名前を「AROMA DAIAMOND URL抽選台帳」にします。共有は非公開のままです。</p></li>
      <li><h2>コードを貼り付ける</h2><p>シートの「拡張機能 → Apps Script」を開き、最初のコードを削除して、下の設定用コードを全て貼り付けて保存します。既存の予約管理用プロジェクトは使いません。</p><CopyInstall /></li>
      <li><h2>台帳を初期設定</h2><p>実行する関数に <code>setupUrlLottery</code> を選び、実行します。自分で作成したスクリプトへのGoogleの権限許可を確認すると、台帳が設定されます。</p></li>
      <li><h2>ウェブアプリとして公開</h2><p>「デプロイ → 新しいデプロイ → ウェブアプリ」を選びます。実行ユーザーは「自分」、アクセスできるユーザーは「全員」（ログイン不要の設定）にします。</p><p>発行された、末尾が <code>/exec</code> のURLが抽選ページです。</p></li>
      <li><h2>接続を確認</h2><p>発行されたURLをCodexに伝えてください。受付開始前の接続確認は、別のテスト用キャンペーン・台帳で行い、本番の当選枠を消費しないようにします。</p></li>
    </ol>
    <section className={styles.conditions}><h2>設定済みの条件</h2><p>開催期限：{campaign.deadlineLabel}<br />特典の有効期限：{campaign.benefitExpiryLabel}</p><p>1等0.1％・最大3名。2〜4等各33.3％・人数上限なし。1等枠終了後は下位各3分の1。同じブラウザーで1回ですが、別端末等の再参加は防げません。</p></section>
    <a className={styles.back} href="../lottery/">参加者向けページを確認する ↗</a>
  </div></main>;
}
