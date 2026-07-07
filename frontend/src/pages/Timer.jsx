import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Square, Plus, Check, Trash2, X, BookMarked } from "lucide-react";
import { api } from "@/lib/api";
import { formatHMS, formatHM } from "@/lib/format";
import { toast } from "sonner";

const COLORS = ["#FF5B22", "#C96442", "#E4A951", "#7EA172", "#5D9EA1", "#B084CC"];

export default function TimerPage() {
  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [session, setSession] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [today, setToday] = useState({ total_seconds: 0, by_subject: [] });
  const [newSubject, setNewSubject] = useState("");
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newTask, setNewTask] = useState("");
  const tickRef = useRef(null);

  const loadAll = useCallback(async () => {
    const [s, t, cur, tod] = await Promise.all([
      api.get("/subjects"),
      api.get("/tasks"),
      api.get("/timer/current"),
      api.get("/logs", { params: { range: "day" } }),
    ]);
    setSubjects(s.data);
    setTasks(t.data);
    setSession(cur.data);
    setToday(tod.data);
    if (cur.data) {
      setActiveSubjectId(cur.data.subject_id);
    } else if (s.data.length > 0) {
      setActiveSubjectId((prev) => prev || s.data[0].id);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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
    if (!activeSubjectId) {
      toast.error("Pick a subject first");
      return;
    }
    try {
      const { data } = await api.post("/timer/start", { subject_id: activeSubjectId });
      setSession(data);
      toast.success("Timer started");
    } catch (e) {
      toast.error("Failed to start");
    }
  };

  const stopTimer = async () => {
    try {
      await api.post("/timer/stop");
      setSession(null);
      const tod = await api.get("/logs", { params: { range: "day" } });
      setToday(tod.data);
      toast.success("Session logged");
    } catch (e) {
      toast.error("Failed to stop");
    }
  };

  const addSubject = async (e) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    const color = COLORS[subjects.length % COLORS.length];
    const { data } = await api.post("/subjects", { name: newSubject.trim(), color });
    setSubjects((s) => [...s, data]);
    setActiveSubjectId(data.id);
    setNewSubject("");
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

  const activeSubject = subjects.find((s) => s.id === activeSubjectId);
  const isRunning = !!session;
  const todayTotal = today.total_seconds + (isRunning ? elapsed : 0);

  const displayElapsed = useMemo(() => formatHMS(elapsed), [elapsed]);

  return (
    <div className="px-6 md:px-12 py-10 md:py-14 max-w-7xl mx-auto pb-32 md:pb-14">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-baseline justify-between mb-10 md:mb-14"
      >
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h1 className="font-serif-display text-4xl sm:text-5xl">The desk</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-1">Studied today</div>
          <div className="font-mono-timer text-2xl sm:text-3xl" style={{ color: "#FF5B22" }} data-testid="today-total">
            {formatHM(todayTotal)}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timer hero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7 }}
          className="lg:col-span-2 glass rounded-3xl p-8 md:p-12 relative overflow-hidden"
        >
          {isRunning && (
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                background: `radial-gradient(500px 300px at 50% 50%, ${activeSubject?.color || "#FF5B22"}22, transparent 60%)`,
              }}
            />
          )}
          <div className="relative flex flex-col items-center">
            <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2">
              {isRunning ? "In session" : "Ready"}
            </div>
            {activeSubject && (
              <div className="flex items-center gap-2 mb-6">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: activeSubject.color,
                    boxShadow: isRunning ? `0 0 12px ${activeSubject.color}` : "none",
                  }}
                />
                <span className="text-sm text-white/70" data-testid="active-subject-name">{activeSubject.name}</span>
              </div>
            )}
            <div
              data-testid="timer-display"
              className={`font-mono-timer font-light text-6xl sm:text-7xl md:text-8xl lg:text-[9rem] leading-none tracking-tighter ${
                isRunning ? "timer-breathe" : ""
              }`}
              style={{ color: isRunning ? "#FF5B22" : "#F0ECE0" }}
            >
              {displayElapsed}
            </div>

            <div className="mt-10 flex items-center gap-3">
              {!isRunning ? (
                <button
                  data-testid="start-timer-btn"
                  onClick={startTimer}
                  disabled={!activeSubjectId}
                  className="orange-btn text-white rounded-full px-8 py-4 flex items-center gap-3 disabled:opacity-40"
                >
                  <Play className="w-4 h-4" fill="white" />
                  <span className="text-sm tracking-wide">Begin session</span>
                </button>
              ) : (
                <button
                  data-testid="stop-timer-btn"
                  onClick={stopTimer}
                  className="rounded-full px-8 py-4 flex items-center gap-3 bg-white/5 border border-white/15 hover:border-[#FF5B22]/60 text-white transition-all hover-lift"
                >
                  <Square className="w-4 h-4" fill="currentColor" />
                  <span className="text-sm tracking-wide">End session</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Subject switcher */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="glass rounded-3xl p-6 flex flex-col"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Subjects</div>
              <h3 className="font-serif-display text-2xl mt-0.5">Switch focus</h3>
            </div>
            <button
              data-testid="add-subject-btn"
              onClick={() => setShowAddSubject((v) => !v)}
              className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-[#FF5B22] hover:border-[#FF5B22]/60 transition-all"
            >
              {showAddSubject ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>

          <AnimatePresence>
            {showAddSubject && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={addSubject}
                className="mb-4"
              >
                <div className="flex gap-2">
                  <input
                    data-testid="new-subject-input"
                    autoFocus
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="Subject name"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5B22]/60"
                  />
                  <button data-testid="save-subject-btn" type="submit" className="orange-btn rounded-xl px-3 text-white text-sm">
                    Add
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="space-y-2 overflow-y-auto flex-1">
            {subjects.length === 0 && (
              <div className="text-sm text-white/40 italic">No subjects yet.</div>
            )}
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
                    active
                      ? "border-[#FF5B22]/60 bg-white/[0.04]"
                      : "border-white/5 hover:border-white/15 bg-white/[0.02]"
                  } ${isRunning && !active ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      background: s.color,
                      boxShadow: active ? `0 0 14px ${s.color}` : "none",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#F0ECE0] truncate">{s.name}</div>
                    <div className="text-[10px] text-white/40 font-mono-timer mt-0.5">{formatHM(subjectTime)} today</div>
                  </div>
                  {!isRunning && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSubject(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="lg:col-span-2 glass rounded-3xl p-6 md:p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Plan</div>
              <h3 className="font-serif-display text-2xl mt-0.5">Today&apos;s list</h3>
            </div>
            <BookMarked className="w-5 h-5 text-white/30" />
          </div>

          <form onSubmit={addTask} className="flex gap-2 mb-5">
            <input
              data-testid="new-task-input"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="What will you tackle next?"
              className="flex-1 bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF5B22]/60"
            />
            <button
              data-testid="add-task-btn"
              type="submit"
              className="orange-btn rounded-2xl px-5 text-white text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>

          <div className="space-y-2">
            {tasks.length === 0 && (
              <div className="text-sm text-white/40 italic px-1">No tasks yet — write one above.</div>
            )}
            <AnimatePresence>
              {tasks.map((t, idx) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-white/[0.03] border border-transparent hover:border-white/10 transition-all"
                >
                  <button
                    data-testid={`task-toggle-${t.title}`}
                    onClick={() => toggleTask(t)}
                    className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center shrink-0 ${
                      t.done ? "bg-[#FF5B22] border-[#FF5B22]" : "border-white/25 hover:border-[#FF5B22]"
                    }`}
                  >
                    {t.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </button>
                  <div className={`flex-1 text-sm ${t.done ? "line-through text-white/30" : "text-[#F0ECE0]"}`}>
                    {t.title}
                  </div>
                  <button
                    onClick={() => deleteTask(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Today breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="glass rounded-3xl p-6"
        >
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Breakdown</div>
          <h3 className="font-serif-display text-2xl mt-0.5 mb-5">By subject</h3>
          <div className="space-y-4">
            {today.by_subject.length === 0 && (
              <div className="text-sm text-white/40 italic">Log a session to see your split.</div>
            )}
            {today.by_subject
              .sort((a, b) => b.duration_seconds - a.duration_seconds)
              .map((b) => {
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
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: b.subject_color }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
