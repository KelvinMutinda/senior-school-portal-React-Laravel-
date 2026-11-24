import { useMemo } from "react";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Input types: a small structural slice of the Analysis object.       */
/* Your existing `Analysis` type is assignable to ChartsInput as is.   */
/* ------------------------------------------------------------------ */

export type Lvl = "Exceeding" | "Meeting" | "Approaching" | "Below";
const LVLS: Lvl[] = ["Exceeding", "Meeting", "Approaching", "Below"];
const SHORT: Record<Lvl, string> = { Exceeding: "EE", Meeting: "ME", Approaching: "AE", Below: "BE" };

export const LEVEL_COLOR: Record<Lvl, string> = {
  Exceeding: "#1f9d6b",
  Meeting: "#2f6fdf",
  Approaching: "#e0a526",
  Below: "#d9534f",
};

interface BandIn { code: string; level: Lvl; min: number; count: number; pct: number }
type Levels = Record<Lvl, number>;

export interface ChartsInput {
  summary: {
    learners: number;
    withResults: number;
    mean: number | null;
    high: number | null;
    low: number | null;
    meetingRate: number | null;
    belowMeeting: number;
    meetingMark: number;
  };
  bands: BandIn[];
  grades: { label: string; mean: number | null; meetingRate: number | null; levels: Levels }[];
  streams: { label: string; mean: number | null }[];
  subjects: { name: string; mean: number | null }[];
  gender: { gender: string; mean: number | null }[];
  comparison: {
    current: { name: string };
    previous: { name: string };
    summary: { change: number; improved: number; declined: number; steady: number } | null;
    subjects: { name: string; change: number }[];
    streams: { label: string; change: number }[];
  } | null;
}

const isNum = (n: unknown): n is number => typeof n === "number" && !Number.isNaN(n);
const f1 = (n: number | null | undefined) => (isNum(n) ? (Math.round(n * 10) / 10).toFixed(1) : "–");
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}`;

export function levelAt(v: number, bands: BandIn[]): Lvl {
  return bands.find((b) => v >= b.min)?.level ?? "Below";
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Card({ title, note, children, wide }: { title: string; note?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`vc-card${wide ? " vc-wide" : ""}`}>
      <header>
        <h4>{title}</h4>
        {note ? <p>{note}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Ring({ value, color, label }: { value: number; color: string; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" role="img" aria-label={label}>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="vc-ring-bg" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
    </svg>
  );
}

function Kpi({ label, value, hint, ring }: { label: string; value: string; hint?: string; ring?: { value: number; color: string } }) {
  return (
    <div className="vc-kpi">
      <div>
        <span>{label}</span>
        <b>{value}</b>
        {hint ? <small>{hint}</small> : null}
      </div>
      {ring ? <Ring value={ring.value} color={ring.color} label={`${label}: ${value}`} /> : null}
    </div>
  );
}

/** Horizontal bars. Colour follows the performance level of the value. */
function HBars({ rows, bands, mark, max = 100 }: { rows: { label: string; value: number | null }[]; bands: BandIn[]; mark?: number; max?: number }) {
  if (!rows.length) return <p className="vc-empty">Nothing to show yet.</p>;
  return (
    <ul className="vc-hbars">
      {rows.map((r) => {
        const v = r.value;
        const w = isNum(v) ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
        const color = isNum(v) ? LEVEL_COLOR[levelAt(v, bands)] : "transparent";
        return (
          <li key={r.label} title={`${r.label}: ${f1(v)}%`}>
            <span className="vc-hb-l">{r.label}</span>
            <span className="vc-hb-t">
              <i style={{ width: `${w}%`, background: color }} />
              {mark !== undefined ? <b className="vc-mark" style={{ left: `${(mark / max) * 100}%` }} /> : null}
            </span>
            <span className="vc-hb-v">{f1(v)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Column chart in SVG. Scales to its container. */
function Columns({ rows, max, mark, unit = "" }: { rows: { label: string; value: number | null; color: string }[]; max: number; mark?: number; unit?: string }) {
  if (!rows.length) return <p className="vc-empty">Nothing to show yet.</p>;
  const W = 520, H = 250, L = 34, R = 8, T = 18, B = 30;
  const pw = W - L - R;
  const ph = H - T - B;
  const slot = pw / rows.length;
  const bw = Math.min(54, slot * 0.62);
  const y = (v: number) => T + ph * (1 - Math.min(v, max) / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t * 10) / 10);

  return (
    <svg className="vc-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Column chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="vc-grid" />
          <text x={L - 6} y={y(t) + 3} textAnchor="end" className="vc-tick">{t}{unit}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const cx = L + slot * i + slot / 2;
        const v = isNum(r.value) ? r.value : 0;
        const top = y(v);
        return (
          <g key={r.label}>
            <title>{`${r.label}: ${f1(r.value)}${unit}`}</title>
            <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(0, T + ph - top)} rx={4} fill={r.color} />
            <text x={cx} y={top - 6} textAnchor="middle" className="vc-val">{f1(r.value)}</text>
            <text x={cx} y={H - 10} textAnchor="middle" className="vc-tick">{r.label}</text>
          </g>
        );
      })}
      {mark !== undefined ? (
        <g>
          <line x1={L} x2={W - R} y1={y(mark)} y2={y(mark)} className="vc-markline" />
          <text x={W - R} y={y(mark) - 4} textAnchor="end" className="vc-marktext">meeting mark {mark}%</text>
        </g>
      ) : null}
    </svg>
  );
}

function Donut({ levels, centre, caption }: { levels: Levels; centre: string; caption: string }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="vc-donut">
      <svg viewBox="0 0 120 120" role="img" aria-label="Share of results at each performance level">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="16" className="vc-ring-bg" />
        {LVLS.map((l) => {
          const len = (levels[l] / 100) * c;
          const seg = (
            <circle key={l} cx="60" cy="60" r={r} fill="none" stroke={LEVEL_COLOR[l]} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 1)} ${c}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)">
              <title>{`${l}: ${levels[l].toFixed(1)}%`}</title>
            </circle>
          );
          offset += len;
          return seg;
        })}
        <text x="60" y="58" textAnchor="middle" className="vc-donut-n">{centre}</text>
        <text x="60" y="73" textAnchor="middle" className="vc-tick">{caption}</text>
      </svg>
      <ul>
        {LVLS.map((l) => (
          <li key={l}>
            <i style={{ background: LEVEL_COLOR[l] }} />
            <span>{l}</span>
            <b>{levels[l].toFixed(1)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StackedLevels({ rows }: { rows: { label: string; levels: Levels }[] }) {
  return (
    <>
      <ul className="vc-stack">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="vc-hb-l">{r.label}</span>
            <span className="vc-stack-bar" role="img" aria-label={LVLS.map((l) => `${l} ${r.levels[l].toFixed(1)}%`).join(", ")}>
              {LVLS.map((l) =>
                r.levels[l] > 0 ? (
                  <i key={l} style={{ width: `${r.levels[l]}%`, background: LEVEL_COLOR[l] }} title={`${l}: ${r.levels[l].toFixed(1)}%`}>
                    {r.levels[l] >= 9 ? Math.round(r.levels[l]) : ""}
                  </i>
                ) : null,
              )}
            </span>
          </li>
        ))}
      </ul>
      <Legend />
    </>
  );
}

function Legend() {
  return (
    <p className="vc-legend">
      {LVLS.map((l) => (
        <span key={l}>
          <i style={{ background: LEVEL_COLOR[l] }} />
          {SHORT[l]} {l}
        </span>
      ))}
    </p>
  );
}

/** Bars that go left (decline) or right (improvement) from a centre line. */
function Diverging({ rows }: { rows: { label: string; value: number }[] }) {
  if (!rows.length) return <p className="vc-empty">Nothing to show yet.</p>;
  const m = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="vc-div">
      {rows.map((r) => {
        const w = (Math.abs(r.value) / m) * 50;
        const up = r.value >= 0;
        return (
          <li key={r.label} title={`${r.label}: ${signed(r.value)} points`}>
            <span className="vc-hb-l">{r.label}</span>
            <span className="vc-div-t">
              <i className={up ? "up" : "down"} style={up ? { left: "50%", width: `${w}%` } : { left: `${50 - w}%`, width: `${w}%` }} />
            </span>
            <span className={`vc-hb-v ${r.value >= 1 ? "up" : r.value <= -1 ? "down" : ""}`}>{signed(r.value)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export function ChartsDashboard({ a }: { a: ChartsInput }) {
  const s = a.summary;
  const bands = a.bands;

  const overall = useMemo<Levels>(() => {
    const out: Levels = { Exceeding: 0, Meeting: 0, Approaching: 0, Below: 0 };
    bands.forEach((b) => (out[b.level] += b.pct));
    return out;
  }, [bands]);

  const gradeRows = a.grades.map((g) => ({ label: g.label, value: g.mean, color: isNum(g.mean) ? LEVEL_COLOR[levelAt(g.mean, bands)] : "#ccd3dd" }));
  const bandRows = [...bands].reverse().map((b) => ({ label: b.code, value: b.pct, color: LEVEL_COLOR[b.level] }));
  const bandMax = Math.max(10, Math.ceil(Math.max(...bands.map((b) => b.pct)) / 5) * 5);
  const meetPlus = overall.Exceeding + overall.Meeting;
  const c = a.comparison;

  return (
    <div className="vc-dash">
      <div className="vc-kpis">
        <Kpi label="Mean score" value={`${f1(s.mean)}%`} hint={`${s.withResults} of ${s.learners} learners`} ring={isNum(s.mean) ? { value: s.mean, color: LEVEL_COLOR[levelAt(s.mean, bands)] } : undefined} />
        <Kpi label="Meeting or above" value={`${f1(s.meetingRate)}%`} hint={`${s.meetingMark}% and over`} ring={isNum(s.meetingRate) ? { value: s.meetingRate, color: LEVEL_COLOR.Meeting } : undefined} />
        <Kpi label="Highest learner" value={`${f1(s.high)}%`} />
        <Kpi label="Lowest learner" value={`${f1(s.low)}%`} />
        <Kpi label={`Below ${s.meetingMark}%`} value={String(s.belowMeeting)} hint="learners needing support" />
        {c?.summary ? <Kpi label={`Change since ${c.previous.name}`} value={`${signed(c.summary.change)} pts`} hint={`${c.summary.improved} up · ${c.summary.declined} down`} /> : null}
      </div>

      <div className="vc-grid2">
        <Card title="Mean score by grade" note="Bar colour shows the performance level of the mean.">
          <Columns rows={gradeRows} max={100} mark={s.meetingMark} />
        </Card>
        <Card title="Performance levels" note="Share of every subject result.">
          <Donut levels={overall} centre={`${meetPlus.toFixed(0)}%`} caption="ME or better" />
        </Card>
      </div>

      {a.grades.length > 0 ? (
        <Card title="Levels in each grade" note="Each bar is 100% of that grade's subject results." wide>
          <StackedLevels rows={a.grades.map((g) => ({ label: g.label, levels: g.levels }))} />
        </Card>
      ) : null}

      <div className="vc-grid2">
        <Card title="Class ranking" note="Mean % per class. The dashed line is the meeting mark.">
          <HBars rows={a.streams.map((x) => ({ label: x.label, value: x.mean }))} bands={bands} mark={s.meetingMark} />
        </Card>
        <Card title="Subject ranking" note="Mean % per subject, strongest first.">
          <HBars rows={a.subjects.map((x) => ({ label: x.name, value: x.mean }))} bands={bands} mark={s.meetingMark} />
        </Card>
      </div>

      <div className="vc-grid2">
        <Card title="Grade bands (BE2 to EE1)" note="Percentage of results in each band.">
          <Columns rows={bandRows} max={bandMax} unit="%" />
        </Card>
        {a.gender.length > 1 ? (
          <Card title="Mean by gender">
            <HBars rows={a.gender.map((g) => ({ label: g.gender, value: g.mean }))} bands={bands} mark={s.meetingMark} />
          </Card>
        ) : null}
      </div>

      {c?.summary ? (
        <div className="vc-grid2">
          <Card title={`Change by subject`} note={`${c.current.name} compared with ${c.previous.name}, in percentage points.`}>
            <Diverging rows={c.subjects.map((x) => ({ label: x.name, value: x.change }))} />
          </Card>
          <Card title="Change by class" note="Learners with results in both exams.">
            <Diverging rows={c.streams.map((x) => ({ label: x.label, value: x.change }))} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}