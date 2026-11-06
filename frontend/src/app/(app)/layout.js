import AppShell from "@/components/AppShell";

// Sidebar, navbar, session and Loop live here, so they stay put while pages change
// underneath them: only the module below the navbar is swapped.
export default function AppLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
