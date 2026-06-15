"use client";

import { useState } from "react";
import { Toaster } from "react-hot-toast";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import Dashboard from "../components/Dashboard";
import Documents from "../components/Documents";
import Automations from "../components/Automations";
import Reports from "../components/Reports";
import Notifications from "../components/Notifications";

export default function App() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState([]);

  return (
    <div className={`flex newq h-screen ${darkMode ? "dark" : ""}`}>
      <Toaster position="top-right" />
      <Sidebar 
        activeMenu={activeMenu} 
        setActiveMenu={setActiveMenu} 
        darkMode={darkMode}
      />
      <div className="flex-1 newq flex flex-col overflow-hidden">
        <Navbar 
          darkMode={darkMode} 
          setDarkMode={setDarkMode}
          activeMenu={activeMenu}
        />
        {activeMenu === "dashboard" && (
          <Dashboard 
            darkMode={darkMode} 
            selectedDocs={selectedDocs}
            setSelectedDocs={setSelectedDocs}
          />
        )}
        {activeMenu === "documents" && (
          <Documents 
            darkMode={darkMode}
            selectedDocs={selectedDocs}
            setSelectedDocs={setSelectedDocs}
          />
        )}
        {activeMenu === "automations" && <Automations darkMode={darkMode} />}
        {activeMenu === "reports" && <Reports darkMode={darkMode} />}
        {activeMenu === "notifications" && <Notifications darkMode={darkMode} />}
      </div>
    </div>
  );
}
