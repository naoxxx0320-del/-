"use client";

import { useEffect, useRef, useState } from "react";
import cfg from "../../data/chat-config.json";

/* サイト全ページに表示するAI接客チャット。
   送信は Google Apps Script 経由（?action=chat）で Claude に問い合わせ、
   JSONP で返信を受け取る（APIキーはサーバー側に隠す）。
   cfg.enabled が false のあいだは何も表示しない（バックエンド準備前）。 */
export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState([{ role: "bot", text: cfg.greeting }]);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, open, sending]);

  if (!cfg.enabled) return null;

  const send = () => {
    const q = input.trim();
    if (!q || sending) return;
    const history = [...msgs, { role: "user", text: q }];
    setMsgs(history);
    setInput("");
    setSending(true);

    // 直近の会話（最大6往復）を軽量に送る
    const hist = history
      .slice(-12)
      .map((m) => `${m.role === "user" ? "U" : "A"}:${m.text}`)
      .join("\n")
      .slice(0, 1500);

    const cb = "__aichat_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const done = () => {
      try {
        delete window[cb];
      } catch (_) {}
      script.remove();
    };
    const timeout = setTimeout(() => {
      done();
      setSending(false);
      setMsgs((m) => [
        ...m,
        {
          role: "bot",
          text: "申し訳ございません、応答に時間がかかっています。お手数ですがお電話（00-0000-0000）でもご案内できます。",
        },
      ]);
    }, 25000);

    window[cb] = (data) => {
      clearTimeout(timeout);
      done();
      setSending(false);
      const reply =
        data && typeof data.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : "申し訳ございません、ただいまAI応答を準備中です。お電話（00-0000-0000）またはWEB予約をご利用ください。";
      setMsgs((m) => [...m, { role: "bot", text: reply }]);
    };
    script.onerror = () => {
      clearTimeout(timeout);
      done();
      setSending(false);
      setMsgs((m) => [
        ...m,
        {
          role: "bot",
          text: "通信エラーが発生しました。時間をおいて再度お試しください。",
        },
      ]);
    };
    const u = new URL(cfg.endpoint);
    u.searchParams.set("action", "chat");
    u.searchParams.set("q", q);
    u.searchParams.set("h", hist);
    u.searchParams.set("callback", cb);
    u.searchParams.set("_", Date.now().toString());
    script.src = u.toString();
    document.body.appendChild(script);
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {!open && (
        <button
          className="aichat-fab"
          onClick={() => setOpen(true)}
          aria-label="AIチャットを開く"
        >
          <span className="aichat-fab-ic">💬</span>
          <span className="aichat-fab-tx">AIチャット</span>
        </button>
      )}

      {open && (
        <div className="aichat-panel" role="dialog" aria-label="AIチャット">
          <div className="aichat-head">
            <div className="aichat-head-t">
              <b>{cfg.title}</b>
              <small>{cfg.subtitle}</small>
            </div>
            <button
              className="aichat-close"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>

          <div className="aichat-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div className={`aichat-row ${m.role}`} key={i}>
                <div className="aichat-bubble">{m.text}</div>
              </div>
            ))}
            {sending && (
              <div className="aichat-row bot">
                <div className="aichat-bubble aichat-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          <div className="aichat-input">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="メッセージを入力…"
            />
            <button onClick={send} disabled={sending || !input.trim()}>
              送信
            </button>
          </div>
          <div className="aichat-note">
            AIによる自動応答です。最終的なご予約はWEB予約・お電話でご確定ください。
          </div>
        </div>
      )}
    </>
  );
}
