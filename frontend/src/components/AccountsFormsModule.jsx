"use client";

import AccountsGoogleGuard, { GoogleSessionButton } from "./AccountsGoogleGuard";
import AccountsRequestForms from "./AccountsRequestForms";

// The Forms sub-module under Finance. Same Google gate as Accounts — a person who cannot
// open the CRBR sheets cannot build forms that write into them either.
export default function AccountsFormsModule({ darkMode }) {
  const muted = darkMode ? "text-white/50" : "text-black/50";
  const panel = darkMode ? "border-transparent bg-[#15171c]" : "border-black/[0.06] bg-white";

  return (
    <AccountsGoogleGuard darkMode={darkMode} title="Forms">
      {({ gate, signOutGoogle }) => (
        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f4f5f8] text-[#171714]"}`}>
          <section className={`overflow-hidden rounded-[30px] border p-6 sm:p-8 ${panel}`}>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div className="min-w-0">
                <h1 className="small text-4xl font-black leading-none">Request forms</h1>
                <p className={`mt-3 max-w-2xl text-sm leading-6 ${muted}`}>
                  Build a form, share its link with anyone, and every response lands on its own tab in the sheet you
                  choose. Attachments are stored and linked automatically.
                </p>
                {!gate.canManage && (
                  <p className="mt-3 text-sm font-bold text-amber-500">
                    Your Google account can view the sheets but not edit them, so forms are read-only here.
                  </p>
                )}
              </div>
              <GoogleSessionButton gate={gate} onSignOut={signOutGoogle} darkMode={darkMode} />
            </div>
          </section>

          <AccountsRequestForms darkMode={darkMode} canManage={gate.canManage} />
        </main>
      )}
    </AccountsGoogleGuard>
  );
}
