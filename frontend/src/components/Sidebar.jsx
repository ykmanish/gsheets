import { LayoutDashboard, FileText, Workflow, ChartNoAxesCombined, Sheet, ShieldCheck, Activity, MessageCircleMore, X, ClipboardList } from "lucide-react";
import Image from "next/image";

export default function Sidebar({ activeMenu, setActiveMenu, darkMode, allowedMenus = [], mobileOpen = false, setMobileOpen }) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "forms", label: "Forms", icon: ClipboardList },
    { id: "sheet-dashboard", label: "Sheet Dashboard", icon: Sheet },
    { id: "automations", label: "Automation", icon: Workflow },
    { id: "reports", label: "Reports", icon: ChartNoAxesCombined },
    { id: "activity-log", label: "Activity Log", icon: Activity },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircleMore },
    { id: "manage-roles", label: "Manage Roles", icon: ShieldCheck },
  ];
  const visibleMenuItems = menuItems.filter((item) => allowedMenus.includes(item.id));

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/35 transition-opacity duration-300 md:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setMobileOpen?.(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 transform flex-col transition-transform duration-300 md:static md:z-auto md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          darkMode
            ? "bg-[#0f1115] border-r border-white/10"
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
            className={`w-11 h-11 rounded-full flex items-center justify-center -sm `}
          >
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="h-10 w-10" />
          </div>
          <div>
            <h1
              className={`text-[20px]  small font-semibold  ${
                darkMode ? "text-white" : "text-black"
              }`}
              
            >
              UIPL Docs
            </h1>
            <p className={`text-xs  ${darkMode ? "text-white/45" : "text-black/40"}`}>
              AI document workspace
            </p>
          </div>
          <button
            onClick={() => setMobileOpen?.(false)}
            className={`ml-auto flex h-10 w-10 items-center justify-center rounded-full md:hidden ${darkMode ? "hover:bg-white/5 text-white/70" : "hover:bg-black/5 text-black/60"}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              className={`w-full newq flex items-center gap-3 rounded-2xl px-4 py-2 text-left transition-all duration-200 ${
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
              <span className="max-w-full truncate text-[15px]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-5">
  <div
    className={`rounded-3xl newq px-4 py-4 text-center  ${
      darkMode
        ? "bg-white/5 border-white/10"
        : "bg-black/[0.02] border-black/5"
    }`}
  >
    <p
      className={`text-sm  small  ${
        darkMode ? "text-white/40" : "text-black/35"
      }`}
    >
      Powered by AI
    </p>

    <div className="mt-3 flex items-center justify-center gap-3">
      <img
        src={darkMode ? "/whiteclaudelogo.svg" : "/blackclaudelogo.svg"}
        alt="Claude"
        className="h-7 w-auto"
      />

     
    </div>
  </div>
</div>
      </aside>
    </>
  );
}
