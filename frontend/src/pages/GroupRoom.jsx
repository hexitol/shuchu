import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Copy, Users, Square, Globe, Lock, LogOut } from "lucide-react";
import { api, WS_BASE } from "@/lib/api";
import { formatHMS } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { MODES, modeMeta } from "@/pages/Timer";

export default function GroupRoom() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState("lecture");
  const [tick, setTick] = useState(0);
  const wsRef = useRef(null);

  const loadGroup = useCallback(async () => {
    try {
      const { data } = await api.get(`/groups/${id}`);
      setGroup(data);
      setMembers(data.members);
    } catch (e) {
      toast.error("Room not accessible");
      nav("/app/groups");
    }
  }, [id, nav]);

  const loadMyState = useCallback(async () => {
    const [subs, cur] = await Promise.all([api.get("/subjects"), api.get("/timer/current")]);
    setSubjects(subs.data);
    setSession(cur.data);
  }, []);

  useEffect(() => {
    loadGroup();
    loadMyState();
  }, [loadGroup, loadMyState]);

  // Ticker for live counter
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // WebSocket
  useEffect(() => {
    if (!user?.id || !id) return;
    const url = `${WS_BASE}/api/ws/group/${id}?user_id=${encodeURIComponent(user.id)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "members") setMembers(msg.members);
      } catch (e) {
        // ignore
      }
    };
    ws.onerror = () => {};
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 25000);
    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, [id, user?.id]);

  const startTimer = async (subject_id) => {
    try {
      const { data } = await api.post("/timer/start", { subject_id, mode, group_id: id });
      setSession(data);
    } catch (e) {
      toast.error("Failed to start");
    }
  };

  const stopTimer = async () => {
    try {
      await api.post("/timer/stop");
      setSession(null);
      toast.success("Session logged");
    } catch (e) {
      toast.error("Failed to stop");
    }
  };

  const leaveRoom = async () => {
    await api.post(`/groups/${id}/leave`);
    nav("/app/groups");
  };

  const copyCode = () => {
    if (group?.code) {
      navigator.clipboard.writeText(group.code);
      toast.success("Code copied");
    }
  };

  if (!group) {
    return <div className="p-10 text-white/40">Opening room...</div>;
  }

  const activeCount = members.filter((m) => m.is_studying).length;

  return (
    <div className="px-6 md:px-12 py-10 md:py-14 max-w-7xl mx-auto pb-32 md:pb-14">
      <button
        onClick={() => nav("/app/groups")}
        data-testid="back-groups-btn"
        className="text-white/50 hover:text-white/90 text-xs mb-6 flex items-center gap-1.5 transition-all"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> All rooms
      </button>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 md:mb-12">
        <div>
          <div className="flex items-center gap-2 mb-2 text-[10px] tracking-[0.3em] uppercase text-white/40">
            {group.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {group.is_public ? "Public room" : "Private room"}
          </div>
          <h1 className="font-serif-display text-4xl sm:text-5xl">{group.name}</h1>
          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={copyCode}
              data-testid="copy-code-btn"
              className="text-xs font-mono-timer tracking-[0.3em] text-white/60 hover:text-[#FF5B22] flex items-center gap-2 transition-all"
            >
              {group.code} <Copy className="w-3 h-3" />
            </button>
            <div className="text-xs text-white/40 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> {members.length} present · {activeCount} studying
            </div>
          </div>
        </div>
        <button
          onClick={leaveRoom}
          data-testid="leave-room-btn"
          className="text-xs text-white/40 hover:text-red-400 flex items-center gap-1.5 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" /> Leave
        </button>
      </div>

      {/* My controls */}
      <div className="glass rounded-3xl p-6 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">You</div>
            <div className="font-serif-display text-xl mt-1">
              {session ? (
                <>
                  <span style={{ color: "#FF5B22" }}>Studying</span> — {session.subject_name}
                </>
              ) : (
                <span className="text-white/60">Ready to focus</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!session ? (
              subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => startTimer(s.id)}
                  data-testid={`quick-start-${s.name}`}
                  className="rounded-full px-4 py-2 text-xs border border-white/10 hover:border-[#FF5B22]/60 hover:text-[#FF5B22] transition-all flex items-center gap-2 hover-lift"
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </button>
              ))
            ) : (
              <button
                onClick={stopTimer}
                data-testid="room-stop-btn"
                className="rounded-full px-5 py-2.5 text-xs bg-white/5 border border-white/15 hover:border-[#FF5B22]/60 flex items-center gap-2"
              >
                <Square className="w-3 h-3" fill="currentColor" /> End session
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Members grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <AnimatePresence>
          {members.map((m, i) => (
            <MemberCard key={m.user_id} m={m} isMe={m.user_id === user?.id} tick={tick} delay={i * 0.04} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MemberCard({ m, isMe, tick, delay }) {
  let elapsed = 0;
  if (m.is_studying && m.start_time) {
    elapsed = Math.max(0, Math.floor((Date.now() - new Date(m.start_time).getTime()) / 1000));
  }
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay, duration: 0.5 }}
      className={`glass rounded-2xl p-5 relative overflow-hidden`}
      style={m.is_studying ? { boxShadow: `0 0 32px ${(m.subject_color || "#FF5B22")}33, inset 0 1px 0 rgba(255,255,255,0.06)`, borderColor: `${m.subject_color || "#FF5B22"}66` } : {}}
    >
      {m.is_studying && (
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: `radial-gradient(200px 150px at 50% 20%, ${m.subject_color || "#FF5B22"}44, transparent 70%)`,
          }}
        />
      )}
      <div className="relative flex flex-col items-center text-center">
        <div
          className={`w-12 h-12 rounded-full border flex items-center justify-center text-lg font-mono-timer mb-3 ${m.is_studying ? "pulse-ring" : "border-white/10"}`}
          style={{
            color: m.is_studying ? (m.subject_color || "#FF5B22") : "#F0ECE0",
            borderColor: m.is_studying ? (m.subject_color || "#FF5B22") : undefined,
            "--pulse-color": `${m.subject_color || "#FF5B22"}88`,
          }}
        >
          {m.username?.[0]?.toUpperCase()}
        </div>
        <div className="text-sm truncate max-w-full">
          {m.username} {isMe && <span className="text-white/40 text-[10px] ml-1">(you)</span>}
        </div>
        {m.is_studying ? (
          <>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.subject_color }} />
              <span className="text-[10px] text-white/60 uppercase tracking-wider">{m.subject_name}</span>
            </div>
            {m.mode && (
              <div className="flex items-center gap-1 mt-1 text-[9px] uppercase tracking-[0.2em]" style={{ color: modeMeta(m.mode).tint }}>
                {(() => { const Icon = modeMeta(m.mode).icon; return <Icon className="w-2.5 h-2.5" />; })()}
                {modeMeta(m.mode).label}
              </div>
            )}
            <div className="font-mono-timer text-lg mt-2" style={{ color: m.subject_color || "#FF5B22" }} data-testid={`member-timer-${m.username}`}>
              {formatHMS(elapsed)}
            </div>
          </>
        ) : (
          <div className="text-[10px] text-white/30 uppercase tracking-[0.2em] mt-2">Idle</div>
        )}
      </div>
    </motion.div>
  );
}
