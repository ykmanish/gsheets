"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheckBig, Info, Link2Off, Loader2, Paperclip, Send, Ticket, TriangleAlert, X } from "lucide-react";
import { API_URL } from "./AuthProvider";

// The shareable side of an accounts request form. Deliberately standalone: no sidebar,
// no auth provider, nothing that assumes a signed-in raga user — a link recipient may
// have no account at all.

const PAGE = "min-h-screen bg-[#e9ecf3] px-4 py-8 text-[#171714] sm:px-6 sm:py-12";
const SHEET = "mx-auto w-full max-w-3xl rounded-2xl border border-black/[0.05] bg-white";
const RULE = "border-t border-black/[0.08]";

function Shell({ children }) {
  return <main className={PAGE}><div className={SHEET}>{children}</div></main>;
}

// Every dead end — used link, cancelled link, closed form — lands here rather than on a
// bare error string, so a recipient always knows whether to ask for a new link.
function Message({ icon: Icon, title, children }) {
  return (
    <Shell>
      <div className="px-8 py-14 text-center sm:px-14">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-black/[0.08]">
          <Icon className="h-6 w-6 text-black/50" />
        </span>
        <h1 className="small mt-6 text-2xl font-black">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-black/50">{children}</p>
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
        <Message icon={Ticket} title="You need a personal link">
          This form is filled in through a link made for one person. Ask the accounts team to send you yours.
        </Message>
      );
    }
    if (error.badToken) {
      return (
        <Message icon={Link2Off} title="This link is not valid">
          It may have been cancelled or typed incorrectly. Ask the accounts team for a new one.
        </Message>
      );
    }
    return <Message icon={TriangleAlert} title="Form unavailable">{error.message}</Message>;
  }

  if (!form) {
    return (
      <main className={PAGE}>
        <div className="grid min-h-[60vh] place-items-center">
          <div className="flex items-center gap-3 text-sm font-semibold text-black/45"><Loader2 className="h-5 w-5 animate-spin" /> Loading form...</div>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <Message icon={CircleCheckBig} title="Request submitted">
        {notice || "Thank you — the accounts team has it."}
      </Message>
    );
  }

  const field = "h-12 w-full rounded-xl border border-black/[0.12] bg-white px-4 text-sm text-[#171714] outline-none transition placeholder:text-black/30 focus:border-black/40";
  const required = form.fields.filter((item) => item.required).length;
  const oneTime = form.submissionMode === "single";

  return (
    <main className={PAGE}>
      <form onSubmit={submit} className={SHEET}>
        <div className="px-7 pt-10 sm:px-12">
          <p className="text-sm font-black tracking-tight text-black/40">Request form</p>
          <h1 className="small mt-2 text-3xl font-black leading-tight">{form.name}</h1>
        </div>

        <div className="px-7 pt-7 sm:px-12">
          <div className={RULE} />
        </div>

        {(form.description || oneTime) && (
          <div className="px-7 pt-6 sm:px-12">
            <div className="flex items-start gap-3 rounded-xl bg-[#f3f4f9] px-5 py-4">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-black/25">
                {oneTime ? <Ticket className="h-3 w-3 text-black/55" /> : <Info className="h-3 w-3 text-black/55" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black">
                  {oneTime ? `One-time link${linkLabel ? ` · ${linkLabel}` : ""}` : "About this form"}
                </p>
                <p className="mt-1 text-sm leading-6 text-black/45">
                  {oneTime
                    ? `This link accepts one response and then closes.${form.description ? ` ${form.description}` : ""}`
                    : form.description}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="px-7 pt-7 sm:px-12">
          <div className={RULE} />
        </div>

        <div className="px-7 pt-7 sm:px-12">
          <h2 className="small text-2xl font-black">Your answers</h2>
          <p className="mt-1.5 text-sm text-black/40">
            {form.fields.length} question{form.fields.length === 1 ? "" : "s"}
            {required ? ` · ${required} required` : " · nothing required"}
          </p>

          <div className="mt-6 grid gap-x-5 gap-y-6 sm:grid-cols-2">
            {form.fields.map((item) => (
              <div key={item.key} className={isWide(item) ? "sm:col-span-2" : ""}>
                <label className="block">
                  <span className="text-sm font-black">
                    {item.label}
                    {item.required ? <span className="ml-1 text-rose-500">*</span> : null}
                  </span>

                  {item.type === "toggle" ? (
                    <button
                      type="button"
                      onClick={() => setValue(item.key, !values[item.key])}
                      className={`mt-2 flex h-12 w-full items-center justify-between rounded-xl border px-4 text-sm font-bold transition ${values[item.key] ? "border-black/40" : "border-black/[0.12]"}`}
                    >
                      <span>{values[item.key] ? "Yes" : "No"}</span>
                      <span className={`relative h-6 w-11 rounded-full transition ${values[item.key] ? "bg-[#171714]" : "bg-black/12"}`}>
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${values[item.key] ? "left-[22px]" : "left-0.5"}`} />
                      </span>
                    </button>
                  ) : item.type === "textarea" ? (
                    <textarea
                      rows={4}
                      value={values[item.key] || ""}
                      placeholder={item.placeholder}
                      onChange={(event) => setValue(item.key, event.target.value)}
                      className="mt-2 w-full rounded-xl border border-black/[0.12] bg-white p-4 text-sm text-[#171714] outline-none transition placeholder:text-black/30 focus:border-black/40"
                    />
                  ) : item.type === "select" ? (
                    <select value={values[item.key] || ""} onChange={(event) => setValue(item.key, event.target.value)} className={`mt-2 ${field}`}>
                      <option value="">Choose...</option>
                      {(item.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : item.type === "file" ? null : (
                    <input
                      type={item.type === "number" ? "number" : item.type === "date" ? "date" : "text"}
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
                      className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-black/[0.18] px-4 text-sm font-bold text-black/45 transition hover:border-black/45 hover:text-black"
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
                      <span key={`${file.name}-${fileIndex}`} className="mt-2 mr-2 inline-flex max-w-full items-center gap-2 rounded-lg bg-[#f3f4f9] px-3 py-1.5 text-xs font-bold">
                        <Paperclip className="h-3 w-3 shrink-0 text-black/35" />
                        <span className="truncate">{file.name}</span>
                        <button type="button" onClick={() => removeFile(item.key, fileIndex)} aria-label="Remove file" className="shrink-0 text-black/35 transition hover:text-rose-500"><X className="h-3.5 w-3.5" /></button>
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
            <p className="mt-6 flex items-start gap-2.5 rounded-xl bg-rose-50 px-5 py-4 text-sm font-bold text-rose-600">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-black/35">
              {oneTime ? "This link works once · files up to 15 MB each" : "Files up to 15 MB each"}
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#171714] px-8 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-black/25 sm:w-auto"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit request
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
