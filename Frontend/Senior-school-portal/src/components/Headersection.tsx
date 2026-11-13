import { useEffect, useRef, useState } from "react";

/* ==========================================================================
   HeaderSection - reusable top bar for every role (HOI, Deputy, Teacher,
   Finance, ...). It has no role logic: the page decides the title, the
   primary action and the user shown. Colours come from the CSS variables
   defined on .ss-shell in HoiDashboard.tsx (with fallbacks below).
   ========================================================================== */

export type Theme = "light" | "dark";

export interface HeaderUser {
  name: string;
  roleLabel: string;
  avatarUrl?: string;
}

export interface HeaderAction {
  label: string;
  onClick: () => void;
  icon?: IconName;
}

export interface HeaderSectionProps {
  title: string;
  subtitle?: string; // defaults to today's date
  user: HeaderUser;
  theme: Theme;
  onToggleTheme: () => void;
  onMenuClick?: () => void; // opens the sidebar drawer on mobile
  primaryAction?: HeaderAction;
  notifications?: number;
  onNotificationsClick?: () => void;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onProfile?: () => void;
  onLogout?: () => void;
}

/* ---------- Icons ---------- */

const PATHS = {
  menu: "M3 6h18 M3 12h18 M3 18h18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14 M21 21l-4.3-4.3",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10 M12 1v2 M12 21v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M1 12h2 M21 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  upload: "M12 16V4 M7 9l5-5 5 5 M4 20h16",
  check: "M20 6L9 17l-5-5",
  plus: "M12 5v14 M5 12h14",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z M15 9a4 4 0 0 1 0 6",
  wallet: "M3 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 7l2-3h12 M16 14h2",
  pen: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
} as const;

export type IconName = keyof typeof PATHS;

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ---------- Component ---------- */

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

function HeaderSection({
  title, subtitle, user, theme, onToggleTheme, onMenuClick, primaryAction,
  notifications = 0, onNotificationsClick, searchPlaceholder = "Search learners, staff, records...",
  onSearch, onProfile, onLogout,
}: HeaderSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // "/" focuses search, Escape closes the user menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  return (
    <header className="ss-header">
      

      <button type="button" className="ss-h-icon ss-h-burger" onClick={onMenuClick} aria-label="Open menu">
        <Icon name="menu" />
      </button>

      <div className="ss-h-title">
        <h1>{title}</h1>
        <span>{subtitle ?? today}</span>
      </div>

      <form
        className="ss-h-search"
        role="search"
        onSubmit={(e) => { e.preventDefault(); onSearch?.(query.trim()); }}
      >
        <Icon name="search" size={16} />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Global search"
        />
        <kbd>/</kbd>
      </form>

      <div className="ss-h-actions">
        {primaryAction && (
          <button type="button" className="ss-h-primary" onClick={primaryAction.onClick}>
            <Icon name={primaryAction.icon ?? "plus"} size={16} />
            <span>{primaryAction.label}</span>
          </button>
        )}

        <button type="button" className="ss-h-icon" onClick={onNotificationsClick} aria-label={`Notifications${notifications ? `, ${notifications} unread` : ""}`}>
          <Icon name="bell" />
          {notifications > 0 && <b className="ss-h-dot">{notifications > 99 ? "99+" : notifications}</b>}
        </button>

        <button type="button" className="ss-h-icon" onClick={onToggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>

        <div className="ss-h-user" ref={userRef}>
          <button type="button" className="ss-h-userbtn" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen}>
            <span className="ss-h-avatar">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.name)}
            </span>
            <span className="ss-h-who">
              <strong>{user.name}</strong>
              <small>{user.roleLabel}</small>
            </span>
          </button>
          {menuOpen && (
            <div className="ss-h-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onProfile?.(); }}>
                <Icon name="user" size={16} /> My profile
              </button>
              <button type="button" role="menuitem" className="ss-h-danger" onClick={() => { setMenuOpen(false); onLogout?.(); }}>
                <Icon name="logout" size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default HeaderSection;

