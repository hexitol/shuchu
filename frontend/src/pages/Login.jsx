import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, Sun } from "lucide-react";

const BG_IMAGE =
  "https://images.unsplash.com/photo-1781966995939-3748dc1f1742?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxNzV8MHwxfHNlYXJjaHwxfHxkYXJrJTIwYW1iaWVudCUyMHN0dWR5JTIwZGVzayUyMGxhbXB8ZW58MHx8fHwxNzgzNDA0MjEwfDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setErr("");
    try {
      await login(username.trim());
      nav("/app/timer");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-6 overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `url(${BG_IMAGE})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(2px) brightness(0.5)",
        }}
      />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(700px 500px at 50% 40%, rgba(255,91,34,0.15), transparent 60%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 rounded-full flex items-center justify-center orange-btn">
            <Sun className="w-5 h-5 text-white" strokeWidth={2.4} />
          </div>
          <div className="font-serif-display text-4xl">Shūchū</div>
        </div>

        <div className="text-center mb-10">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.8 }}
            className="font-serif-display text-5xl sm:text-6xl leading-[0.95] mb-4"
          >
            Study slow,<br />
            <span style={{ color: "#FF5B22" }} className="italic accent-glow">grow deep.</span>
          </motion.h1>
          <p className="text-white/50 text-sm max-w-sm mx-auto">
            A quiet corner to track the hours you spend building yourself. Pick a name and step in.
          </p>
        </div>

        <form onSubmit={submit} className="glass rounded-3xl p-6 space-y-4">
          <div>
            <label className="text-[10px] tracking-[0.25em] uppercase text-white/40">Your name</label>
            <input
              autoFocus
              data-testid="login-username-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. astra"
              maxLength={30}
              className="mt-2 w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-lg text-[#F0ECE0] placeholder:text-white/25 focus:outline-none focus:border-[#FF5B22]/60 focus:ring-2 focus:ring-[#FF5B22]/20 transition-all"
            />
          </div>
          {err && <div className="text-xs text-red-400" data-testid="login-error">{err}</div>}
          <button
            type="submit"
            disabled={loading || !username.trim()}
            data-testid="login-submit-btn"
            className="w-full orange-btn text-white rounded-2xl py-4 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-sm tracking-wide">
              {loading ? "Opening the desk..." : "Enter the study"}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center mt-8 text-[10px] tracking-[0.3em] uppercase text-white/30">
          No password. No email. Just presence.
        </div>
      </motion.div>
    </div>
  );
}
