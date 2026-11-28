"use client";

import { ClipboardList, Eye } from "lucide-react";
import AccountsGoogleGuard, { GoogleSessionButton, financePage } from "./AccountsGoogleGuard";
import AccountsRequestForms from "./AccountsRequestForms";
import { Notice, PageHeader } from "./ui";

// The Forms sub-module under Finance. Same Google gate as Accounts — a person who cannot
// open the CRBR sheets cannot build forms that write into them either.
export default function AccountsFormsModule({ darkMode }) {
  return (
    <AccountsGoogleGuard darkMode={darkMode} title="Forms">
      {({ gate, signOutGoogle }) => (
        <main className={financePage(darkMode)}>
          <div className="mx-auto max-w-[1400px]">
            <PageHeader
              darkMode={darkMode}
              badge="Finance · forms"
              badgeIcon={ClipboardList}
              badgeTone="lavender"
              title="Request forms"
              subtitle="every response lands in a sheet"
              description="Build a form, share its link with anyone, and every response lands on its own tab in the sheet you choose. Attachments are stored and linked automatically."
              actions={<GoogleSessionButton gate={gate} onSignOut={signOutGoogle} darkMode={darkMode} />}
            />
            {!gate.canManage && (
              <Notice tone="amber" darkMode={darkMode} icon={Eye} className="mt-5 max-w-2xl">
                Your Google account can view the sheets but not edit them, so forms are read-only here.
              </Notice>
            )}

            <AccountsRequestForms darkMode={darkMode} canManage={gate.canManage} />
          </div>
        </main>
      )}
    </AccountsGoogleGuard>
  );
}
