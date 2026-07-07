import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { formatHM, formatHMS } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";

const RANGES = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export default function CalendarPage() {
  const [range, setRange] = useState("week");
  const [ref, setRef] = useState(new Date());
  const [data, setData] = useState({ total_seconds: 0, by_subject: [], by_day: {}, logs: [] });

  const load = useCallback(async () => {
    const dateStr = ref.toISOString();
    const { data } = await api.get("/logs", { params: { range, date: dateStr } });
    setData(data);
  }, [range, ref]);

  useEffect(() => {
    load();
  }, [load]);

  const shift = (delta) => {
    const next = new Date(ref);
    if (range === "day") next.setDate(next.getDate() + delta);
    if (range === "week") next.setDate(next.getDate() + delta * 7);
    if (range === "month") next.setMonth(next.getMonth() + delta);
    setRef(next);
  };

  const label = useMemo(() => {
    if (range === "day") return ref.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    if (range === "month") return ref.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    // week
    const start = new Date(ref);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }, [range, ref]);

  return (
    <div className="px-6 md:px-12 py-10 md:py-14 max-w-7xl mx-auto pb-32 md:pb-14">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-10 md:mb-14"
      >
        <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2">Records</div>
        <h1 className="font-serif-display text-4xl sm:text-5xl">The archive</h1>
        <p className="text-white/50 mt-2 text-sm max-w-md">Every logged hour, mapped in warmth.</p>
      </motion.div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-2 glass rounded-full p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              data-testid={`range-${r.key}`}
              className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                range === r.key ? "bg-[#FF5B22] text-white" : "text-white/60 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => shift(-1)}
            data-testid="prev-range-btn"
            className="w-9 h-9 rounded-full border border-white/10 hover:border-[#FF5B22]/60 flex items-center justify-center transition-all"
          >
            <ChevronLeft className="w-4 h-4 text-white/70" />
          </button>
          <div className="font-serif-display text-xl min-w-[220px] text-center" data-testid="range-label">{label}</div>
          <button
            onClick={() => shift(1)}
            data-testid="next-range-btn"
            className="w-9 h-9 rounded-full border border-white/10 hover:border-[#FF5B22]/60 flex items-center justify-center transition-all"
          >
            <ChevronRight className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* Summary */}
      <motion.div
        key={range + ref.toISOString()}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
      >
        <div className="glass rounded-3xl p-8 lg:col-span-1">
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Total</div>
          <div className="font-mono-timer text-5xl mt-3" style={{ color: "#FF5B22" }} data-testid="range-total">
            {formatHM(data.total_seconds)}
          </div>
          <div className="text-xs text-white/40 mt-2 uppercase tracking-wider">
            {data.logs.length} sessions
          </div>
          <div className="divider my-6" />
          <div className="space-y-3">
            {data.by_subject
              .sort((a, b) => b.duration_seconds - a.duration_seconds)
              .map((b) => {
                const pct = data.total_seconds > 0 ? (b.duration_seconds / data.total_seconds) * 100 : 0;
                return (
                  <div key={b.subject_id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: b.subject_color }} />
                        <span className="text-sm">{b.subject_name}</span>
                      </div>
                      <span className="text-xs font-mono-timer text-white/60">{formatHM(b.duration_seconds)}</span>
                    </div>
                    <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.subject_color }} />
                    </div>
                  </div>
                );
              })}
            {data.by_subject.length === 0 && <div className="text-sm text-white/40 italic">Nothing logged yet.</div>}
          </div>
        </div>

        <div className="glass rounded-3xl p-8 lg:col-span-2">
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-4">Heatmap</div>
          <Heatmap byDay={data.by_day} ref_={ref} range={range} />
        </div>
      </motion.div>

      {/* Sessions list */}
      <div className="glass rounded-3xl p-6 md:p-8">
        <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-4">Sessions</div>
        {data.logs.length === 0 ? (
          <div className="text-white/40 text-sm italic">No sessions in this window.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {data.logs.map((l) => {
              const startDt = new Date(l.start_time);
              return (
                <div key={l.id} className="py-3 flex items-center gap-4">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.subject_color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{l.subject_name}</div>
                    <div className="text-[11px] text-white/40 font-mono-timer">
                      {startDt.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {startDt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="font-mono-timer text-sm" style={{ color: "#FF5B22" }}>{formatHMS(l.duration_seconds)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Heatmap({ byDay, ref_, range }) {
  // Build ~90-day heatmap ending at ref
  const days = 91;
  const cells = [];
  const end = new Date(ref_);
  end.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: d, key, seconds: byDay[key] || 0 });
  }

  const max = Math.max(3600, ...cells.map((c) => c.seconds));
  const intensity = (s) => {
    if (s <= 0) return 0;
    const r = s / max;
    if (r > 0.66) return 4;
    if (r > 0.33) return 3;
    if (r > 0.1) return 2;
    return 1;
  };
  const bg = ["rgba(255,255,255,0.03)", "rgba(255,91,34,0.15)", "rgba(255,91,34,0.35)", "rgba(255,91,34,0.6)", "rgba(255,91,34,0.9)"];

  // Group by weeks
  const weeks = [];
  let currentWeek = [];
  cells.forEach((c) => {
    if (currentWeek.length === 0 && c.date.getDay() !== 1) {
      // pad to start on Monday
      const pad = (c.date.getDay() + 6) % 7;
      for (let p = 0; p < pad; p++) currentWeek.push(null);
    }
    currentWeek.push(c);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto no-scrollbar pb-2">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {w.map((c, di) => (
              <div
                key={di}
                title={c ? `${c.key} · ${formatHM(c.seconds)}` : ""}
                data-testid={c ? `heat-${c.key}` : undefined}
                className="w-3.5 h-3.5 rounded-[3px] hover:scale-125 transition-transform"
                style={{
                  background: c ? bg[intensity(c.seconds)] : "transparent",
                  boxShadow: c && c.seconds > 0 ? `0 0 8px ${bg[intensity(c.seconds)]}` : "none",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-4 text-[10px] tracking-[0.2em] uppercase text-white/40">
        Less
        {bg.map((b, i) => (
          <div key={i} className="w-3 h-3 rounded-[3px]" style={{ background: b }} />
        ))}
        More
      </div>
    </div>
  );
}
