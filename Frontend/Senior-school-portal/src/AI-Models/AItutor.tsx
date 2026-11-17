import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";


export interface TutorMessage {
  id: string;
  role: "user" | "tutor";
  content: string;
  /** Worked solution shown as a numbered list under the reply. */
  steps?: string[];
}

export interface TutorReply {
  content: string;
  steps?: string[];
}

export interface TutorChat {
  id: string;
  title: string;
  /** For example "Today" or "Yesterday". */
  when: string;
}

export interface TutorSendInput {
  text: string;
  subject: string;
  history: TutorMessage[];
}

export interface AiTutorPageProps {
  schoolName?: string;
  learnerName?: string;
  subjects?: string[];
  suggestions?: string[];
  /** Earlier chats listed in the sidebar. */
  chats?: TutorChat[];
  activeChatId?: string;
  initialMessages?: TutorMessage[];
  onSelectChat?: (id: string) => void;
  onNewChat?: () => void;
  /** Returns the tutor's reply. Without it the page shows a demo reply. */
  onSend?: (input: TutorSendInput) => Promise<TutorReply>;
  onBack?: () => void;
}

const DEFAULT_SUBJECTS = ["Mathematics", "English", "Kiswahili", "Science", "Social Studies"];

const DEFAULT_SUGGESTIONS = [
  "Explain fractions with an example",
  "Help me plan my revision for next week",
  "Check my composition introduction",
  "Quiz me on photosynthesis",
];

const GENERIC_ERROR = "The tutor could not reply. Check your connection and send your message again.";

const DEMO_REPLY: TutorReply = {
  content: "Let us work it out together. Here is how to add 1/2 and 1/3.",
  steps: [
    "Find a common denominator. The smallest number both 2 and 3 divide into is 6.",
    "Rewrite each fraction: 1/2 = 3/6 and 1/3 = 2/6.",
    "Add the numerators and keep the denominator: 3/6 + 2/6 = 5/6.",
  ],
};

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconName = "send" | "plus" | "menu" | "close" | "copy" | "check" | "cap" | "chat" | "back";

const ICON_PATHS: Record<IconName, ReactNode> = {
  send: <path d="M5 12h14M13 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cap: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  back: <path d="M15 5l-7 7 7 7" />,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "L"
  );
}

/* ------------------------------------------------------------------ */
/* Message                                                             */
/* ------------------------------------------------------------------ */

function Message({ m }: { m: TutorMessage }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = [m.content, ...(m.steps ?? []).map((s, i) => `${i + 1}. ${s}`)].join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard can be blocked. Nothing else to do. */
    }
  };

  if (m.role === "user") {
    return (
      <div className="at-msg at-user">
        <p className="at-bubble">{m.content}</p>
      </div>
    );
  }

  return (
    <div className="at-msg at-tutor">
      <span className="at-avatar" aria-hidden="true">
        <Icon name="cap" size={18} />
      </span>
      <div className="at-body">
        <span className="at-who">AI Tutor</span>
        {m.content.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {m.steps?.length ? (
          <ol className="at-steps">
            {m.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        ) : null}
        <button type="button" className="at-copy" onClick={copy}>
          <Icon name={copied ? "check" : "copy"} size={15} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AiTutorPage({
  schoolName = "Senior School",
  learnerName = "Learner",
  subjects = DEFAULT_SUBJECTS,
  suggestions = DEFAULT_SUGGESTIONS,
  chats = [],
  activeChatId,
  initialMessages = [],
  onSelectChat,
  onNewChat,
  onSend,
  onBack,
}: AiTutorPageProps) {
  const uid = useId();
  const [messages, setMessages] = useState<TutorMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState(subjects[0] ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  const nextId = () => `m${Date.now()}-${idRef.current++}`;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, loading]);

  const grow = () => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;

    const userMsg: TutorMessage = { id: nextId(), role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setError(null);
    setLoading(true);
    window.requestAnimationFrame(grow);

    try {
      const reply = onSend
        ? await onSend({ text, subject, history })
        : await new Promise<TutorReply>((resolve) => window.setTimeout(() => resolve(DEMO_REPLY), 900));
      setMessages((m) => [...m, { id: nextId(), role: "tutor", content: reply.content, steps: reply.steps }]);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : GENERIC_ERROR);
    } finally {
      setLoading(false);
      boxRef.current?.focus();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  };

  const newChat = () => {
    setMessages([]);
    setInput("");
    setError(null);
    setDrawer(false);
    onNewChat?.();
    window.requestAnimationFrame(() => {
      grow();
      boxRef.current?.focus();
    });
  };

  const empty = messages.length === 0 && !loading;

  return (
    <div className="at-page">
      {drawer ? <div className="at-scrim" onClick={() => setDrawer(false)} aria-hidden="true" /> : null}

      <aside className={`at-side${drawer ? " is-open" : ""}`} aria-label="Chats">
        <div className="at-brand">
          <span className="at-logo" aria-hidden="true">
            <Icon name="cap" size={20} />
          </span>
          <div>
            <strong>AI Tutor</strong>
            <small>{schoolName}</small>
          </div>
          <button type="button" className="at-iconbtn at-only-mobile" aria-label="Close menu" onClick={() => setDrawer(false)}>
            <Icon name="close" />
          </button>
        </div>

        <button type="button" className="at-new" onClick={newChat}>
          <Icon name="plus" size={18} />
          New chat
        </button>

        <nav className="at-chats" aria-label="Earlier chats">
          {chats.length === 0 ? (
            <p className="at-none">Your chats will appear here.</p>
          ) : (
            <ul>
              {chats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="at-chat"
                    aria-current={c.id === activeChatId ? "true" : undefined}
                    onClick={() => {
                      setDrawer(false);
                      onSelectChat?.(c.id);
                    }}
                  >
                    <Icon name="chat" size={16} />
                    <span>
                      {c.title}
                      <small>{c.when}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="at-me">
          <span className="at-initials" aria-hidden="true">
            {initialsOf(learnerName)}
          </span>
          <span>{learnerName}</span>
          {onBack ? (
            <button type="button" className="at-iconbtn" aria-label="Back to portal" onClick={onBack}>
              <Icon name="back" />
            </button>
          ) : null}
        </div>
      </aside>

      <section className="at-main">
        <header className="at-top">
          <button type="button" className="at-iconbtn at-only-mobile" aria-label="Open menu" onClick={() => setDrawer(true)}>
            <Icon name="menu" />
          </button>
          <div className="at-subject">
            <label htmlFor={`${uid}-subject`}>Subject</label>
            <select id={`${uid}-subject`} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={loading}>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="at-scroll">
          <div className="at-thread" role="log" aria-live="polite" aria-label="Conversation with the AI Tutor">
            {empty ? (
              <div className="at-empty">
                <h1>What are we learning today, {learnerName.split(" ")[0]}?</h1>
                <p>Ask a question, paste a problem or choose one below. The tutor explains step by step and checks your thinking.</p>
                <ul className="at-sugg">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button type="button" onClick={() => void send(s)}>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              messages.map((m) => <Message key={m.id} m={m} />)
            )}

            {loading ? (
              <div className="at-msg at-tutor" role="status" aria-label="The tutor is thinking">
                <span className="at-avatar" aria-hidden="true">
                  <Icon name="cap" size={18} />
                </span>
                <div className="at-body">
                  <span className="at-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="at-error" role="alert">
                {error}
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        </div>

        <form className="at-composer" onSubmit={onSubmit}>
          <div className="at-box">
            <label htmlFor={`${uid}-msg`} className="at-sr">
              Message the AI Tutor
            </label>
            <textarea
              ref={boxRef}
              id={`${uid}-msg`}
              rows={1}
              value={input}
              placeholder={`Ask about ${subject || "your homework"}`}
              onChange={(e) => {
                setInput(e.target.value);
                grow();
              }}
              onKeyDown={onKey}
            />
            <button type="submit" className="at-send" disabled={loading || !input.trim()} aria-label="Send message">
              <Icon name="send" size={20} />
            </button>
          </div>
          <p className="at-note">The AI Tutor can make mistakes. Check important answers with your teacher.</p>
        </form>
      </section>
    </div>
  );
}