import { Moon, Sun, User } from "lucide-react";

export default function Navbar({ darkMode, setDarkMode, activeMenu }) {
  const titles = {
    dashboard: "Dashboard",
    documents: "Documents",
    automations: "Automation",
    notifications: "Notifications",
    reports: "Reports",
    settings: "Settings",
  };
  return (
    <div
      className={`px-8 py-5 newq flex items-center justify-between transition-all duration-300 ${
        darkMode
          ? "bg-[#0f1115] border-b border-white/10"
          : "bg-white border-b border-black/5"
      }`}
      
    >
      <div>
        {/* <p
          className={`text-[11px] font-semibold uppercase tracking-[0.32em] mb-2 ${
            darkMode ? "text-white/45" : "text-black/35"
          }`}
        >
          {activeMenu === "dashboard" ? "Workspace" : "Library"}
        </p> */}
        <h2
          className={`text-2xl small  font-semibold leading-none ${
            darkMode ? "text-white" : "text-black"
          }`}
          
        >
          {titles[activeMenu] || "Workspace"}
        </h2>
        {/* <p
          className={`text-sm mt-2 ${
            darkMode ? "text-white/55" : "text-black/45"
          }`}
        >
          {activeMenu === "dashboard"
            ? "Chat with your documents"
            : "Manage your document library"}
        </p> */}
      </div>

      <div className="flex newq items-center gap-3">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
            darkMode
              ? "bg-white/10 text-[#d8f36a] hover:bg-white/15 border border-white/10"
              : "bg-black text-white hover:bg-black/85 border border-black/5"
          }`}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <button
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
            darkMode
              ? "bg-white/10 text-white/70 hover:bg-white/15 border border-white/10"
              : "bg-white text-black/70 hover:bg-black/5 border border-black/5"
          }`}
        >
          <User className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
