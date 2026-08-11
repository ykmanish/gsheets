"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  GraduationCap,
  Loader2,
  Plus,
  Save,
  Trash2,
  User,
  Wrench,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const emptyExp = () => ({
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  bullets: [""],
});

const emptyEdu = () => ({
  institution: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
  gpa: "",
});

const emptyProj = () => ({
  name: "",
  description: "",
  technologies: [],
  bullets: [""],
  link: "",
});

export default function ProfilePage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [skillInput, setSkillInput] = useState("");
  const [open, setOpen] = useState({
    basic: true,
    skills: true,
    exp: true,
    edu: false,
    projects: false,
  });
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    portfolio: "",
    summary: "",
    skills: [],
    workExperience: [emptyExp()],
    education: [emptyEdu()],
    projects: [emptyProj()],
  });

  useEffect(() => {
    const saved = localStorage.getItem("autoapply_profile_id");
    if (!saved) return;

    setLoading(true);
    axios
      .get(`${API}/api/profiles/${saved}`)
      .then((r) => {
        setForm(r.data.data);
        setProfileId(saved);
      })
      .catch(() => toast.error("Could not load profile"))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (k) => setOpen((s) => ({ ...s, [k]: !s[k] }));
  const setField = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const updateArrayItem = (field, index, patch) => {
    const arr = [...(form[field] || [])];
    arr[index] = { ...arr[index], ...patch };
    setField(field, arr);
  };

  const updateArrayBullet = (field, itemIndex, bulletIndex, value) => {
    const arr = [...(form[field] || [])];
    arr[itemIndex].bullets[bulletIndex] = value;
    setField(field, arr);
  };

  const addSkill = () => {
    const normalized = skillInput.trim();
    if (!normalized) return;
    if (form.skills.includes(normalized)) {
      toast.error("Skill already added");
      return;
    }
    setField("skills", [...form.skills, normalized]);
    setSkillInput("");
  };

  const sanitizePayload = (data) => ({
    ...data,
    skills: (data.skills || []).map((s) => s.trim()).filter(Boolean),
    workExperience: (data.workExperience || []).map((e) => ({
      ...e,
      bullets: (e.bullets || []).map((b) => b.trim()).filter(Boolean),
    })),
    projects: (data.projects || []).map((p) => ({
      ...p,
      technologies: (p.technologies || []).map((t) => t.trim()).filter(Boolean),
      bullets: (p.bullets || []).map((b) => b.trim()).filter(Boolean),
    })),
  });

  const handleSave = async () => {
    if (!form.name || !form.email) {
      toast.error("Name and email are required");
      return;
    }

    setSaving(true);
    try {
      const payload = sanitizePayload(form);
      let res;

      if (profileId) {
        res = await axios.put(`${API}/api/profiles/${profileId}`, payload);
      } else {
        res = await axios.post(`${API}/api/profiles`, payload);
        const id = res.data.data._id;
        setProfileId(id);
        localStorage.setItem("autoapply_profile_id", id);
      }

      setForm(res.data.data);
      toast.success("✅ Profile saved!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const Input = ({ label, value, onChange, placeholder, type = "text", className = "" }) => (
    <div className={className}>
      <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border-2 border-black bg-[#F7F5F0] px-3 py-2.5 text-sm font-medium transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
      />
    </div>
  );

  const Section = ({ id, title, icon: Icon, accent, children }) => (
    <div className="neo-border overflow-hidden bg-white">
      <button
        onClick={() => toggle(id)}
        className="flex w-full items-center gap-3 border-b-2 border-black px-6 py-4 transition-opacity hover:opacity-90"
        style={{ backgroundColor: open[id] ? accent : "white" }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black">
          <Icon size={16} className="text-white" />
        </div>
        <span className="flex-1 text-left text-base font-black uppercase tracking-tight">{title}</span>
        {open[id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open[id] && <div className="space-y-4 p-6">{children}</div>}
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={24} className="mr-3 animate-spin" />
        <span className="text-sm font-bold">Loading profile…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <section className="border-b-4 border-black bg-black px-5 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8D5FF]">
              <User size={18} color="#000" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Your Profile</span>
          </div>
          <h1 className="mb-3 text-4xl font-black uppercase tracking-tighter leading-[0.9] sm:text-6xl">
            Base <span className="text-[#E8D5FF]">Resume</span>
          </h1>
          <p className="max-w-xl text-sm text-gray-400">
            Set this up once. AutoApply AI tailors it per job automatically.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-5 px-5 py-8 pb-28">
        <Section id="basic" title="Basic Information" icon={User} accent="#E8D5FF">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Full Name *"
              value={form.name}
              onChange={(v) => setField("name", v)}
              placeholder="Manishkumar Yadav"
              className="sm:col-span-2"
            />
            <Input
              label="Email *"
              value={form.email}
              onChange={(v) => setField("email", v)}
              placeholder="manish@example.com"
              type="email"
            />
            <Input label="Phone" value={form.phone} onChange={(v) => setField("phone", v)} placeholder="+91 98765 43210" />
            <Input
              label="Location"
              value={form.location}
              onChange={(v) => setField("location", v)}
              placeholder="Ahmedabad, Gujarat"
            />
            <Input
              label="LinkedIn"
              value={form.linkedin}
              onChange={(v) => setField("linkedin", v)}
              placeholder="linkedin.com/in/manish"
            />
            <Input
              label="GitHub"
              value={form.github}
              onChange={(v) => setField("github", v)}
              placeholder="github.com/manish"
            />
            <Input
              label="Portfolio"
              value={form.portfolio}
              onChange={(v) => setField("portfolio", v)}
              placeholder="manish.dev"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">
              Professional Summary
            </label>
            <textarea
              value={form.summary || ""}
              onChange={(e) => setField("summary", e.target.value)}
              placeholder="Full-stack developer with 3+ years building SaaS products with Next.js, Node.js, and MongoDB…"
              className="h-28 w-full resize-none rounded-xl border-2 border-black bg-[#F7F5F0] px-3 py-2.5 text-sm font-medium transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </Section>

        <Section id="skills" title="Skills" icon={Wrench} accent="#9EEAEA">
          <div className="flex gap-2">
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
              placeholder="Type a skill and press Enter…"
              className="flex-1 rounded-xl border-2 border-black bg-[#F7F5F0] px-3 py-2.5 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button onClick={addSkill} className="neo-btn bg-black px-4 text-[11px] text-white">
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(form.skills || []).map((s, i) => (
              <span key={i} className="neo-tag flex items-center gap-1.5 bg-[#9EEAEA] text-[11px] text-black">
                {s}
                <button
                  onClick={() => setField("skills", form.skills.filter((_, j) => j !== i))}
                  className="text-base leading-none hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </Section>

        <Section id="exp" title="Work Experience" icon={Briefcase} accent="#FFFD54">
          {(form.workExperience || []).map((exp, i) => (
            <div key={i} className="neo-border-sm space-y-3 bg-[#F7F5F0] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-gray-500">Experience #{i + 1}</span>
                {form.workExperience.length > 1 && (
                  <button
                    onClick={() => setField("workExperience", form.workExperience.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Job Title" value={exp.title} onChange={(v) => updateArrayItem("workExperience", i, { title: v })} placeholder="Full-Stack Developer" />
                <Input label="Company" value={exp.company} onChange={(v) => updateArrayItem("workExperience", i, { company: v })} placeholder="Quantafile" />
                <Input label="Start Date" value={exp.startDate} onChange={(v) => updateArrayItem("workExperience", i, { startDate: v })} placeholder="Jan 2023" />
                <Input label="End Date" value={exp.endDate} onChange={(v) => updateArrayItem("workExperience", i, { endDate: v })} placeholder="Present" />
                <Input
                  label="Location"
                  value={exp.location}
                  onChange={(v) => updateArrayItem("workExperience", i, { location: v })}
                  placeholder="Ahmedabad, IN"
                  className="sm:col-span-2"
                />
              </div>

              <div>
                <div className="mb-2 flex justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Bullet Points</label>
                  <button
                    onClick={() => updateArrayItem("workExperience", i, { bullets: [...(exp.bullets || []), ""] })}
                    className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-black"
                  >
                    <Plus size={10} /> Add
                  </button>
                </div>

                {(exp.bullets || []).map((b, j) => (
                  <div key={j} className="mb-2 flex gap-2">
                    <input
                      value={b}
                      onChange={(e) => updateArrayBullet("workExperience", i, j, e.target.value)}
                      placeholder="Built REST API serving 10k daily requests using Node.js and MongoDB…"
                      className="flex-1 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    {exp.bullets.length > 1 && (
                      <button
                        onClick={() => updateArrayItem("workExperience", i, { bullets: exp.bullets.filter((_, k) => k !== j) })}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={() => setField("workExperience", [...(form.workExperience || []), emptyExp()])}
            className="neo-btn w-full justify-center bg-[#FFFD54] py-3 text-[11px] text-black"
          >
            <Plus size={13} /> Add Experience
          </button>
        </Section>

        <Section id="edu" title="Education" icon={GraduationCap} accent="#C2FF47">
          {(form.education || []).map((edu, i) => (
            <div key={i} className="neo-border-sm space-y-3 bg-[#F7F5F0] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-gray-500">Education #{i + 1}</span>
                {form.education.length > 1 && (
                  <button
                    onClick={() => setField("education", form.education.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Institution"
                  value={edu.institution}
                  onChange={(v) => updateArrayItem("education", i, { institution: v })}
                  placeholder="Gujarat Technological University"
                  className="sm:col-span-2"
                />
                <Input label="Degree" value={edu.degree} onChange={(v) => updateArrayItem("education", i, { degree: v })} placeholder="B.Tech" />
                <Input label="Field" value={edu.field} onChange={(v) => updateArrayItem("education", i, { field: v })} placeholder="Computer Science" />
                <Input label="Start Year" value={edu.startDate} onChange={(v) => updateArrayItem("education", i, { startDate: v })} placeholder="2019" />
                <Input label="End Year" value={edu.endDate} onChange={(v) => updateArrayItem("education", i, { endDate: v })} placeholder="2023" />
              </div>
            </div>
          ))}

          <button
            onClick={() => setField("education", [...(form.education || []), emptyEdu()])}
            className="neo-btn w-full justify-center bg-[#C2FF47] py-3 text-[11px] text-black"
          >
            <Plus size={13} /> Add Education
          </button>
        </Section>

        <Section id="projects" title="Projects" icon={FolderOpen} accent="#9EEAEA">
          {(form.projects || []).map((proj, i) => (
            <div key={i} className="neo-border-sm space-y-3 bg-[#F7F5F0] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-gray-500">Project #{i + 1}</span>
                {form.projects.length > 1 && (
                  <button
                    onClick={() => setField("projects", form.projects.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <Input label="Project Name" value={proj.name} onChange={(v) => updateArrayItem("projects", i, { name: v })} placeholder="Quantafile Chat" />
              <Input label="Link" value={proj.link} onChange={(v) => updateArrayItem("projects", i, { link: v })} placeholder="github.com/manish/project" />

              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Technologies (comma-separated)
                </label>
                <input
                  value={(proj.technologies || []).join(", ")}
                  onChange={(e) =>
                    updateArrayItem("projects", i, {
                      technologies: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Next.js, Node.js, MongoDB, Socket.io, Tailwind CSS"
                  className="w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <div className="mb-2 flex justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Bullet Points</label>
                  <button
                    onClick={() => updateArrayItem("projects", i, { bullets: [...(proj.bullets || []), ""] })}
                    className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-black"
                  >
                    <Plus size={10} /> Add
                  </button>
                </div>

                {(proj.bullets || []).map((b, j) => (
                  <div key={j} className="mb-2 flex gap-2">
                    <input
                      value={b}
                      onChange={(e) => updateArrayBullet("projects", i, j, e.target.value)}
                      placeholder="Built real-time messaging with Socket.io for 500 concurrent users…"
                      className="flex-1 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    {proj.bullets.length > 1 && (
                      <button
                        onClick={() => updateArrayItem("projects", i, { bullets: proj.bullets.filter((_, k) => k !== j) })}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={() => setField("projects", [...(form.projects || []), emptyProj()])}
            className="neo-btn w-full justify-center bg-[#9EEAEA] py-3 text-[11px] text-black"
          >
            <Plus size={13} /> Add Project
          </button>
        </Section>

        <div className="sticky bottom-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="neo-btn w-full justify-center bg-black px-10 py-4 text-sm text-[#C2FF47] disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : profileId ? "Update Profile" : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
