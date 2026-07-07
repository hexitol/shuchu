import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Play, Square, Plus, Check, Trash2, X, BookMarked, BookOpen, Zap, RotateCw, GripVertical, Flame } from "lucide-react";
import { api } from "@/lib/api";
import { formatHMS, formatHM } from "@/lib/format";
import { toast } from "sonner";

const COLORS = ["#FF5B22", "#C96442", "#E4A951", "#7EA172", "#5D9EA1", "#B084CC", "#E86A92", "#7BA7BC"];

export const MODES = [
  { key: "lecture", label: "Lecture", icon: BookOpen, tint: "#5D9EA1" },
  { key: "practice", label: "Practice", icon: Zap, tint: "#6BBF7A" },
  { key: "revision", label: "Revision", icon: RotateCw, tint: "#B084CC" },
];

export default function TimerPage() {
  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [mode, setMode] = useState("lecture");
  const [session, setSession] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [today, setToday] = useState({ total_seconds: 0, by_subject: [], by_mode: {} });
  const [streak, setStreak] = useState(0);
  const [newSubject, setNewSubject] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState(COLORS[0]);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newTask, setNewTask] = useState("");
  const tickRef = useRef(null);

  const loadAll = useCallback(async () => {
    const [s, t, cur, tod, st] = await Promise.all([
      api.get("/subjects"),
      api.get("/tasks"),
      api.get("/timer/current"),
      api.get("/logs", { params: { range: "day" } }),
      api.get("/stats"),
    ]);
    setSubjects(s.data);
    setTasks(t.data);
    setSession(cur.data);
    setToday(tod.data);
    setStreak(st.data.current_streak || 0);
    if (cur.data) {
      setActiveSubjectId(cur.data.subject_id);
      if (cur.data.mode) setMode(cur.data.mode);
    } else if (s.data.length > 0) {
      setActiveSubjectId((prev) => prev || s.data[0].id);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (session) {
      const start = new Date(session.start_time).getTime();
      const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
      update();
      tickRef.current = setInterval(update, 1000);
      return () => clearInterval(tickRef.current);
    } else {
      setElapsed(0);
    }
  }, [session]);

  const startTimer = async () => {
    if (!activeSubjectId) { toast.error("Pick a subject first"); return; }
    try {
      const { data } = await api.post("/timer/start", { subject_id: activeSubjectId, mode });
      setSession(data);
      toast.success(`${modeMeta(mode).label} session started`);
    } catch (e) { toast.error("Failed to start"); }
  };

  const stopTimer = async () => {
    try {
      await api.post("/timer/stop");
      setSession(null);
      const [tod, st] = await Promise.all([
        api.get("/logs", { params: { range: "day" } }),
        api.get("/stats"),
      ]);
      setToday(tod.data);
      setStreak(st.data.current_streak || 0);
      toast.success("Session logged");
    } catch (e) { toast.error("Failed to stop"); }
  };

  const addSubject = async (e) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    const { data } = await api.post("/subjects", { name: newSubject.trim(), color: newSubjectColor });
    setSubjects((s) => [...s, data]);
    setActiveSubjectId(data.id);
    setNewSubject("");
    setNewSubjectColor(COLORS[(subjects.length + 1) % COLORS.length]);
    setShowAddSubject(false);
  };

  const deleteSubject = async (id) => {
    await api.delete(`/subjects/${id}`);
    setSubjects((s) => s.filter((x) => x.id !== id));
    if (activeSubjectId === id) setActiveSubjectId(subjects[0]?.id || null);
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    const { data } = await api.post("/tasks", { title: newTask.trim(), subject_id: activeSubjectId });
    setTasks((t) => [data, ...t]);
    setNewTask("");
  };

  const toggleTask = async (t) => {
    const { data } = await api.patch(`/tasks/${t.id}`, { done: !t.done });
    setTasks((prev) => prev.map((x) => (x.id === t.id ? data : x)));
  };

  const deleteTask = async (id) => {
    await api.delete(`/tasks/${id}`);
    setTasks((t) => t.filter((x) => x.id !== id));
  };

  const handleReorder = (newOrder) => {
    setTasks(newOrder);
    // Persist debounced
    if (window.__reorderTimeout) clearTimeout(window.__reorderTimeout);
    window.__reorderTimeout = setTimeout(() => {
      api.post("/tasks/reorder", { ordered_ids: newOrder.map((t) => t.id) }).catch(() => {});
    }, 400);
  };

  const activeSubject = subjects.find((s) => s.id === activeSubjectId);
  const isRunning = !!session;
  const todayTotal = today.total_seconds + (isRunning ? elapsed : 0);
  const displayElapsed = useMemo(() => formatHMS(elapsed), [elapsed]);
  const currentMode = modeMeta(session?.mode || mode);
  const activeColor = activeSubject?.color || "#FF5B22";

  return (
    <div className="px-6 md:px-12 py-10 md:py-14 max-w-7xl mx-auto pb-32 md:pb-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="flex items-baseline justify-between mb-10 md:mb-14 gap-6 flex-wrap">
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h1 className="font-serif-display text-4xl sm:text-5xl">The desk</h1>
        </div>
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-2 glass rounded-full px-4 py-2"
            data-testid="streak-badge"
            title={`${streak} day streak`}
          >
            <Flame className="w-4 h-4" style={{ color: streak > 0 ? "#FF5B22" : "#A39E93", filter: streak > 0 ? "drop-shadow(0 0 6px rgba(255,91,34,0.7))" : "none" }} />
            <span className="font-mono-timer text-sm" style={{ color: streak > 0 ? "#FF5B22" : "#F0ECE0" }} data-testid="streak-count">{streak}</span>
            <span className="text-[10px] tracking-[0.2em] uppercase text-white/40">day{streak === 1 ? "" : "s"}</span>
          </motion.div>
          <div className="text-right">
            <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-1">Studied today</div>
            <div className="font-mono-timer text-2xl sm:text-3xl" style={{ color: "#FF5B22" }} data-testid="today-total">{formatHM(todayTotal)}</div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timer hero */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="lg:col-span-2 glass rounded-3xl p-8 md:p-12 relative overflow-hidden">
          {isRunning && (
            <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: `radial-gradient(500px 300px at 50% 50%, ${activeColor}22, transparent 60%)` }} />
          )}
          <div className="relative flex flex-col items-center">
            <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-3">{isRunning ? "In session" : "Ready"}</div>

            {/* Mode selector */}
            <div className="flex gap-1 glass rounded-full p-1 mb-5" data-testid="mode-selector">
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = (session?.mode || mode) === m.key;
                return (
                  <button
                    key={m.key}
                    disabled={isRunning}
                    onClick={() => setMode(m.key)}
                    data-testid={`mode-${m.key}`}
                    className={`px-4 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all ${
                      active ? "text-white" : "text-white/50 hover:text-white/80"
                    } ${isRunning && !active ? "opacity-30 cursor-not-allowed" : ""}`}
                    style={active ? { background: m.tint, boxShadow: `0 0 18px ${m.tint}66` } : {}}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>

            {activeSubject && (
              <div className="flex items-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full" style={{ background: activeColor, boxShadow: isRunning ? `0 0 12px ${activeColor}` : "none" }} />
                <span className="text-sm text-white/70" data-testid="active-subject-name">{activeSubject.name}</span>
              </div>
            )}

            <div
              data-testid="timer-display"
              className={`font-mono-timer font-light text-6xl sm:text-7xl md:text-8xl lg:text-[9rem] leading-none tracking-tighter ${isRunning ? "timer-breathe" : ""}`}
              style={{
                color: isRunning ? activeColor : "#F0ECE0",
                "--glow-color": `${activeColor}88`,
              }}
            >
              {displayElapsed}
            </div>

            <div className="mt-10 flex items-center gap-3">
              {!isRunning ? (
                <button data-testid="start-timer-btn" onClick={startTimer} disabled={!activeSubjectId} className="orange-btn text-white rounded-full px-8 py-4 flex items-center gap-3 disabled:opacity-40">
                  <Play className="w-4 h-4" fill="white" />
                  <span className="text-sm tracking-wide">Begin {currentMode.label.toLowerCase()}</span>
                </button>
              ) : (
                <button data-testid="stop-timer-btn" onClick={stopTimer} className="rounded-full px-8 py-4 flex items-center gap-3 bg-white/5 border border-white/15 hover:border-[#FF5B22]/60 text-white transition-all hover-lift">
                  <Square className="w-4 h-4" fill="currentColor" />
                  <span className="text-sm tracking-wide">End session</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Subjects */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="glass rounded-3xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Subjects</div>
              <h3 className="font-serif-display text-2xl mt-0.5">Switch focus</h3>
            </div>
            <button data-testid="add-subject-btn" onClick={() => setShowAddSubject((v) => !v)} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-[#FF5B22] hover:border-[#FF5B22]/60 transition-all">
              {showAddSubject ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>

          <AnimatePresence>
            {showAddSubject && (
              <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} onSubmit={addSubject} className="mb-4 space-y-2">
                <input data-testid="new-subject-input" autoFocus value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Subject name" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5B22]/60" />
                <div className="flex flex-wrap gap-2" data-testid="color-palette">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewSubjectColor(c)}
                      data-testid={`color-${c}`}
                      className={`w-6 h-6 rounded-full transition-all ${newSubjectColor === c ? "ring-2 ring-white/50 scale-110" : "ring-1 ring-white/10 hover:scale-110"}`}
                      style={{ background: c, boxShadow: newSubjectColor === c ? `0 0 12px ${c}` : "none" }}
                    />
                  ))}
                </div>
                <button data-testid="save-subject-btn" type="submit" className="orange-btn rounded-xl w-full py-2 text-white text-sm">Add subject</button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="space-y-2 overflow-y-auto flex-1">
            {subjects.length === 0 && <div className="text-sm text-white/40 italic">No subjects yet.</div>}
            {subjects.map((s) => {
              const active = s.id === activeSubjectId;
              const subjectTime = today.by_subject.find((x) => x.subject_id === s.id)?.duration_seconds || 0;
              return (
                <button
                  key={s.id}
                  data-testid={`subject-${s.name}`}
                  onClick={() => !isRunning && setActiveSubjectId(s.id)}
                  disabled={isRunning}
                  className={`group w-full text-left rounded-2xl p-3 border transition-all flex items-center gap-3 ${
                    active ? "bg-white/[0.04]" : "border-white/5 hover:border-white/15 bg-white/[0.02]"
                  } ${isRunning && !active ? "opacity-40 cursor-not-allowed" : ""}`}
                  style={active ? { borderColor: `${s.color}99`, boxShadow: `0 0 20px ${s.color}22` } : {}}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color, boxShadow: active ? `0 0 14px ${s.color}` : "none" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#F0ECE0] truncate">{s.name}</div>
                    <div className="text-[10px] text-white/40 font-mono-timer mt-0.5">{formatHM(subjectTime)} today</div>
                  </div>
                  {!isRunning && (
                    <span onClick={(e) => { e.stopPropagation(); deleteSubject(s.id); }} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Tasks — draggable */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="lg:col-span-2 glass rounded-3xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Plan · drag to prioritize</div>
              <h3 className="font-serif-display text-2xl mt-0.5">Today&apos;s list</h3>
            </div>
            <BookMarked className="w-5 h-5 text-white/30" />
          </div>

          <form onSubmit={addTask} className="flex gap-2 mb-5">
            <input data-testid="new-task-input" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="What will you tackle next?" className="flex-1 bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF5B22]/60" />
            <button data-testid="add-task-btn" type="submit" className="orange-btn rounded-2xl px-5 text-white text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>

          {tasks.length === 0 ? (
            <div className="text-sm text-white/40 italic px-1">No tasks yet — write one above.</div>
          ) : (
            <Reorder.Group axis="y" values={tasks} onReorder={handleReorder} className="space-y-1.5" data-testid="task-list">
              {tasks.map((t) => {
                const subj = subjects.find((s) => s.id === t.subject_id);
                return (
                  <Reorder.Item
                    key={t.id}
                    value={t}
                    data-testid={`task-item-${t.title}`}
                    className="group flex items-center gap-3 py-3 px-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.04] transition-all cursor-grab active:cursor-grabbing"
                    whileDrag={{ scale: 1.02, boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 0 24px rgba(255,91,34,0.25)", borderColor: "rgba(255,91,34,0.6)" }}
                  >
                    <GripVertical className="w-4 h-4 text-white/25 group-hover:text-white/50 shrink-0" />
                    {subj && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: subj.color }} />}
                    <button
                      data-testid={`task-toggle-${t.title}`}
                      onClick={() => toggleTask(t)}
                      className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center shrink-0 ${t.done ? "bg-[#FF5B22] border-[#FF5B22]" : "border-white/25 hover:border-[#FF5B22]"}`}
                    >
                      {t.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </button>
                    <div className={`flex-1 text-sm ${t.done ? "line-through text-white/30" : "text-[#F0ECE0]"}`}>{t.title}</div>
                    <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          )}
        </motion.div>

        {/* Breakdown */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="glass rounded-3xl p-6">
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Breakdown</div>
          <h3 className="font-serif-display text-2xl mt-0.5 mb-5">By subject</h3>
          <div className="space-y-4">
            {today.by_subject.length === 0 && <div className="text-sm text-white/40 italic">Log a session to see your split.</div>}
            {today.by_subject.sort((a, b) => b.duration_seconds - a.duration_seconds).map((b) => {
              const pct = todayTotal > 0 ? (b.duration_seconds / todayTotal) * 100 : 0;
              return (
                <div key={b.subject_id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: b.subject_color }} />
                      <span className="text-sm text-[#F0ECE0]">{b.subject_name}</span>
                    </div>
                    <span className="text-xs font-mono-timer text-white/60">{formatHM(b.duration_seconds)}</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full rounded-full" style={{ background: b.subject_color }} />
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(today.by_mode || {}).length > 0 && (
            <>
              <div className="divider my-5" />
              <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-3">By mode</div>
              <div className="space-y-2">
                {MODES.map((m) => {
                  const secs = today.by_mode?.[m.key] || 0;
                  if (secs === 0) return null;
                  const Icon = m.icon;
                  return (
                    <div key={m.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Icon className="w-3.5 h-3.5" style={{ color: m.tint }} />
                        <span>{m.label}</span>
                      </div>
                      <span className="text-xs font-mono-timer text-white/60">{formatHM(secs)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export function modeMeta(key) {
  return MODES.find((m) => m.key === key) || MODES[0];
}
