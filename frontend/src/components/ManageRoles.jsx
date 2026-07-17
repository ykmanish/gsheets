"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  Check,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { ConfirmModal, SelectMenu } from "./ui";

const emptyRole = { id: "", name: "", description: "", menus: [], privileges: [] };
const emptyUser = { username: "", displayName: "", password: "", roleId: "" };
const emptyPassword = { userId: "", password: "", confirmPassword: "" };
const PROJECT_PARENT_MENU = "projects";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function FieldInput({ darkMode, className = "", ...props }) {
  return (
    <input
      {...props}
      className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none transition focus:ring-2 ${
        darkMode
          ? "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus:ring-[#d8f36a]/25"
          : "border-black/10 bg-white text-black placeholder:text-black/35 focus:ring-black/10"
      } ${className}`}
    />
  );
}

function PasswordInput({ darkMode, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <FieldInput {...props} darkMode={darkMode} type={visible ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className={`absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full ${
          darkMode ? "text-white/55 hover:bg-white/10" : "text-black/45 hover:bg-black/5"
        }`}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Modal({ darkMode, title, eyebrow, onClose, children, maxWidth = "max-w-2xl" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-[28px] border p-6 ${darkMode ? "border-white/10 bg-[#121317] text-white" : "border-black/5 bg-white text-black"}`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className={`mb-2 text-[11px] uppercase tracking-[0.28em] ${darkMode ? "text-white/40" : "text-black/35"}`}>{eyebrow}</p>
            <h3 className="text-2xl small font-semibold">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className={`flex h-10 w-10 items-center justify-center rounded-full ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PermissionButton({ darkMode, active, disabled, label, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? darkMode ? "border-[#d8f36a] bg-[#d8f36a] text-black" : "border-black bg-black text-white"
          : darkMode ? "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07]" : "border-black/10 bg-white text-black/60 hover:bg-black/[0.03]"
      }`}
    >
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? "border-current" : darkMode ? "border-white/25" : "border-black/20"}`}>
        {active && <Check className="h-3 w-3" />}
      </span>
      <span>{label}</span>
    </button>
  );
}

function Badge({ darkMode, children, tone = "default" }) {
  const tones = {
    success: "bg-emerald-500/10 text-emerald-500",
    danger: "bg-red-500/10 text-red-500",
    accent: darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-black/5 text-black/65",
    default: darkMode ? "bg-white/5 text-white/55" : "bg-black/5 text-black/55",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs ${tones[tone]}`}>{children}</span>;
}

export default function ManageRoles({ darkMode, mode = "roles" }) {
  const activeTab = mode === "users" ? "users" : "roles";
  const isRolesMode = activeTab === "roles";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [privilegeItems, setPrivilegeItems] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [userForm, setUserForm] = useState(emptyUser);
  const [passwordForm, setPasswordForm] = useState(emptyPassword);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const roleMap = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);
  const roleOptions = roles.map((role) => ({ value: role.id, label: role.name }));
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredRoles = roles.filter((role) => !normalizedSearch || [
    role.name,
    role.description,
    ...(role.menus || []).map((id) => menuItems.find((item) => item.id === id)?.label || id),
  ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch)));
  const filteredUsers = users.filter((user) => {
    const role = roleMap.get(user.roleId);
    return !normalizedSearch || [user.displayName, user.username, role?.name, user.blacklisted ? "blacklisted" : "active"]
      .some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  });
  const projectMenuItems = useMemo(
    () => menuItems.filter((menu) => menu.id === PROJECT_PARENT_MENU || menu.parent === PROJECT_PARENT_MENU),
    [menuItems],
  );
  const projectChildMenuItems = useMemo(
    () => projectMenuItems.filter((menu) => menu.parent === PROJECT_PARENT_MENU),
    [projectMenuItems],
  );
  const topLevelMenuItems = useMemo(
    () => menuItems.filter((menu) => menu.id !== PROJECT_PARENT_MENU && menu.parent !== PROJECT_PARENT_MENU),
    [menuItems],
  );

  useEffect(() => {
    void loadAdminData();
  }, []);

  async function loadAdminData() {
    setLoading(true);
    try {
      const [menusData, rolesData, usersData] = await Promise.all([
        api("/admin/menu-items"),
        api("/admin/roles"),
        api("/admin/users"),
      ]);
      setMenuItems(menusData.menuItems || []);
      setPrivilegeItems(menusData.privilegeItems || []);
      setRoles(rolesData.roles || []);
      setUsers(usersData.users || []);
      setUserForm((current) => ({ ...current, roleId: current.roleId || rolesData.roles?.[0]?.id || "" }));
    } catch (error) {
      toast.error(error.message || "Could not load admin data");
    } finally {
      setLoading(false);
    }
  }

  function openCreateRole() {
    setRoleForm(emptyRole);
    setRoleModalOpen(true);
  }

  function openEditRole(role) {
    setRoleForm({
      id: role.id,
      name: role.name,
      description: role.description || "",
      menus: [...(role.menus || [])],
      privileges: [...(role.privileges || [])],
    });
    setRoleModalOpen(true);
  }

  function toggleRoleField(field, value) {
    setRoleForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
  }

  function toggleRoleMenu(value) {
    setRoleForm((current) => {
      const currentMenus = current.menus || [];
      const active = currentMenus.includes(value);
      let menus;
      if (value === PROJECT_PARENT_MENU) {
        const projectIds = new Set(projectMenuItems.map((menu) => menu.id));
        menus = active
          ? currentMenus.filter((id) => !projectIds.has(id))
          : [...new Set([...currentMenus, PROJECT_PARENT_MENU])];
      } else {
        menus = active
          ? currentMenus.filter((id) => id !== value)
          : [...new Set([...currentMenus, PROJECT_PARENT_MENU, value])];
      }
      return { ...current, menus };
    });
  }

  function setProjectAccessMode(mode) {
    setRoleForm((current) => {
      const projectIds = new Set(projectMenuItems.map((menu) => menu.id));
      const nonProjectMenus = (current.menus || []).filter((id) => !projectIds.has(id));
      const nonProjectPrivileges = (current.privileges || []).filter((id) => id !== "manage_project_control");
      if (mode === "none") {
        return { ...current, menus: nonProjectMenus, privileges: nonProjectPrivileges };
      }
      if (mode === "view") {
        return { ...current, menus: [...nonProjectMenus, PROJECT_PARENT_MENU], privileges: nonProjectPrivileges };
      }
      if (mode === "edit") {
        return {
          ...current,
          menus: [...nonProjectMenus, PROJECT_PARENT_MENU],
          privileges: [...nonProjectPrivileges, "manage_project_control"],
        };
      }
      return {
        ...current,
        menus: [...nonProjectMenus, ...projectMenuItems.map((menu) => menu.id)],
        privileges: [...nonProjectPrivileges, "manage_project_control", "edit_project_dmr", "edit_project_mrn", "manage_project_stock"],
      };
    });
  }

  async function saveRole(event) {
    event.preventDefault();
    if (!roleForm.name.trim()) return toast.error("Role name is required");
    try {
      setSaving(true);
      const isEdit = Boolean(roleForm.id);
      await api(isEdit ? `/admin/roles/${roleForm.id}` : "/admin/roles", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(roleForm),
      });
      toast.success(isEdit ? "Role updated" : "Role created");
      setRoleModalOpen(false);
      setRoleForm(emptyRole);
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || "Could not save role");
    } finally {
      setSaving(false);
    }
  }

  async function createUser(event) {
    event.preventDefault();
    try {
      setSaving(true);
      await api("/admin/users", { method: "POST", body: JSON.stringify(userForm) });
      toast.success("User created");
      setUserModalOpen(false);
      setUserForm({ ...emptyUser, roleId: roles[0]?.id || "" });
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || "Could not create user");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(userId, patch) {
    try {
      await api(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(patch) });
      toast.success("User updated");
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || "Could not update user");
    }
  }

  function openPasswordModal(user) {
    setPasswordForm({ userId: user.id, password: "", confirmPassword: "" });
    setPasswordModalOpen(true);
  }

  async function resetPassword(event) {
    event.preventDefault();
    if (!passwordForm.password) return toast.error("Enter a new password");
    if (passwordForm.password !== passwordForm.confirmPassword) return toast.error("Passwords do not match");
    try {
      setSaving(true);
      await api(`/admin/users/${passwordForm.userId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: passwordForm.password }),
      });
      toast.success("Password reset");
      setPasswordModalOpen(false);
      setPasswordForm(emptyPassword);
    } catch (error) {
      toast.error(error.message || "Could not reset password");
    } finally {
      setSaving(false);
    }
  }

  async function performDelete() {
    if (!deleteConfirm) return;
    try {
      setDeleting(true);
      if (deleteConfirm.type === "role") {
        await api(`/admin/roles/${deleteConfirm.item.id}`, { method: "DELETE" });
        toast.success("Role deleted");
      } else {
        await api(`/admin/users/${deleteConfirm.item.id}`, { method: "DELETE" });
        toast.success("User deleted");
      }
      setDeleteConfirm(null);
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || "Could not delete item");
    } finally {
      setDeleting(false);
    }
  }

  const muted = darkMode ? "text-white/45" : "text-black/45";

  if (loading) {
    return (
      <div className={`flex flex-1 items-center justify-center ${darkMode ? "bg-[#0f1115] text-white" : "bg-[#f6f6f4] text-black"}`}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
    <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f4f5f8] text-[#171714]"}`}>
      <section className={`relative mb-5 overflow-hidden rounded-[30px] p-6 sm:p-8 ${darkMode ? "border-white/10 bg-[#202328]" : "border-black/[0.06] bg-[#fbfbfd]"}`}>
        {!darkMode && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(17,17,17,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(17,17,17,0.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white via-white/80 to-transparent" />
            <span className="absolute -left-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-[#f4f5f8]" />
            <span className="absolute -right-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-[#f4f5f8]" />
          </>
        )}
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-black/[0.06] bg-white text-black/70 shadow-[0_10px_24px_rgba(31,35,40,0.08)]"}`}>
                <ShieldCheck className="h-4 w-4" /> Access administration
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-black/[0.04] bg-[#fff1a8] text-black/70 shadow-[0_8px_18px_rgba(31,35,40,0.08)]"}`}>
                {isRolesMode ? `${roles.length} roles` : `${users.length} users`}
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-black/[0.04] bg-[#d5f3f0] text-black/70 shadow-[0_8px_18px_rgba(31,35,40,0.08)]"}`}>
                {isRolesMode ? `${menuItems.length} modules` : `${users.filter((user) => !user.blacklisted).length} active`}
              </span>
            </div>
            <h1 className={`mt-5 max-w-4xl text-4xl small font-black leading-[0.96] tracking-tight sm:text-4xl ${darkMode ? "text-white" : "text-[#161616]"}`}>
              {isRolesMode ? "Role permissions, made simple." : "User access, made simple."}
            </h1>
            <p className={`mt-4 max-w-3xl text-sm font-medium leading-6 sm:text-base ${darkMode ? "text-white/65" : "text-black/58"}`}>
              {isRolesMode ? "Create roles, assign modules, and control action permissions in one clean workspace." : "Create users, assign roles, reset passwords, and manage account status in one clean workspace."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <button
              type="button"
              onClick={isRolesMode ? openCreateRole : () => setUserModalOpen(true)}
              className={`flex h-12 items-center justify-center gap-2 rounded-3xl px-5 text-sm shadow-[0_14px_28px_rgba(31,35,40,0.16)] transition active:scale-[0.98] ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}
            >
              {isRolesMode ? <Plus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {isRolesMode ? "Add role" : "Add user"}
            </button>
          </div>
        </div>
      </section>

      <section className={`overflow-hidden rounded-[30px] border p-5 sm:p-7 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-white"}`}>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl small font-semibold">{isRolesMode ? "Role records" : "User records"}</h2>
            <p className={`mt-1 text-sm ${muted}`}>{isRolesMode ? "Module and permission access list." : "Role assignment and account status list."}</p>
          </div>
          <label className={`flex h-12 w-full items-center gap-3 rounded-2xl border px-4 lg:w-[360px] ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}>
            <Search className={`h-4 w-4 shrink-0 ${muted}`} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={isRolesMode ? "Search role, module..." : "Search user, role, status..."}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-current placeholder:opacity-40"
            />
          </label>
        </div>
        <div className="overflow-x-auto pt-3">
            {activeTab === "roles" ? (
              <table className="w-full min-w-[960px] border-separate border-spacing-y-2 text-left">
                <thead className={darkMode ? "bg-[#15171c]" : "bg-white"}>
                  <tr>
                    {["Name", "Description", "Modules", "Permissions", "Users", "Actions"].map((heading) => (
                      <th key={heading} className={`px-4 py-3 text-[11px] font-semibold ${muted}`}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.map((role) => {
                    const userCount = users.filter((user) => user.roleId === role.id).length;
                    return (
                      <tr key={role.id} className={`transition ${darkMode ? "bg-white/[0.035] hover:bg-white/[0.06]" : "bg-[#f8f9fc] hover:bg-[#f3f5f9]"}`}>
                        <td className="rounded-l-xl px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-white text-slate-500"}`}>
                              <FileText className="h-4 w-4" />
                            </span>
                            <div>
                              <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{role.name}</p>
                              <p className={`mt-0.5 text-xs ${muted}`}>{role.isSystem ? "System role" : "Custom role"}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`max-w-[280px] px-4 py-3 text-sm ${muted}`}><span className="block truncate">{role.description || "No description"}</span></td>
                        <td className="px-4 py-3"><Badge darkMode={darkMode} tone="accent">{role.menus?.length || 0} modules</Badge></td>
                        <td className="px-4 py-3"><Badge darkMode={darkMode}>{role.privileges?.length || 0} permissions</Badge></td>
                        <td className={`px-4 py-3 text-sm font-medium ${darkMode ? "text-white/80" : "text-slate-700"}`}>{userCount}</td>
                        <td className="rounded-r-xl px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setDetailModal({ type: "role", item: role })} className={`flex h-9 items-center rounded-lg border px-4 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/5 text-white/75" : "border-slate-200 bg-white text-slate-700"}`}>
                              View
                            </button>
                            {!role.isSystem && (
                              <button onClick={() => openEditRole(role)} className={`flex h-9 w-9 items-center justify-center rounded-lg ${darkMode ? "bg-white/5 text-white/60 hover:bg-white/10" : "bg-white text-slate-500 hover:bg-slate-100"}`} title="Edit role">
                                <Edit3 className="h-4 w-4" />
                              </button>
                            )}
                            {!role.isSystem && (
                              <button onClick={() => setDeleteConfirm({ type: "role", item: role })} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10" title="Delete role">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${darkMode ? "text-white/45" : "text-slate-400"}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left">
                <thead className={darkMode ? "bg-[#15171c]" : "bg-white"}>
                  <tr>
                    {["Name", "Role", "Status", "Modules", "Permissions", "Actions"].map((heading) => (
                      <th key={heading} className={`px-4 py-3 text-[11px] font-semibold ${muted}`}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const role = roleMap.get(user.roleId);
                    const isSystemSuperAdmin = String(user.username || "").toLowerCase() === "adminuipl";
                    return (
                      <tr key={user.id} className={`transition ${darkMode ? "bg-white/[0.035] hover:bg-white/[0.06]" : "bg-[#f8f9fc] hover:bg-[#f3f5f9]"}`}>
                        <td className="rounded-l-xl px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-cyan-100 text-cyan-700"}`}>
                              {(user.displayName || user.username || "U").slice(0, 1).toUpperCase()}
                            </span>
                            <div>
                              <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{user.displayName}</p>
                              <p className={`mt-0.5 text-xs ${muted}`}>{user.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <SelectMenu
                            darkMode={darkMode}
                            value={user.roleId || ""}
                            options={roleOptions}
                            onChange={(roleId) => updateUser(user.id, { roleId })}
                            disabled={isSystemSuperAdmin}
                            className="w-[180px]"
                          />
                        </td>
                        <td className="px-4 py-3"><Badge darkMode={darkMode} tone={user.blacklisted ? "danger" : "success"}>{user.blacklisted ? "Blacklisted" : "Active"}</Badge></td>
                        <td className={`px-4 py-3 text-sm font-medium ${darkMode ? "text-white/80" : "text-slate-700"}`}>{role?.menus?.length || 0}</td>
                        <td className={`px-4 py-3 text-sm font-medium ${darkMode ? "text-white/80" : "text-slate-700"}`}>{role?.privileges?.length || 0}</td>
                        <td className="rounded-r-xl px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setDetailModal({ type: "user", item: user })} className={`flex h-9 items-center rounded-lg border px-4 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/5 text-white/75" : "border-slate-200 bg-white text-slate-700"}`}>
                              View
                            </button>
                            <button onClick={() => openPasswordModal(user)} className={`flex h-9 w-9 items-center justify-center rounded-lg ${darkMode ? "bg-[#d8f36a] text-black" : "bg-white text-slate-600 hover:bg-slate-100"}`} title="Reset password">
                              <KeyRound className="h-4 w-4" />
                            </button>
                            {!user.isSuperAdmin && (
                              <button onClick={() => updateUser(user.id, { blacklisted: !user.blacklisted })} className={`flex h-9 w-9 items-center justify-center rounded-lg ${user.blacklisted ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`} title={user.blacklisted ? "Unblock user" : "Blacklist user"}>
                                {user.blacklisted ? <Check className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                              </button>
                            )}
                            {!user.isSuperAdmin && (
                              <button onClick={() => setDeleteConfirm({ type: "user", item: user })} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10" title="Delete user">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${darkMode ? "text-white/45" : "text-slate-400"}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
      </section>
    </main>

      {roleModalOpen && (
        <Modal darkMode={darkMode} title={roleForm.id ? "Edit role" : "Add role"} eyebrow="Role configuration" onClose={() => setRoleModalOpen(false)} maxWidth="max-w-3xl">
          <form onSubmit={saveRole} className="space-y-5">
            <div className={`flex items-center gap-4 border-b border-dashed pb-5 ${darkMode ? "border-white/15" : "border-black/15"}`}>
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed ${darkMode ? "border-white/20 bg-white/5 text-[#d8f36a]" : "border-slate-300 bg-slate-50 text-slate-500"}`}>
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <p className="text-base font-semibold">Configure workspace access</p>
                <p className={`mt-1 text-sm ${muted}`}>Name the role, then choose which modules and actions its users can access.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${muted}`}>Role name</span>
                <FieldInput darkMode={darkMode} value={roleForm.name} onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Enter role name" required />
              </label>
              <label className="space-y-2">
                <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${muted}`}>Description</span>
                <FieldInput darkMode={darkMode} value={roleForm.description} onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe this role" />
              </label>
            </div>

            <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.045]" : "bg-[#f5f6f8]"}`}>
              <div className="mb-4">
                <p className="text-sm font-semibold">Visible modules</p>
                <p className={`mt-1 text-xs ${muted}`}>Choose the pages this role can open from the sidebar.</p>
              </div>
              <div className="space-y-3">
                {projectMenuItems.length > 0 && (
                  <div className={`rounded-2xl border p-3 ${darkMode ? "border-white/10 bg-black/10" : "border-black/10 bg-white/70"}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <PermissionButton
                        darkMode={darkMode}
                        active={roleForm.menus.includes(PROJECT_PARENT_MENU)}
                        label={projectMenuItems.find((menu) => menu.id === PROJECT_PARENT_MENU)?.label || "Project Control"}
                        onClick={() => toggleRoleMenu(PROJECT_PARENT_MENU)}
                      />
                      <span className={`px-1 text-xs ${muted}`}>
                        {projectChildMenuItems.filter((menu) => roleForm.menus.includes(menu.id)).length}/{projectChildMenuItems.length} submodules
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      {[
                        ["none", "No access"],
                        ["view", "View"],
                        ["edit", "Edit"],
                        ["all", "All"],
                      ].map(([mode, label]) => {
                        const projectSelected = roleForm.menus.includes(PROJECT_PARENT_MENU);
                        const editSelected = roleForm.privileges.includes("manage_project_control");
                        const allSelected = projectChildMenuItems.every((menu) => roleForm.menus.includes(menu.id)) && editSelected;
                        const active = mode === "none"
                          ? !projectSelected
                          : mode === "view"
                            ? projectSelected && !editSelected && !projectChildMenuItems.some((menu) => roleForm.menus.includes(menu.id))
                            : mode === "edit"
                              ? projectSelected && editSelected && !allSelected
                              : allSelected;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setProjectAccessMode(mode)}
                            className={`h-10 rounded-xl border px-3 text-sm font-semibold transition ${
                              active
                                ? darkMode ? "border-[#d8f36a] bg-[#d8f36a] text-black" : "border-black bg-black text-white"
                                : darkMode ? "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07]" : "border-black/10 bg-white text-black/60 hover:bg-black/[0.03]"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {projectChildMenuItems.map((menu) => (
                        <PermissionButton
                          key={menu.id}
                          darkMode={darkMode}
                          active={roleForm.menus.includes(menu.id)}
                          label={menu.label}
                          onClick={() => toggleRoleMenu(menu.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {topLevelMenuItems.map((menu) => (
                    <PermissionButton
                      key={menu.id}
                      darkMode={darkMode}
                      active={roleForm.menus.includes(menu.id)}
                      label={menu.label}
                      onClick={() => toggleRoleField("menus", menu.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.045]" : "bg-[#f5f6f8]"}`}>
              <div className="mb-4">
                <p className="text-sm font-semibold">Action permissions</p>
                <p className={`mt-1 text-xs ${muted}`}>Control what users assigned to this role can change or manage.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {privilegeItems.map((privilege) => <PermissionButton key={privilege.id} darkMode={darkMode} active={roleForm.privileges.includes(privilege.id)} label={privilege.label} onClick={() => toggleRoleField("privileges", privilege.id)} />)}
              </div>
            </div>

            <button disabled={saving} className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.99] disabled:opacity-60 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#1f2c3a] text-white"}`}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {roleForm.id ? "Save role" : "Create role"}
            </button>
          </form>
        </Modal>
      )}

      {userModalOpen && (
        <Modal darkMode={darkMode} title="Invite a new user" eyebrow="Access control" onClose={() => setUserModalOpen(false)} maxWidth="max-w-xl">
          <form onSubmit={createUser} className="space-y-5">
            <div className={`flex items-center gap-4 border-b border-dashed pb-5 ${darkMode ? "border-white/15" : "border-black/15"}`}>
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed ${darkMode ? "border-white/20 bg-white/5 text-[#d8f36a]" : "border-slate-300 bg-slate-50 text-slate-500"}`}>
                <UserPlus className="h-6 w-6" />
              </span>
              <div>
                <p className="text-base font-semibold">Create their workspace account</p>
                <p className={`mt-1 text-sm ${muted}`}>Add their login details and choose the access role they should receive.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${muted}`}>Username</span>
                <FieldInput darkMode={darkMode} value={userForm.username} onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))} placeholder="Enter username" required />
              </label>
              <label className="space-y-2">
                <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${muted}`}>Display name</span>
                <FieldInput darkMode={darkMode} value={userForm.displayName} onChange={(event) => setUserForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Enter full name" />
              </label>
            </div>

            <label className="block space-y-2">
              <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${muted}`}>Temporary password</span>
              <PasswordInput darkMode={darkMode} value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} placeholder="Create a password" required />
            </label>

            <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.045]" : "bg-[#f5f6f8]"}`}>
              <div className="mb-3">
                <p className="text-sm font-semibold">Assign role</p>
                <p className={`mt-1 text-xs ${muted}`}>The role controls visible modules and available actions.</p>
              </div>
              <SelectMenu darkMode={darkMode} value={userForm.roleId} options={roleOptions} onChange={(roleId) => setUserForm((current) => ({ ...current, roleId }))} />
            </div>

            <button disabled={saving} className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.99] disabled:opacity-60 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#1f2c3a] text-white"}`}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add user
            </button>
          </form>
        </Modal>
      )}

      {passwordModalOpen && (
        <Modal darkMode={darkMode} title="Reset password" eyebrow="Account security" onClose={() => setPasswordModalOpen(false)}>
          <form onSubmit={resetPassword} className="space-y-3">
            <PasswordInput darkMode={darkMode} value={passwordForm.password} onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))} placeholder="New password" required />
            <PasswordInput darkMode={darkMode} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} placeholder="Confirm password" required />
            <button disabled={saving} className={`flex h-12 w-full items-center justify-center gap-2 rounded-full ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Reset password
            </button>
          </form>
        </Modal>
      )}

      {detailModal && (() => {
        const role = detailModal.type === "role" ? detailModal.item : roleMap.get(detailModal.item.roleId);
        const user = detailModal.type === "user" ? detailModal.item : null;
        const assignedUsers = detailModal.type === "role" ? users.filter((item) => item.roleId === role.id) : [];
        return (
          <Modal darkMode={darkMode} title={detailModal.type === "role" ? role.name : user.displayName} eyebrow={detailModal.type === "role" ? "Role details" : "User details"} onClose={() => setDetailModal(null)} maxWidth="max-w-3xl">
            <div className="grid gap-3 sm:grid-cols-3">
              {detailModal.type === "role" ? (
                <>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}><p className={`text-xs ${muted}`}>Assigned users</p><p className="mt-2 text-2xl">{assignedUsers.length}</p></div>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}><p className={`text-xs ${muted}`}>Modules</p><p className="mt-2 text-2xl">{role.menus?.length || 0}</p></div>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}><p className={`text-xs ${muted}`}>Permissions</p><p className="mt-2 text-2xl">{role.privileges?.length || 0}</p></div>
                </>
              ) : (
                <>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}><p className={`text-xs ${muted}`}>Username</p><p className="mt-2 text-sm">{user.username}</p></div>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}><p className={`text-xs ${muted}`}>Role</p><p className="mt-2 text-sm">{role?.name || "No role"}</p></div>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}><p className={`text-xs ${muted}`}>Status</p><p className="mt-2 text-sm">{user.blacklisted ? "Blacklisted" : "Active"}</p></div>
                </>
              )}
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <p className={`mb-3 text-[11px] uppercase tracking-[0.22em] ${muted}`}>Visible modules</p>
                <div className="flex flex-wrap gap-2">{(role?.menus || []).map((id) => <Badge key={id} darkMode={darkMode} tone="accent">{menuItems.find((item) => item.id === id)?.label || id}</Badge>)}{!role?.menus?.length && <span className={`text-sm ${muted}`}>No modules assigned</span>}</div>
              </div>
              <div>
                <p className={`mb-3 text-[11px] uppercase tracking-[0.22em] ${muted}`}>Action permissions</p>
                <div className="flex flex-wrap gap-2">{(role?.privileges || []).map((id) => <Badge key={id} darkMode={darkMode}>{privilegeItems.find((item) => item.id === id)?.label || id}</Badge>)}{!role?.privileges?.length && <span className={`text-sm ${muted}`}>No action permissions assigned</span>}</div>
              </div>
            </div>
          </Modal>
        );
      })()}

      <ConfirmModal
        darkMode={darkMode}
        open={Boolean(deleteConfirm)}
        title={deleteConfirm?.type === "role" ? "Delete role" : "Delete user"}
        message={deleteConfirm?.type === "role" ? `Delete "${deleteConfirm.item?.name}"? This cannot be undone.` : `Delete "${deleteConfirm?.item?.displayName}" and remove the account?`}
        loading={deleting}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={performDelete}
      />
    </>
  );
}
