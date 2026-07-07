import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Globe, Lock, Hash, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function GroupsPage() {
  const [publicGroups, setPublicGroups] = useState([]);
  const [mine, setMine] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const nav = useNavigate();

  const load = async () => {
    const [pub, m] = await Promise.all([api.get("/groups/public"), api.get("/groups/mine")]);
    setPublicGroups(pub.data);
    setMine(m.data);
  };

  useEffect(() => {
    load();
  }, []);

  const createGroup = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const { data } = await api.post("/groups", { name: newName.trim(), is_public: isPublic });
    setNewName("");
    setShowCreate(false);
    toast.success(`Group created — code ${data.code}`);
    nav(`/app/groups/${data.id}`);
  };

  const joinByCode = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      const { data } = await api.post("/groups/join", { code: joinCode.trim().toUpperCase() });
      setJoinCode("");
      setShowJoin(false);
      nav(`/app/groups/${data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to join");
    }
  };

  const enter = async (g) => {
    try {
      await api.post(`/groups/${g.id}/join`);
      nav(`/app/groups/${g.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Cannot join");
    }
  };

  return (
    <div className="px-6 md:px-12 py-10 md:py-14 max-w-7xl mx-auto pb-32 md:pb-14">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-14 gap-4"
      >
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2">Company</div>
          <h1 className="font-serif-display text-4xl sm:text-5xl">Study together</h1>
          <p className="text-white/50 mt-2 text-sm max-w-md">Rooms where the timers of others are visible. Presence is the point.</p>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="show-join-btn"
            onClick={() => {
              setShowJoin((v) => !v);
              setShowCreate(false);
            }}
            className="rounded-full px-5 py-2.5 text-sm border border-white/10 hover:border-[#FF5B22]/60 hover:text-[#FF5B22] transition-all"
          >
            <Hash className="w-3.5 h-3.5 inline mr-1.5" /> Join with code
          </button>
          <button
            data-testid="show-create-btn"
            onClick={() => {
              setShowCreate((v) => !v);
              setShowJoin(false);
            }}
            className="orange-btn rounded-full px-5 py-2.5 text-sm text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New room
          </button>
        </div>
      </motion.div>

      {showCreate && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          onSubmit={createGroup}
          className="glass rounded-3xl p-6 mb-8"
        >
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2">Create a room</div>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              data-testid="new-group-name-input"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Room name (e.g. Late night grind)"
              maxLength={40}
              className="flex-1 bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF5B22]/60"
            />
            <div className="flex bg-white/[0.03] border border-white/10 rounded-2xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                data-testid="toggle-public"
                className={`px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 ${
                  isPublic ? "bg-[#FF5B22] text-white" : "text-white/60"
                }`}
              >
                <Globe className="w-3 h-3" /> Public
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                data-testid="toggle-private"
                className={`px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 ${
                  !isPublic ? "bg-[#FF5B22] text-white" : "text-white/60"
                }`}
              >
                <Lock className="w-3 h-3" /> Private
              </button>
            </div>
            <button data-testid="create-group-btn" type="submit" className="orange-btn text-white text-sm rounded-2xl px-6 py-3">
              Create
            </button>
          </div>
        </motion.form>
      )}

      {showJoin && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          onSubmit={joinByCode}
          className="glass rounded-3xl p-6 mb-8"
        >
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2">Enter code</div>
          <div className="flex gap-3">
            <input
              data-testid="join-code-input"
              autoFocus
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              maxLength={6}
              className="flex-1 font-mono-timer tracking-[0.4em] text-lg bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-[#FF5B22]/60 uppercase"
            />
            <button data-testid="join-code-submit" type="submit" className="orange-btn text-white text-sm rounded-2xl px-6 py-3">
              Join
            </button>
          </div>
        </motion.form>
      )}

      {/* My rooms */}
      {mine.length > 0 && (
        <section className="mb-12">
          <h2 className="font-serif-display text-2xl mb-4">Your rooms</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mine.map((g, i) => (
              <GroupCard key={g.id} g={g} onEnter={enter} delay={i * 0.05} owned />
            ))}
          </div>
        </section>
      )}

      {/* Public */}
      <section>
        <h2 className="font-serif-display text-2xl mb-4">Open rooms</h2>
        {publicGroups.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center text-white/50 text-sm">No public rooms yet. Start the first one.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicGroups.map((g, i) => (
              <GroupCard key={g.id} g={g} onEnter={enter} delay={i * 0.05} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GroupCard({ g, onEnter, delay = 0, owned = false }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      onClick={() => onEnter(g)}
      data-testid={`group-card-${g.name}`}
      className="group text-left glass glass-hover rounded-3xl p-6 relative overflow-hidden"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center group-hover:border-[#FF5B22]/50 transition-all">
          {g.is_public ? <Globe className="w-4 h-4 text-white/60 group-hover:text-[#FF5B22]" /> : <Lock className="w-4 h-4 text-white/60 group-hover:text-[#FF5B22]" />}
        </div>
        <div className="text-[10px] tracking-[0.3em] uppercase text-white/30">{g.is_public ? "Public" : "Private"}</div>
      </div>
      <div className="font-serif-display text-2xl leading-tight mb-1">{g.name}</div>
      <div className="text-[11px] text-white/40 font-mono-timer tracking-wider mb-4">Code · {g.code}</div>
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Users className="w-3.5 h-3.5" /> {g.member_count} {g.member_count === 1 ? "member" : "members"}
        </div>
        <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center group-hover:border-[#FF5B22] group-hover:bg-[#FF5B22] transition-all">
          <ArrowRight className="w-3.5 h-3.5 text-white/60 group-hover:text-white" />
        </div>
      </div>
      {owned && (
        <div className="absolute top-3 right-3 text-[9px] tracking-[0.25em] uppercase text-[#FF5B22]/70">Yours</div>
      )}
    </motion.button>
  );
}
