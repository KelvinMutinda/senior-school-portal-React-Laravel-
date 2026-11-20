import { useSyncExternalStore } from "react";


type Kind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: Kind;
  title: string;
  message?: string;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => items;

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(kind: Kind, title: string, message?: string, ms?: number) {
  const id = nextId++;
  items = [...items, { id, kind, title, message }].slice(-4); // keep at most 4 on screen
  emit();
  window.setTimeout(() => dismiss(id), ms ?? (kind === "error" ? 8000 : 5000));
  return id;
}

export const toast = {
  success: (title: string, message?: string) => push("success", title, message),
  error: (title: string, message?: string) => push("error", title, message),
  info: (title: string, message?: string) => push("info", title, message),
  dismiss,
};

const ICONS: Record<Kind, string> = {
  success: "M5 12.5l4.5 4.5L19 7.5",
  error: "M6 6l12 12M18 6L6 18",
  info: "M12 8h.01M11 12h1v5h1",
};

export function Toaster() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);

  return (
    <div className="ss-toasts" aria-live="polite" aria-relevant="additions">
      {list.map((t) => (
        <div key={t.id} className={`ss-toast is-${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
          <span className="ss-toast-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICONS[t.kind]} />
            </svg>
          </span>
          <div className="ss-toast-body">
            <strong>{t.title}</strong>
            {t.message ? <p>{t.message}</p> : null}
          </div>
          <button type="button" className="ss-toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}