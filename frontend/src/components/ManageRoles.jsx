"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  Check,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
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
            <h3 className="text-2xl font-semibold">{title}</h3>
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

export default function ManageRoles({ darkMode }) {
  const [activeTab, setActiveTab] = useState("roles");
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

  const roleMap = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);
  const roleOptions = roles.map((role) => ({ value: role.id, label: role.name }));

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
  const tablePanel = darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/5 bg-white";

  if (loading) {
    return (
      <div className={`flex flex-1 items-center justify-center ${darkMode ? "bg-[#0f1115] text-white" : "bg-[#f6f6f4] text-black"}`}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`flex flex-1 min-h-0 flex-col overflow-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#0c0d10]" : "bg-[#f5f4ef]"}`}>
      <div className={`flex min-h-0 flex-1 flex-col rounded-[24px] border p-4 sm:p-6 lg:rounded-[30px] ${darkMode ? "border-white/10 bg-white/[0.02]" : "border-black/5 bg-white/70"}`}>
        <div className="mb-5 flex shrink-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className={`mb-2 text-[11px] uppercase tracking-[0.3em] ${muted}`}>Access administration</p>
            <h2 className={`text-2xl font-semibold small sm:text-3xl ${darkMode ? "text-white" : "text-black"}`}>Roles and users</h2>
            <p className={`mt-2 text-sm ${muted}`}>Assign modules, action permissions, roles, and account controls.</p>
          </div>
          <button
            type="button"
            onClick={activeTab === "roles" ? openCreateRole : () => setUserModalOpen(true)}
            className={`flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}
          >
            {activeTab === "roles" ? <Plus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {activeTab === "roles" ? "Add Role" : "Add User"}
          </button>
        </div>

        <div className={`mb-5 grid w-full max-w-md shrink-0 grid-cols-2 rounded-2xl p-1 ${darkMode ? "bg-white/5" : "bg-black/[0.04]"}`}>
          {[
            ["roles", ShieldCheck, "Manage Roles", roles.length],
            ["users", Users, "Manage Users", users.length],
          ].map(([value, Icon, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm transition ${
                activeTab === value
                  ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"
                  : darkMode ? "text-white/55" : "text-black/55"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              <span className="text-xs opacity-65">{count}</span>
            </button>
          ))}
        </div>

        <div className={`min-h-0 flex-1 overflow-hidden rounded-[24px] border ${tablePanel}`}>
          <div className="h-full overflow-auto">
            {activeTab === "roles" ? (
              <table className="w-full min-w-[900px] text-left">
                <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                  <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                    {["Role", "Description", "Modules", "Permissions", "Users", "Actions"].map((heading) => (
                      <th key={heading} className={`px-5 py-4 text-[11px] font-medium uppercase tracking-[0.2em] ${muted}`}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => {
                    const userCount = users.filter((user) => user.roleId === role.id).length;
                    return (
                      <tr key={role.id} className={`transition ${darkMode ? "border-b border-white/5 hover:bg-white/[0.03]" : "border-b border-black/5 hover:bg-black/[0.02]"}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-black/[0.04] text-black/60"}`}>
                              <ShieldCheck className="h-4 w-4" />
                            </span>
                            <div>
                              <p className={`text-sm  ${darkMode ? "text-white" : "text-black"}`}>{role.name}</p>
                              {role.isSystem && <p className={`mt-1 text-xs ${muted}`}>System role</p>}
                            </div>
                          </div>
                        </td>
                        <td className={`max-w-[260px] px-5 py-4 text-sm ${muted}`}><span className="block truncate">{role.description || "No description"}</span></td>
                        <td className="px-5 py-4"><Badge darkMode={darkMode} tone="accent">{role.menus?.length || 0} modules</Badge></td>
                        <td className="px-5 py-4"><Badge darkMode={darkMode}>{role.privileges?.length || 0} permissions</Badge></td>
                        <td className={`px-5 py-4 text-sm ${muted}`}>{userCount}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setDetailModal({ type: "role", item: role })} className={`flex h-9 items-center gap-2 rounded-full px-3 text-xs ${darkMode ? "bg-white/5 text-white/70" : "bg-black/[0.04] text-black/65"}`}>
                              <Eye className="h-3.5 w-3.5" /> Details
                            </button>
                            {!role.isSystem && (
                              <button onClick={() => openEditRole(role)} className={`flex h-9 w-9 items-center justify-center rounded-full ${darkMode ? "hover:bg-white/10 text-white/60" : "hover:bg-black/5 text-black/55"}`} title="Edit role">
                                <Edit3 className="h-4 w-4" />
                              </button>
                            )}
                            {!role.isSystem && (
                              <button onClick={() => setDeleteConfirm({ type: "role", item: role })} className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10" title="Delete role">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[940px] text-left">
                <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                  <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                    {["User", "Role", "Status", "Modules", "Permissions", "Actions"].map((heading) => (
                      <th key={heading} className={`px-5 py-4 text-[11px] font-medium uppercase tracking-[0.2em] ${muted}`}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const role = roleMap.get(user.roleId);
                    return (
                      <tr key={user.id} className={`transition ${darkMode ? "border-b border-white/5 hover:bg-white/[0.03]" : "border-b border-black/5 hover:bg-black/[0.02]"}`}>
                        <td className="px-5 py-4">
                          <p className={`text-sm  ${darkMode ? "text-white" : "text-black"}`}>{user.displayName}</p>
                          <p className={`mt-1 text-xs ${muted}`}>{user.username}</p>
                        </td>
                        <td className="px-5 py-4">
                          <SelectMenu
                            darkMode={darkMode}
                            value={user.roleId || ""}
                            options={roleOptions}
                            onChange={(roleId) => updateUser(user.id, { roleId })}
                            disabled={user.isSuperAdmin}
                            className="w-[180px]"
                          />
                        </td>
                        <td className="px-5 py-4"><Badge darkMode={darkMode} tone={user.blacklisted ? "danger" : "success"}>{user.blacklisted ? "Blacklisted" : "Active"}</Badge></td>
                        <td className={`px-5 py-4 text-sm ${muted}`}>{role?.menus?.length || 0}</td>
                        <td className={`px-5 py-4 text-sm ${muted}`}>{role?.privileges?.length || 0}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setDetailModal({ type: "user", item: user })} className={`flex h-9 items-center gap-2 rounded-full px-3 text-xs ${darkMode ? "bg-white/5 text-white/70" : "bg-black/[0.04] text-black/65"}`}>
                              <Eye className="h-3.5 w-3.5" /> Details
                            </button>
                            <button onClick={() => openPasswordModal(user)} className={`flex h-9 w-9 items-center justify-center rounded-full ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`} title="Reset password">
                              <KeyRound className="h-4 w-4" />
                            </button>
                            {!user.isSuperAdmin && (
                              <button onClick={() => updateUser(user.id, { blacklisted: !user.blacklisted })} className={`flex h-9 w-9 items-center justify-center rounded-full ${user.blacklisted ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`} title={user.blacklisted ? "Unblock user" : "Blacklist user"}>
                                {user.blacklisted ? <Check className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                              </button>
                            )}
                            {!user.isSuperAdmin && (
                              <button onClick={() => setDeleteConfirm({ type: "user", item: user })} className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10" title="Delete user">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {roleModalOpen && (
        <Modal darkMode={darkMode} title={roleForm.id ? "Edit role" : "Add role"} eyebrow="Role configuration" onClose={() => setRoleModalOpen(false)} maxWidth="max-w-3xl">
          <form onSubmit={saveRole} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldInput darkMode={darkMode} value={roleForm.name} onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Role name" required />
              <FieldInput darkMode={darkMode} value={roleForm.description} onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
            </div>
            <div>
              <p className={`mb-3 text-[11px] uppercase tracking-[0.22em] ${muted}`}>Visible modules</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {menuItems.map((menu) => <PermissionButton key={menu.id} darkMode={darkMode} active={roleForm.menus.includes(menu.id)} label={menu.label} onClick={() => toggleRoleField("menus", menu.id)} />)}
              </div>
            </div>
            <div>
              <p className={`mb-3 text-[11px] uppercase tracking-[0.22em] ${muted}`}>Action permissions</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {privilegeItems.map((privilege) => <PermissionButton key={privilege.id} darkMode={darkMode} active={roleForm.privileges.includes(privilege.id)} label={privilege.label} onClick={() => toggleRoleField("privileges", privilege.id)} />)}
              </div>
            </div>
            <button disabled={saving} className={`flex h-12 w-full items-center justify-center gap-2 rounded-full disabled:opacity-60 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {roleForm.id ? "Save role" : "Create role"}
            </button>
          </form>
        </Modal>
      )}

      {userModalOpen && (
        <Modal darkMode={darkMode} title="Add user" eyebrow="User account" onClose={() => setUserModalOpen(false)}>
          <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-2">
            <FieldInput darkMode={darkMode} value={userForm.username} onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))} placeholder="Username" required />
            <FieldInput darkMode={darkMode} value={userForm.displayName} onChange={(event) => setUserForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Display name" />
            <PasswordInput darkMode={darkMode} value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} placeholder="Password" required />
            <SelectMenu darkMode={darkMode} value={userForm.roleId} options={roleOptions} onChange={(roleId) => setUserForm((current) => ({ ...current, roleId }))} />
            <button disabled={saving} className={`flex h-12 items-center justify-center gap-2 rounded-full sm:col-span-2 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
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
    </div>
  );
}
