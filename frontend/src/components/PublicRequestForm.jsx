"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheckBig, ClipboardList, Info, Link2Off, Loader2, Paperclip, Send, Ticket, TriangleAlert, X } from "lucide-react";
import { API_URL } from "./AuthProvider";
import { Badge, Button, DateInput, IconTile, Notice, Select, SectionTitle } from "./ui";

// The shareable side of an accounts request form. Deliberately standalone: no sidebar,
// no auth provider, nothing that assumes a signed-in raga user — a link recipient may
// have no account at all.

const PAGE = "newq min-h-screen bg-white px-4 py-8 text-[#141414] sm:px-6 sm:py-14";
const SHEET = "mx-auto w-full max-w-3xl rounded-[24px] border border-[#ececec] bg-white";
const RULE = "border-t border-[#f0f0ee]";

function Shell({ children }) {
  return <main className={PAGE}><div className={SHEET}>{children}</div></main>;
}

// Every dead end — used link, cancelled link, closed form — lands here rather than on a
// bare error string, so a recipient always knows whether to ask for a new link.
function Message({ icon: Icon, title, children, tone = "neutral" }) {
  return (
    <Shell>
      <div className="flex flex-col items-center px-8 py-14 text-center sm:px-14">
        <IconTile icon={Icon} tone={tone} size="lg" />
        <h1 className="mt-6 text-[26px] leading-tight tracking-[-0.02em]">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-6 text-[#8a8a8a]">{children}</p>
      </div>
    </Shell>
  );
}

// Short answers sit two to a row like the reference; anything that needs space gets its own.
function isWide(field) {
  return field.type === "textarea" || field.type === "file" || field.allowAttachment;
}

export default function PublicRequestForm({ slug }) {
  const [form, setForm] = useState(null);
  const [linkLabel, setLinkLabel] = useState("");
  const [error, setError] = useState(null);
  const [values, setValues] = useState({});
  const [files, setFiles] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState("");
  const [token, setToken] = useState("");
  const fileInputs = useRef({});

  useEffect(() => {
    // A one-time link carries its token in the query string.
    const t = new URLSearchParams(window.location.search).get("t") || "";
    setToken(t);

    let ignore = false;
    (async () => {
      try {
        const query = t ? `?t=${encodeURIComponent(t)}` : "";
        const response = await fetch(`${API_URL}/public/accounts-forms/${encodeURIComponent(slug)}${query}`);
        const data = await response.json().catch(() => ({}));
        if (ignore) return;
        if (!response.ok) {
          setError({
            message: data.error || "This form is not available",
            used: Boolean(data.used),
            needsToken: Boolean(data.needsToken),
            badToken: Boolean(data.badToken),
          });
          return;
        }
        setForm(data.form);
        setLinkLabel(data.linkLabel || "");
        const initial = {};
        (data.form.fields || []).forEach((field) => { initial[field.key] = field.type === "toggle" ? false : ""; });
        setValues(initial);
      } catch {
        if (!ignore) setError({ message: "Could not reach the server" });
      }
    })();
    return () => { ignore = true; };
  }, [slug]);

  const setValue = useCallback((key, value) => setValues((current) => ({ ...current, [key]: value })), []);

  function addFiles(key, list) {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    setFiles((current) => ({ ...current, [key]: [...(current[key] || []), ...picked].slice(0, 5) }));
  }

  function removeFile(key, index) {
    setFiles((current) => ({ ...current, [key]: (current[key] || []).filter((_, i) => i !== index) }));
  }

  async function submit(event) {
    event.preventDefault();
    setNotice("");
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("answers", JSON.stringify(values));
      if (token) body.append("token", token);
      let index = 0;
      Object.entries(files).forEach(([key, list]) => {
        (list || []).forEach((file) => {
          body.append("files", file);
          body.append(`fileField${index}`, key);
          index += 1;
        });
      });
      // A dashboard-only form still needs the signed-in user's token, if there is one.
      const authToken = typeof window !== "undefined" ? window.localStorage.getItem("vectordocs_auth_token") : null;
      const response = await fetch(`${API_URL}/public/accounts-forms/${encodeURIComponent(slug)}/submit`, {
        method: "POST",
        body,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        // A burnt link is not something the recipient can retry their way out of.
        if (response.status === 410) { setError({ message: data.error, used: true }); return; }
        setNotice(data.error || "Could not submit");
        return;
      }
      setDone(true);
      if (data.warning) setNotice(data.warning);
    } catch {
      setNotice("Could not reach the server");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    if (error.used) {
      return (
        <Message icon={CircleCheckBig} title="This link has been used">
          A one-time link accepts a single response and then closes. If you need to send another, ask the accounts team for a fresh link.
        </Message>
      );
    }
    if (error.needsToken) {
      return (
        <Message icon={Ticket} tone="amber" title="You need a personal link">
          This form is filled in through a link made for one person. Ask the accounts team to send you yours.
        </Message>
      );
    }
    if (error.badToken) {
      return (
        <Message icon={Link2Off} tone="peach" title="This link is not valid">
          It may have been cancelled or typed incorrectly. Ask the accounts team for a new one.
        </Message>
      );
    }
    return <Message icon={TriangleAlert} tone="rose" title="Form unavailable">{error.message}</Message>;
  }

  if (!form) {
    return (
      <main className={PAGE}>
        <div className="grid min-h-[60vh] place-items-center">
          <div className="flex items-center gap-3 text-[13.5px] text-[#8a8a8a]"><Loader2 className="h-5 w-5 animate-spin" /> Loading form...</div>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <Message icon={CircleCheckBig} tone="mint" title="Request submitted">
        {notice || "Thank you — the accounts team has it."}
      </Message>
    );
  }

  const field = "h-12 w-full rounded-full border border-transparent bg-[#f4f4f2] px-5 text-[13.5px] text-[#141414] outline-none transition placeholder:text-[#a3a3a0] hover:bg-[#efefec] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]";
  const required = form.fields.filter((item) => item.required).length;
  const oneTime = form.submissionMode === "single";

  return (
    <main className={PAGE}>
      <form onSubmit={submit} className={SHEET}>
        <div className="px-7 pt-10 sm:px-12">
          <Badge icon={ClipboardList} tone="peach" className="mb-4">Request form</Badge>
          <SectionTitle size="lg" title={form.name} subtitle="fill in and send" />
        </div>

        {(form.description || oneTime) && (
          <div className="px-7 pt-7 sm:px-12">
            <div className="flex items-start gap-3.5 rounded-[20px] bg-[#f7f7f5] px-5 py-4">
              <IconTile icon={oneTime ? Ticket : Info} tone={oneTime ? "amber" : "sky"} size="sm" />
              <div className="min-w-0">
                <p className="text-[14px]">
                  {oneTime ? `One-time link${linkLabel ? ` · ${linkLabel}` : ""}` : "About this form"}
                </p>
                <p className="mt-0.5 text-[13px] leading-6 text-[#8a8a8a]">
                  {oneTime
                    ? `This link accepts one response and then closes.${form.description ? ` ${form.description}` : ""}`
                    : form.description}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="px-7 pt-8 sm:px-12">
          <div className={RULE} />
        </div>

        <div className="px-7 pt-7 sm:px-12">
          <h2 className="text-[20px] tracking-[-0.01em]">Your answers</h2>
          <p className="mt-0.5 text-[13px] text-[#8a8a8a]">
            {form.fields.length} question{form.fields.length === 1 ? "" : "s"}
            {required ? ` · ${required} required` : " · nothing required"}
          </p>

          <div className="mt-6 grid gap-x-5 gap-y-6 sm:grid-cols-2">
            {form.fields.map((item) => (
              <div key={item.key} className={isWide(item) ? "sm:col-span-2" : ""}>
                <label className="block">
                  <span className="text-[13px] text-[#3d3d3b]">
                    {item.label}
                    {item.required ? <span className="ml-1 text-[#c0394b]">*</span> : null}
                  </span>

                  {item.type === "toggle" ? (
                    <button
                      type="button"
                      onClick={() => setValue(item.key, !values[item.key])}
                      className={`mt-2 flex h-12 w-full items-center justify-between rounded-full px-5 text-[13.5px] transition ${values[item.key] ? "bg-[#eef8cc]" : "bg-[#f4f4f2] hover:bg-[#efefec]"}`}
                    >
                      <span>{values[item.key] ? "Yes" : "No"}</span>
                      <span className={`relative h-6 w-11 rounded-full transition ${values[item.key] ? "bg-[#141414]" : "bg-[#dcdcd8]"}`}>
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-all ${values[item.key] ? "left-[22px]" : "left-0.5"}`} />
                      </span>
                    </button>
                  ) : item.type === "textarea" ? (
                    <textarea
                      rows={4}
                      value={values[item.key] || ""}
                      placeholder={item.placeholder}
                      onChange={(event) => setValue(item.key, event.target.value)}
                      className="mt-2 w-full rounded-[16px] border border-transparent bg-[#f4f4f2] p-4 text-[13.5px] text-[#141414] outline-none transition placeholder:text-[#a3a3a0] hover:bg-[#efefec] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"
                    />
                  ) : item.type === "select" ? (
                    <Select darkMode={false} value={values[item.key] || ""} onChange={(event) => setValue(item.key, event.target.value)} className="mt-2" placeholder="Choose..." size="lg">
                      {(item.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                    </Select>
                  ) : item.type === "file" ? null : item.type === "date" ? (
                    <DateInput darkMode={false} value={values[item.key] || ""} onChange={(event) => setValue(item.key, event.target.value)} className="mt-2" size="lg" placeholder={item.placeholder || "Choose date"} />
                  ) : (
                    <input
                      type={item.type === "number" ? "number" : "text"}
                      value={values[item.key] || ""}
                      placeholder={item.placeholder}
                      onChange={(event) => setValue(item.key, event.target.value)}
                      className={`mt-2 ${field}`}
                    />
                  )}
                </label>

                {item.allowAttachment ? (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => fileInputs.current[item.key]?.click()}
                      className="flex h-10 items-center gap-2 rounded-full border border-dashed border-[#d6d6d2] px-4 text-[13px] text-[#5f5f5c] transition hover:border-[#141414] hover:text-[#141414]"
                    >
                      <Paperclip className="h-4 w-4" /> {item.type === "file" ? "Choose files" : "Attach a file"}
                    </button>
                    <input
                      ref={(node) => { fileInputs.current[item.key] = node; }}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => { addFiles(item.key, event.target.files); event.target.value = ""; }}
                    />
                    {(files[item.key] || []).map((file, fileIndex) => (
                      <span key={`${file.name}-${fileIndex}`} className="mr-2 mt-2 inline-flex h-7 max-w-full items-center gap-2 rounded-full bg-[#f4f4f2] px-3 text-[12px]">
                        <Paperclip className="h-3 w-3 shrink-0 text-[#8a8a8a]" />
                        <span className="truncate">{file.name}</span>
                        <button type="button" onClick={() => removeFile(item.key, fileIndex)} aria-label="Remove file" className="shrink-0 text-[#8a8a8a] transition hover:text-[#c0394b]"><X className="h-3.5 w-3.5" /></button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="px-7 pb-10 pt-8 sm:px-12">
          <div className={RULE} />

          {notice ? (
            <Notice tone="red" icon={TriangleAlert} className="mt-6">{notice}</Notice>
          ) : null}

          <div className="mt-6 flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
            <p className="text-[12px] text-[#9a9a98]">
              {oneTime ? "This link works once · files up to 15 MB each" : "Files up to 15 MB each"}
            </p>
            <Button type="submit" variant="primary" size="lg" icon={Send} loading={submitting} disabled={submitting} className="w-full sm:w-auto">Submit request</Button>
          </div>
        </div>
      </form>
    </main>
  );
}
