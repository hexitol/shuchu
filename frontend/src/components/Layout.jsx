import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { Timer, Users, CalendarDays, LogOut, Sun } from "lucide-react";

const nav = [
  { to: "/app/timer", label: "Timer", icon: Timer, testid: "nav-timer" },
  { to: "/app/groups", label: "Groups", icon: Users, testid: "nav-groups" },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays, testid: "nav-calendar" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col p-5 gap-6 border-r border-white/5 sticky top-0 h-screen">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center orange-btn">
            <Sun className="w-4 h-4 text-white" strokeWidth={2.4} />
          </div>
          <div>
            <div className="font-serif-display text-2xl leading-none">Shūchū</div>
            <div className="text-[10px] tracking-[0.25em] text-white/40 uppercase mt-1">Study Cadence</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 mt-4">
          {nav.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                data-testid={n.testid}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all border border-transparent ${
                    isActive
                      ? "bg-white/5 border-white/10 text-[#F0ECE0]"
                      : "text-white/50 hover:text-white/90 hover:bg-white/[0.03]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="w-4 h-4" strokeWidth={1.6} style={isActive ? { color: "#FF5B22" } : {}} />
                    <span className="text-sm">{n.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-dot"
                        className="ml-auto w-1.5 h-1.5 rounded-full"
                        style={{ background: "#FF5B22", boxShadow: "0 0 12px rgba(255,91,34,0.8)" }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="divider mb-4" />
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-mono-timer text-[#FF5B22]">
              {user?.username?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm truncate text-[#F0ECE0]" data-testid="sidebar-username">{user?.username}</div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-white/40">Learner</div>
            </div>
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/50 hover:text-[#FF5B22] hover:border-[#FF5B22]/50 transition-all"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top-nav */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-30 glass rounded-2xl p-2 flex items-center justify-around">
        {nav.map((n) => {
          const Icon = n.icon;
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl ${
                  isActive ? "text-[#FF5B22]" : "text-white/50"
                }`
              }
            >
              <Icon className="w-4 h-4" strokeWidth={1.6} />
              <span className="text-[10px]">{n.label}</span>
            </NavLink>
          );
        })}
      </div>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
