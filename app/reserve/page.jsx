"use client";

import { useEffect, useMemo, useState } from "react";
import { photoSrc } from "../_components/photo";
import { SITE } from "../_lib/site";
import schedule from "../../data/schedule.json";
import roster from "../../data/roster.json";
import cfg from "../../data/reserve-config.json";

const BASE = "../"; // /reserve/ はルートから1階層下
const PROFILE = Object.fromEntries(roster.map((p) => [p.name, p]));
const yen = (n) => "¥" + Number(n).toLocaleString("ja-JP");

/* 新予約管理API（apps-script/booking）のエンドポイント。
   空（未デプロイ）なら従来エンドポイント・従来挙動のまま（＝ライブ無影響）。
   デプロイ後に data/reserve-config.json の apiV2 にその /exec URL を設定すると、
   ・空き取得は {ok,busy:[{th,s,e,st}]} 形式（epoch区間）
   ・予約作成は web_create（JSON POST・結果をJSONで確認してから完了表示）
   に切り替わる。 */
const API2 = (cfg.apiV2 || "").trim();

/* 出勤時間文字列（例 "13:00〜翌2:00"）→ 分レンジ */
function parseShift(str) {
  const m = (str || "").match(/(\d{1,2}):(\d{2})\s*[〜~\-]\s*(翌)?\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let start = +m[1] * 60 + +m[2];
  let end = +m[4] * 60 + +m[5] + (m[3] ? 1440 : 0);
  if (end <= start) end += 1440;
  return { start, end };
}
const fmtMin = (mins) => {
  const d = mins >= 1440;
  const h = Math.floor((mins % 1440) / 60);
  const mm = String(mins % 60).padStart(2, "0");
  return `${d ? "翌" : ""}${h}:${mm}`;
};
function genSlots(shift) {
  const s = shift || { start: 10 * 60, end: 29 * 60 }; // 既定 10:00〜翌5:00
  const out = [];
  for (let t = s.start; t <= s.end - 60; t += 5) out.push(fmtMin(t));
  return out;
}
/* 時刻ラベル（"13:00" / "翌2:00"）→ 分。
   Googleスプレッドシートが時刻を日付値に変換した場合
   （例 "1899-12-30T21:00:00.000Z"）にも対応。 */
function labelToMin(s) {
  s = String(s || "");
  const iso = s.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/);
  if (iso) return +iso[1] * 60 + +iso[2]; // 変換済み時刻（UTCの時:分＝表示時刻）
  const m = s.match(/(翌)?\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return +m[2] * 60 + +m[3] + (m[1] ? 1440 : 0);
}
/* コース名（"60分コース"）→ 所要分 */
function courseMinOf(c) {
  const m = String(c || "").match(/(\d+)\s*分/);
  return m ? +m[1] : 60;
}
/* 希望日(例 "2026/9/16") + 時刻ラベル("13:00"/"翌2:00") → JSTの壁時計 "YYYY/MM/DD HH:mm"。
   翌なら日付を+1。キャンセル期限の判定に使う。 */
function apptString(dateStr, timeLabel) {
  const dm = String(dateStr || "").match(/(\d+)\/(\d+)\/(\d+)/);
  const tm = String(timeLabel || "").match(/(翌)?\s*(\d{1,2}):(\d{2})/);
  if (!dm || !tm) return "";
  const dt = new Date(+dm[1], +dm[2] - 1, +dm[3] + (tm[1] ? 1 : 0), +tm[2], +tm[3]);
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}/${p(dt.getMonth() + 1)}/${p(dt.getDate())} ${p(
    dt.getHours()
  )}:${p(dt.getMinutes())}`;
}

/* 希望日(例 "2026/9/16") の「JST 0:00」を UTC epoch(ms) に（端末TZ非依存／JST=UTC+9）。
   新API(apiV2)の busy 区間 epoch を「その日の0:00からの経過分」に直すための基準。 */
function dayMidnightMs(dateStr) {
  const m = String(dateStr || "").match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], -9, 0); // 0:00 JST = 前日15:00 UTC
}
/* epoch(ms) → その日(dateStr)0:00からの経過分（翌日の深夜は1440超）。 */
function epochToDayMin(epochMs, dateStr) {
  const base = dayMidnightMs(dateStr);
  if (base == null || epochMs == null) return null;
  return Math.round((Number(epochMs) - base) / 60000);
}

export default function Reserve() {
  const days = schedule.days || [];
  const [dayIdx, setDayIdx] = useState(0);
  const [therapist, setTherapist] = useState("");
  const [time, setTime] = useState("");
  const [courseI, setCourseI] = useState(-1);
  const [form, setForm] = useState({
    name: "",
    kana: "",
    email: "",
    tel: "",
    note: "",
    pay: cfg.pays[0] || "現金",
    source: "",
    sourceOther: "",
  });
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState({ sending: false, done: false, error: "" });
  const [booked, setBooked] = useState([]); // 既存予約（スプレッドシートから取得）
  // 空き状況の取得状態（新API時のみ判定に使用）。"loading" | "ok" | "error"
  // ・error のときは「空き」と誤表示せず、時間選択をブロックする（取得失敗≠空き）。
  const [availState, setAvailState] = useState("loading");
  // 指定担当者の出勤が今日以降に無い等の案内（通常フォームは引き続き利用可）
  const [notice, setNotice] = useState("");

  const day = days[dayIdx] || { list: [], label: "" };

  // URL(?t=担当者名&d=日付) から初期選択する（初回マウント時のみ・以後の選択は上書きしない）。
  //  ・有効な d があればその日付を優先（出勤情報ページ→予約の既存動作を維持）。
  //  ・t だけ指定なら、日本時間で今日以降に その担当者が出勤する最も近い日を選ぶ。
  //  ・過去日は自動選択しない。URLの値は実際の出勤データに存在するか確認して使う（HTMLとして挿入しない）。
  //  ・今日以降の出勤が無い場合は別担当者で進めず、案内を表示する。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const t = q.get("t");
    const d = q.get("d");
    if (!t && !d) return;

    const worksOn = (dayObj, name) =>
      !!name && (dayObj?.list || []).some((e) => e.name === name);
    const dayKeyOf = (dateStr) => {
      const m = String(dateStr || "").match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
      return m ? +m[1] * 10000 + +m[2] * 100 + +m[3] : null;
    };
    // 日本時間(JST)の「今日 0:00」を YYYYMMDD の数値キーに（利用者の端末TZに依存しない）
    const now = new Date();
    const jst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
    const todayKey =
      jst.getFullYear() * 10000 + (jst.getMonth() + 1) * 100 + jst.getDate();

    // d が出勤データに存在するか（存在すればそのインデックス）
    let dIdx = -1;
    if (d) {
      const i = days.findIndex((x) => x.date === d || x.label === d);
      if (i >= 0) dIdx = i;
    }
    // 担当者が出勤データ全体に1回でも登場するか（存在しない名前なら通常フォーム）
    const tExists = t ? days.some((x) => worksOn(x, t)) : false;

    // 1) 有効な日付指定があれば優先。担当者がその日に居れば選択。
    if (dIdx >= 0) {
      setDayIdx(dIdx);
      if (worksOn(days[dIdx], t)) setTherapist(t);
      return;
    }

    // 2) 担当者だけ指定：今日以降で その担当者が出勤する最も近い日を選ぶ。
    if (t) {
      let bestIdx = -1;
      let bestKey = Infinity;
      for (let i = 0; i < days.length; i++) {
        if (!worksOn(days[i], t)) continue;
        const k = dayKeyOf(days[i].date);
        if (k == null || k < todayKey) continue; // 過去日は自動選択しない
        if (k < bestKey) {
          bestKey = k;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        setDayIdx(bestIdx);
        setTherapist(t);
      } else if (tExists) {
        // 出勤データに居るが今日以降の掲載が無い（過去のみ）→ 別担当者で進めず案内
        setNotice(
          `${t}さんの出勤予定は現在掲載されていません。出勤情報をご確認いただくか、店舗へお問い合わせください。`
        );
      }
      // tExists=false（存在しない担当者名）は何もしない＝通常の予約フォームとして利用可
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 現在の予約状況を JSONP で取得（重複予約を防ぐ）。GET+JSONPでCORSを回避。
  // ・セラピストを選ぶたび／日付変更／ページ復帰時に取り直し
  // ・末尾に時刻を付けてブラウザ／CDNのキャッシュを回避（＝常に最新）
  // ・新API(apiV2)：{ok,busy:[{th,s,e,st}]} を受け取り、ok:false／取得失敗は error 扱い
  //   （＝「空き」と誤表示しない）。従来エンドポイントは配列をそのまま使う（従来挙動）。
  useEffect(() => {
    const base = API2 || cfg.endpoint;
    if (!base) return;
    let cancelled = false;
    const load = () => {
      if (!cancelled) setAvailState("loading");
      const cb = "__resvAvail_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const done = () => {
        try {
          delete window[cb];
        } catch (_) {}
        script.remove();
      };
      window[cb] = (data) => {
        if (!cancelled) {
          if (API2) {
            // 新API：{ok:true,busy:[...]} のときのみ空き状況を反映
            if (data && data.ok && Array.isArray(data.busy)) {
              setBooked(data.busy);
              setAvailState("ok");
            } else {
              setBooked([]);
              setAvailState("error"); // ok:false 等 → 空き扱いしない
            }
          } else {
            // 従来エンドポイント：配列をそのまま（従来挙動を維持）
            setBooked(Array.isArray(data) ? data : []);
            setAvailState(Array.isArray(data) ? "ok" : "error");
          }
        }
        done();
      };
      const q =
        "callback=" +
        cb +
        "&_=" +
        Date.now() +
        (API2 ? "&action=availability&date=" + encodeURIComponent(day.date || "") : "");
      script.src = base + (base.includes("?") ? "&" : "?") + q;
      script.onerror = () => {
        if (!cancelled) {
          setBooked([]);
          setAvailState("error"); // 通信失敗 → 空き扱いしない
        }
        done();
      };
      document.body.appendChild(script);
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapist, dayIdx]);

  // 選択中セラピストの出勤時間 → 予約可能スロット
  const shiftStr = useMemo(() => {
    const e = day.list.find((x) => x.name === therapist);
    return e ? e.time : "";
  }, [day, therapist]);
  const slots = useMemo(() => genSlots(parseShift(shiftStr)), [shiftStr]);

  // 選択コース（所要分の算出に使用）と、勤務時間レンジ。
  // コース未選択のうちは最短コースの所要分を仮に用い、選択後に即再計算する。
  const course = courseI >= 0 ? cfg.courses[courseI] : null;
  const shiftRange = useMemo(() => parseShift(shiftStr), [shiftStr]);
  const effCourseMin = useMemo(() => {
    if (course) return courseMinOf(course.label);
    const ms = (cfg.courses || []).map((c) => courseMinOf(c.label));
    return ms.length ? Math.min(...ms) : 60;
  }, [course]);

  // 選択中セラピスト・日付で「埋まっている時間帯」（分レンジ）。
  // ・新API：busy=[{th:担当ID, s:開始epoch, e:終了epoch, st}]（終了まで正確に保持）
  //   → その日0:00基準の分に変換。担当IDは名前（adminTherapistsが名前をIDに採用）。
  // ・従来：[{th,d,t,c}] → 開始ラベル＋コース所要分で区間を算出（従来挙動）。
  const occupied = useMemo(() => {
    if (API2) {
      return booked
        .filter((b) => String(b.th) === String(therapist))
        .map((b) => {
          const s = epochToDayMin(b.s, day.date);
          const e = epochToDayMin(b.e, day.date);
          return s == null || e == null ? null : { s, e };
        })
        .filter(Boolean);
    }
    return booked
      .filter((b) => b.th === therapist && b.d === (day.label || ""))
      .map((b) => {
        const s = labelToMin(b.t);
        return s == null ? null : { s, e: s + courseMinOf(b.c) };
      })
      .filter(Boolean);
  }, [booked, therapist, day]);
  // 予約枠が選択不可かを判定する。
  //  overlap: 新規区間[開始, 開始+コース所要] が既存予約区間と一部でも重なる
  //           （一般的な区間重複判定: 新規開始 < 既存終了 && 新規終了 > 既存開始）
  //  exceed : コース終了時刻が、そのセラピストの勤務終了時刻を超える
  const slotBlock = (slot) => {
    const m = labelToMin(slot);
    if (m == null) return { overlap: false, exceed: false, disabled: false };
    const end = m + effCourseMin;
    const overlap = occupied.some((r) => m < r.e && end > r.s);
    const exceed = !!shiftRange && end > shiftRange.end;
    return { overlap, exceed, disabled: overlap || exceed };
  };

  // 予約可能スロットを「時間帯（〜時台）」ごとにまとめる。
  // 5分刻みのボタンが一列に並ぶと選びにくいため、時間帯の見出しで区切る。
  const slotGroups = useMemo(() => {
    const groups = [];
    let cur = null;
    for (const s of slots) {
      const min = labelToMin(s);
      if (min == null) continue;
      const h = Math.floor(min / 60); // 0〜28（24以上は翌日）
      if (!cur || cur.h !== h) {
        const label = h >= 24 ? `翌${h - 24}時台` : `${h}時台`;
        cur = { h, label, slots: [] };
        groups.push(cur);
      }
      const end = min + effCourseMin;
      const overlap = occupied.some((r) => min < r.e && end > r.s);
      const exceed = !!shiftRange && end > shiftRange.end;
      cur.slots.push({
        label: s,
        taken: overlap, // 取り消し線（予約済み）
        exceed, // 勤務終了超過（淡色）
        disabled: overlap || exceed,
      });
    }
    return groups;
  }, [slots, occupied, effCourseMin, shiftRange]);

  // 空きスロット総数（サマリー表示用）
  const availCount = useMemo(
    () => slotGroups.reduce((n, g) => n + g.slots.filter((s) => !s.disabled).length, 0),
    [slotGroups]
  );

  // コース変更などで、選択中の時間が選べなくなったら解除する（即再計算）。
  useEffect(() => {
    if (time && slotBlock(time).disabled) setTime("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effCourseMin, shiftStr, occupied]);

  // 進捗ステッパー用：各ステップの完了状態
  const steps = [
    { label: "セラピスト", done: !!therapist },
    { label: "コース", done: courseI >= 0 },
    { label: "時間", done: !!time },
    {
      label: "お客様情報",
      done: !!(form.name.trim() && form.email.trim() && form.tel.trim()),
    },
  ];

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pickTherapist = (name) => {
    setTherapist(name);
    setTime("");
  };

  const validate = () => {
    if (!therapist) return "セラピストを選んでください。";
    if (courseI < 0) return "コースを選んでください。";
    // 新API：空き状況を取得できていない状態では予約へ進めない（取得失敗≠空き）
    if (API2 && availState === "error")
      return "空き状況を取得できませんでした。少し時間をおいて再読み込みいただくか、お電話でご予約ください。";
    if (!time) return "予約時間を選んでください。";
    const blk = slotBlock(time);
    if (blk.exceed)
      return "選択中のコースでは、その開始時間だと勤務終了時間を超えてしまいます。開始時間またはコースをご変更ください。";
    if (blk.overlap)
      return "申し訳ございません。その時間は予約が入りました。別の時間をお選びください。";
    if (course?.honshimei && therapist === "おまかせ（指名なし）")
      return "150分以上のコースは本指名（セラピストご指名）でのみご予約いただけます。";
    if (!form.name.trim()) return "お名前を入力してください。";
    if (!form.email.trim()) return "メールアドレスを入力してください。";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return "メールアドレスの形式をご確認ください。";
    if (!form.tel.trim()) return "電話番号を入力してください。";
    return "";
  };

  const goConfirm = () => {
    const err = validate();
    if (err) {
      setState((s) => ({ ...s, error: err }));
      return;
    }
    setState((s) => ({ ...s, error: "" }));
    setConfirming(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const source = form.source === "該当なし・その他" ? form.sourceOther : form.source;

  // 二重送信・再送での重複作成を防ぐ冪等キー（同じ予約内容なら同じ値）。
  const idempotencyKey = useMemo(
    () =>
      [
        "WEB",
        therapist,
        day.date || "",
        time,
        (form.email || "").toLowerCase(),
        course ? course.label : "",
      ].join("|"),
    [therapist, day.date, time, form.email, course]
  );

  const submit = async () => {
    const base = API2 || cfg.endpoint;
    if (!base) {
      setState({
        sending: false,
        done: false,
        error: `予約送信の設定が完了していません。恐れ入りますが、お電話（${SITE.telephoneDisplay}）でご連絡ください。`,
      });
      return;
    }
    setState({ sending: true, done: false, error: "" });

    // --- 新API（apiV2）：web_create を JSON POST し、結果を確認してから完了表示 ---
    if (API2) {
      try {
        // Content-Type を付けず text/plain（＝単純リクエスト）で送りCORSプリフライトを回避。
        // GASは e.postData.contents を JSON.parse するためボディはJSON文字列でよい。
        const res = await fetch(API2, {
          method: "POST",
          body: JSON.stringify({
            action: "web_create",
            therapistId: therapist,
            therapistName: therapist,
            dateStr: day.date || "",
            timeLabel: time,
            course: course.label,
            price: yen(course.price),
            customerName: form.name,
            tel: form.tel,
            email: form.email,
            idempotencyKey,
          }),
        });
        const r = await res.json(); // ← バックエンドの結果を必ず確認
        if (r && r.ok) {
          setState({ sending: false, done: true, error: "" });
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          // 重複・満席・出勤外などはバックエンドの理由を表示（＝未確定を完了と誤表示しない）
          setState({
            sending: false,
            done: false,
            error:
              (r && r.reason) ||
              "ご予約を受け付けられませんでした。時間を変えて再度お試しください。",
          });
          // 満席の可能性があるため空き状況を取り直す
          setBooked((b) => b);
        }
      } catch (e) {
        setState({
          sending: false,
          done: false,
          error:
            "送信に失敗しました。通信環境をご確認のうえ、再度お試しください。",
        });
      }
      return;
    }

    // --- 従来エンドポイント（no-cors・従来挙動を維持） ---
    const body = new URLSearchParams({
      date: day.label || "",
      time,
      appt: apptString(day.date, time), // キャンセル期限の判定に使う正確な日時（JST）
      course: course.label,
      price: yen(course.price),
      therapist,
      name: form.name,
      kana: form.kana,
      email: form.email,
      tel: form.tel,
      pay: form.pay,
      source: source || "",
      note: form.note,
    });
    try {
      await fetch(cfg.endpoint, { method: "POST", mode: "no-cors", body });
      setState({ sending: false, done: true, error: "" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setState({
        sending: false,
        done: false,
        error:
          "送信に失敗しました。通信環境をご確認のうえ、再度お試しください。",
      });
    }
  };

  /* ---------- 完了画面 ---------- */
  if (state.done) {
    return (
      <div className="rsv-stage">
        <div className="rsv">
          <div className="rsv-head">
            <div className="rsv-logo">WEB予約</div>
            <div className="rsv-sub">AROMA DAIAMOND｜亀戸</div>
          </div>
          <div className="rsv-done">
            <div className="rsv-done-ic mail">✉</div>
            <h2>ご予約リクエストを送信しました</h2>
            <div className="rsv-pending">
              まだご予約は完了していません。追ってお送りする確認メールの
              「予約を確定する」リンクを開くと、ご予約が確定します。
            </div>
            <p>
              ご入力のメールアドレス（<b>{form.email}</b>）宛に確認メールをお送りします。
              メール内のリンクを開いてご予約を確定してください。
              <b>数分たっても確認メールが届かない場合は、送信が正しく完了していない可能性があります。</b>
              迷惑メールフォルダをご確認のうえ、届かないときはお手数ですが
              お電話（{SITE.telephoneDisplay}）でご予約内容をお知らせください。
            </p>
            <div className="rsv-done-box">
              <div className="rsv-done-box-h">仮予約の内容</div>
              <div>
                <b>希望日時</b>
                {day.label} {time}
              </div>
              <div>
                <b>コース</b>
                {course.label}（{yen(course.price)}）
              </div>
              <div>
                <b>セラピスト</b>
                {therapist}
              </div>
            </div>
            <a className="rsv-back" href="../">
              サイトトップへ戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 確認画面 ---------- */
  if (confirming) {
    const rows = [
      ["希望日", day.label],
      ["予約時間", time],
      ["コース", `${course.label}（${yen(course.price)}）`],
      ["セラピスト", therapist],
      ["お名前", `${form.name}${form.kana ? `（${form.kana}）` : ""}`],
      ["メール", form.email],
      ["電話番号", form.tel],
      ["お支払い", form.pay],
      ["来店きっかけ", source || "－"],
      ["その他ご希望", form.note || "－"],
    ];
    return (
      <div className="rsv-stage">
        <div className="rsv">
          <div className="rsv-head">
            <div className="rsv-logo">WEB予約</div>
            <div className="rsv-sub">ご予約内容の確認</div>
          </div>
          <p className="rsv-lead">
            以下の内容でよろしければ「この内容で予約する」を押してください。
          </p>
          <table className="rsv-confirm">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rsv-terms-note">
            ご予約の前に
            <a href="../terms/" target="_blank" rel="noopener noreferrer">
              ご利用規約・キャンセル条件
            </a>
            をご確認ください。
          </p>
          {state.error && <p className="rsv-err">{state.error}</p>}
          <button className="rsv-submit" onClick={submit} disabled={state.sending}>
            {state.sending ? "送信中…" : "この内容で予約する"}
          </button>
          <button
            className="rsv-edit"
            onClick={() => {
              setConfirming(false);
              setState((s) => ({ ...s, error: "" }));
            }}
          >
            ← 内容を修正する
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 入力フォーム ---------- */
  return (
    <div className="rsv-stage">
      <div className="rsv">
        <div className="rsv-head">
          <div className="rsv-logo">WEB予約</div>
          <div className="rsv-sub">AROMA DAIAMOND｜亀戸</div>
        </div>

        {/* 進捗ステッパー */}
        <ol className="rsv-steps" aria-label="予約の進捗">
          {steps.map((s, i) => (
            <li
              key={i}
              className={`rsv-step ${s.done ? "done" : ""}`}
              aria-current={s.done ? undefined : "step"}
            >
              <span className="rsv-step-dot">{s.done ? "✓" : i + 1}</span>
              <span className="rsv-step-label">{s.label}</span>
            </li>
          ))}
        </ol>

        {notice && (
          <p className="rsv-notice" role="status">
            {notice}
          </p>
        )}

        {/* 1 セラピスト */}
        <section className="rsv-sec">
          <h2 className="rsv-h">
            <span className="rsv-n">1</span>セラピストを選んでください
          </h2>

          <div className="rsv-daybar">
            <button
              className="rsv-day-nav"
              disabled={dayIdx <= 0}
              onClick={() => {
                setDayIdx((i) => Math.max(0, i - 1));
                setTherapist("");
                setTime("");
              }}
            >
              ‹ 前の日
            </button>
            <select
              className="rsv-day-sel"
              value={dayIdx}
              onChange={(e) => {
                setDayIdx(+e.target.value);
                setTherapist("");
                setTime("");
              }}
            >
              {days.map((d, i) => (
                <option value={i} key={i}>
                  {d.label}
                </option>
              ))}
              {days.length === 0 && <option value={0}>日付未定</option>}
            </select>
            <button
              className="rsv-day-nav"
              disabled={dayIdx >= days.length - 1}
              onClick={() => {
                setDayIdx((i) => Math.min(days.length - 1, i + 1));
                setTherapist("");
                setTime("");
              }}
            >
              次の日 ›
            </button>
          </div>

          <div className="rsv-thera">
            {day.list.map((e, i) => {
              const p = PROFILE[e.name] || {};
              const on = therapist === e.name;
              return (
                <button
                  className={`rsv-tcard ${on ? "on" : ""}`}
                  key={i}
                  onClick={() => pickTherapist(e.name)}
                  type="button"
                >
                  <span className="rsv-tphoto" style={{ background: p.photoBg }}>
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoSrc(p.photo, BASE)} alt={e.name} />
                    ) : (
                      <span className="rsv-theart">◆</span>
                    )}
                  </span>
                  <span className="rsv-tname">{e.name}</span>
                  {p.age && <span className="rsv-tage">{p.age}歳</span>}
                  <span className="rsv-ttime">{e.time}</span>
                  {on && <span className="rsv-tcheck">✓</span>}
                </button>
              );
            })}
            {day.list.length === 0 && (
              <p className="rsv-empty">この日の出勤セラピストは未定です。</p>
            )}
          </div>
          <button
            type="button"
            className={`rsv-omakase ${therapist === "おまかせ（指名なし）" ? "on" : ""}`}
            onClick={() => pickTherapist("おまかせ（指名なし）")}
          >
            セラピストはおまかせ（指名なし）
          </button>
        </section>

        {/* 2 コース */}
        <section className="rsv-sec">
          <h2 className="rsv-h">
            <span className="rsv-n">2</span>コースを選んでください
          </h2>
          <p className="rsv-note">{cfg.courseNote}</p>
          <div className="rsv-courses">
            {cfg.courses.map((c, i) => (
              <label className={`rsv-course ${courseI === i ? "on" : ""}`} key={i}>
                <input
                  type="radio"
                  name="course"
                  checked={courseI === i}
                  onChange={() => setCourseI(i)}
                />
                <span className="rsv-cname">
                  {c.label}
                  {c.honshimei && <span className="rsv-honshimei">本指名</span>}
                </span>
                <span className="rsv-cprice">{yen(c.price)}</span>
              </label>
            ))}
          </div>
        </section>

        {/* 3 時間 */}
        <section className="rsv-sec">
          <h2 className="rsv-h">
            <span className="rsv-n">3</span>予約時間を選んでください
          </h2>
          {therapist && API2 && availState === "error" ? (
            <p className="rsv-hint" role="alert">
              ただいま空き状況を取得できませんでした。安全のため、この時間帯のご予約は
              お受けできません。少し時間をおいて再読み込みいただくか、恐れ入りますが
              お電話（{SITE.telephoneDisplay}）でご予約ください。
            </p>
          ) : therapist ? (
            availState === "loading" && API2 ? (
              <p className="rsv-hint">空き状況を確認しています…</p>
            ) : slotGroups.length > 0 ? (
              <>
                <p className="rsv-avail">
                  <b>{therapist}</b>：{day.label} は
                  <span className="rsv-avail-num">{availCount}</span>
                  枠が予約可能です（開始時間をお選びください）
                </p>
                <div className="rsv-timegroups">
                  {slotGroups.map((g) => {
                    const gAvail = g.slots.filter((s) => !s.disabled).length;
                    return (
                      <div className="rsv-timegroup" key={g.h}>
                        <div className="rsv-timegroup-h">
                          <span className="rsv-timegroup-label">{g.label}</span>
                          <span
                            className={`rsv-timegroup-badge ${
                              gAvail === 0 ? "full" : ""
                            }`}
                          >
                            {gAvail === 0 ? "満" : `空き ${gAvail}`}
                          </span>
                        </div>
                        <div className="rsv-times">
                          {g.slots.map((s) => (
                            <button
                              key={s.label}
                              type="button"
                              disabled={s.disabled}
                              className={`rsv-time ${time === s.label ? "on" : ""} ${
                                s.taken ? "taken" : ""
                              } ${s.exceed ? "exceed" : ""}`}
                              onClick={() => !s.disabled && setTime(s.label)}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(occupied.length > 0 ||
                  slotGroups.some((g) => g.slots.some((s) => s.exceed))) && (
                  <p className="rsv-legend">
                    取り消し線＝ご予約済み／うすい時間＝選択中のコースだと勤務終了時間を超えるため選べません。
                  </p>
                )}
              </>
            ) : (
              <p className="rsv-hint">
                この日の {therapist} さんは受付可能な時間がありません。
                別の日・セラピストをお選びください。
              </p>
            )
          ) : (
            <p className="rsv-hint">先にセラピストを選んでください。</p>
          )}
        </section>

        {/* 4 お客様情報 */}
        <section className="rsv-sec">
          <h2 className="rsv-h">
            <span className="rsv-n">4</span>お客様情報をご入力ください
          </h2>
          <label className="rsv-field">
            <span className="rsv-label">
              お名前<i>必須</i>
            </span>
            <input value={form.name} onChange={set("name")} />
          </label>
          <label className="rsv-field">
            <span className="rsv-label">フリガナ</span>
            <input
              value={form.kana}
              onChange={set("kana")}
              placeholder="カタカナ or ひらがな"
            />
          </label>
          <label className="rsv-field">
            <span className="rsv-label">
              メールアドレス<i>必須</i>
            </span>
            <input type="email" value={form.email} onChange={set("email")} />
          </label>
          <label className="rsv-field">
            <span className="rsv-label">
              電話番号<i>必須</i>
            </span>
            <input type="tel" value={form.tel} onChange={set("tel")} />
          </label>
          <label className="rsv-field">
            <span className="rsv-label">その他ご希望</span>
            <textarea rows={4} value={form.note} onChange={set("note")} />
          </label>
          <div className="rsv-pay">
            <span className="rsv-label">お支払い方法</span>
            {cfg.pays.map((p) => {
              const soon = p.includes("準備中");
              return (
                <label
                  className={`rsv-radio${soon ? " rsv-radio-soon" : ""}`}
                  key={p}
                >
                  <input
                    type="radio"
                    name="pay"
                    checked={form.pay === p}
                    disabled={soon}
                    onChange={() =>
                      !soon && setForm((f) => ({ ...f, pay: p }))
                    }
                  />
                  {p}
                </label>
              );
            })}
          </div>
        </section>

        {/* 5 きっかけ */}
        <section className="rsv-sec">
          <h2 className="rsv-h">
            <span className="rsv-n">5</span>本日ご予約のきっかけを教えてください
          </h2>
          <div className="rsv-sources">
            {cfg.sources.map((s) => (
              <label className="rsv-radio" key={s}>
                <input
                  type="radio"
                  name="source"
                  checked={form.source === s}
                  onChange={() => setForm((f) => ({ ...f, source: s }))}
                />
                {s}
              </label>
            ))}
            <label className="rsv-radio">
              <input
                type="radio"
                name="source"
                checked={form.source === "該当なし・その他"}
                onChange={() =>
                  setForm((f) => ({ ...f, source: "該当なし・その他" }))
                }
              />
              その他
            </label>
          </div>
          {form.source === "該当なし・その他" && (
            <input
              className="rsv-source-other"
              placeholder="選択肢にない場合はこちらに記入ください"
              value={form.sourceOther}
              onChange={set("sourceOther")}
            />
          )}
        </section>

        {/* 注意事項 */}
        <section className="rsv-notes">
          <div className="rsv-notes-h">注意事項</div>
          <ul>
            {cfg.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>

        {/* 選択内容サマリー */}
        {(therapist || time || course) && (
          <div className="rsv-summary">
            <div className="rsv-summary-h">選択中の内容</div>
            <dl className="rsv-summary-grid">
              <div>
                <dt>セラピスト</dt>
                <dd>{therapist || "未選択"}</dd>
              </div>
              <div>
                <dt>日時</dt>
                <dd>{time ? `${day.label} ${time}` : "未選択"}</dd>
              </div>
              <div>
                <dt>コース</dt>
                <dd>{course ? `${course.label}（${yen(course.price)}）` : "未選択"}</dd>
              </div>
            </dl>
          </div>
        )}

        {state.error && <p className="rsv-err">{state.error}</p>}
        <button className="rsv-submit" onClick={goConfirm}>
          確認画面へ
        </button>
        <a className="rsv-back" href="../">
          ← サイトトップへ戻る
        </a>
      </div>
    </div>
  );
}
