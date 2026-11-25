# ポータル一括更新ツール（作成中）

指示書：docs/portal-sync-spec.md　調査結果：docs/portal-sync/

今できること：
- `check`（フェーズ1）：出勤スプレッドシートを、サイトと同じ方法で読み込み、入力の誤りを点検し、駅ちかに入れる予定の内容を一覧にする。ポータルには接続しない。
- `diff ekichika`（フェーズ2）：駅ちかの今の出勤を読み取り、変更点（入れる／時間を変える／取り消す）を番号つきで一覧にする。**読むだけで書き込まない。**
- `apply ekichika`（フェーズ2）：diff の一覧のうち承認したものだけを書き込み、保存後に読み直して一致を確かめる。出勤の取り消しは、番号を `--remove 3,4` のように個別に指定したものだけ実行する。

## Mac での準備（1回だけ）
すでに用意済みのもの：デスクトップの「portal-sync」フォルダ、その中の Node.js（.runtime フォルダ）。

1. このリポジトリのうち、ツールに必要な部分だけを「portal-sync」フォルダの中に取り込みます（Claude が行います）。
2. `tools/portal-sync/config.example.json` を `config.local.json` という名前で写し、次の2つを入れます。
   - `scheduleCsvUrl`：出勤情報シートの公開CSVのURL
   - `therapistsCsvUrl`：本日の出勤（セラピスト）シートの公開CSVのURL
   どちらも、サイトがすでに使っているURLです。GitHub のリポジトリの「Settings → Secrets and variables → Actions → Variables」の `SCHEDULE_CSV_URL`・`THERAPISTS_CSV_URL` に入っています。
   パスワードは、このファイルにもチャットにも書きません。

## 使い方
ターミナルで：
```
cd ~/Desktop/portal-sync/repo/tools/portal-sync
~/Desktop/portal-sync/.runtime/node-v22.12.0-darwin-x64/bin/node src/cli.mjs check
```
表示されるもの：
- 点検：✖（直すまで反映しない誤り）、△（注意）
- 今日からの出勤の一覧
- 駅ちかに入れる予定の表（今日から7日分。出勤の無い日は「休」）と、入れられない出勤（見送り）とその理由

結果は `out/` フォルダにも保存されます（Git には入れません）。

## 守っていること
- 読むのは、サイトに出しているのと同じ出勤・名簿のデータだけ。予約台帳・お客様の情報は読まない。
- 実際の出勤だけを扱う（ダミーの出勤は作らない）。
- 時間はサイトと同じ規則で読む（朝6時までは前日の営業日、終了が開始より前なら翌日）。
