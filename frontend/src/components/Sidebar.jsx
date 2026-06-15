import { LayoutDashboard, FileText, Database, Settings, Workflow, ChartNoAxesCombined, Bell } from "lucide-react";

export default function Sidebar({ activeMenu, setActiveMenu, darkMode }) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "automations", label: "Automation", icon: Workflow },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "reports", label: "Reports", icon: ChartNoAxesCombined },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div
      className={`w-72 flex flex-col transition-all duration-300 ${
        darkMode
          ? "bg-[#0f1115] border-r border-white/5"
          : "bg-white border-r border-black/5"
      }`}
      style={{
        fontFamily:
          '"Google Sans", "Product Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center -sm ${
              darkMode ? "bg-[#d8f36a]" : "bg-black"
            }`}
          >
            <Database className={`w-5 h-5 ${darkMode ? "text-black" : "text-white"}`} />
          </div>
          <div>
            <h1
              className={`text-[20px]  small font-semibold  ${
                darkMode ? "text-white" : "text-black"
              }`}
              
            >
              VectorDocs
            </h1>
            <p className={`text-xs  ${darkMode ? "text-white/45" : "text-black/40"}`}>
              AI document workspace
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              className={`w-full  newq flex items-center gap-3 px-4 py-2 rounded-2xl transition-all duration-200 text-left ${
                isActive
                  ? darkMode
                    ? "bg-white/10 text-white -sm  border-white/10"
                    : "bg-black text-white -sm  border-black"
                  : darkMode
                  ? "text-white/55 hover:bg-white/5 hover:text-white border border-transparent"
                  : "text-black/55 hover:bg-black/5 hover:text-black border border-transparent"
              }`}
            >
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  isActive
                    ? darkMode
                      ? "bg-[#d8f36a] text-black"
                      : "bg-white/10 text-white"
                    : darkMode
                    ? "bg-white/5"
                    : "bg-black/5"
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
              </span>
              <span className=" text-[15px]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-5">
        <div
          className={`rounded-3xl newq px-4 py-4 text-center border ${
            darkMode
              ? "bg-white/5 border-white/10"
              : "bg-black/[0.02] border-black/5"
          }`}
        >
          <p className={`text-[11px] uppercase tracking-[0.28em] ${darkMode ? "text-white/40" : "text-black/35"}`}>
            Powered by AI
          </p>
          <p className={`mt-2 text-sm font-medium ${darkMode ? "text-white/80" : "text-black/70"}`}>
            Groq & Transformers
          </p>
        </div>
      </div>
    </div>
  );
}
