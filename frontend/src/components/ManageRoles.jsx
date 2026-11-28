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
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { Button, Chip, ConfirmModal, EmptyState, IconTile, Notice, PageHeader, SelectMenu, StatTile, cx } from "./ui";
import UserAvatar from "./UserAvatar";

const emptyRole = { id: "", name: "", description: "", menus: [], privileges: [] };
const emptyUser = { username: "", displayName: "", password: "", roleId: "", menus: [], privileges: [] };
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
      className={cx(
        "h-11 w-full rounded-full border px-4 text-[13.5px] outline-none transition",
        darkMode
          ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:ring-[3px] focus:ring-white/10"
          : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]",
        className,
      )}
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
        className={cx("absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full", darkMode ? "text-white/55 hover:bg-white/10" : "text-[#8a8a87] hover:bg-black/5")}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function FieldLabel({ darkMode, children }) {
  return <span className={cx("block text-[12.5px]", darkMode ? "text-white/55" : "text-[#8a8a8a]")}>{children}</span>;
}

function Modal({ darkMode, title, eyebrow, icon = ShieldCheck, tone = "lavender", onClose, children, maxWidth = "max-w-2xl" }) {
  return (
    <div className="ui-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px] newq">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        style={{ boxShadow: "var(--ui-shadow-pop)" }}
        className={cx("ui-pop flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border", maxWidth, darkMode ? "border-white/10 bg-[#121317] text-white" : "border-[#ececec] bg-white text-[#141414]")}
      >
        <header className={cx("flex items-center justify-between gap-3 border-b px-6 py-4", darkMode ? "border-white/10" : "border-[#f0f0ee]")}>
          <div className="flex min-w-0 items-center gap-3">
            <IconTile icon={icon} tone={tone} darkMode={darkMode} size="sm" />
            <div className="min-w-0">
              <h3 className="truncate text-[17px] tracking-[-0.01em]">{title}</h3>
              {eyebrow && <p className={cx("truncate text-[12.5px]", darkMode ? "text-white/45" : "text-[#8a8a8a]")}>{eyebrow}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]")}>
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
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
      className={cx(
        "flex min-h-9 items-center gap-2 rounded-full px-3.5 py-1.5 text-left text-[13px] transition disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white"
          : darkMode ? "bg-white/[0.05] text-white/65 hover:bg-white/[0.09]" : "bg-white text-[#3d3d3b] ring-1 ring-inset ring-[#ececec] hover:bg-[#fafaf9]",
      )}
    >
      <span className={cx("grid h-4 w-4 shrink-0 place-items-center rounded-full border", active ? "border-current" : darkMode ? "border-white/25" : "border-[#cfcfcb]")}>
        {active && <Check className="h-3 w-3" strokeWidth={2.5} />}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function AccessEditor({
  darkMode,
  muted,
  form,
  setForm,
  privilegeItems,
  moduleGroups,
  standaloneMenuItems,
  toggleAccessField,
  toggleAccessMenu,
  description = "Choose the pages this access profile can open from the sidebar.",
}) {
  const panel = cx("rounded-[20px] p-4 sm:p-5", darkMode ? "bg-white/[0.035]" : "bg-[#f7f7f5]");
  return (
    <>
      <div className={panel}>
        <div className="mb-4 flex items-center gap-3">
          <IconTile icon={LayoutGrid} tone="sky" darkMode={darkMode} size="sm" />
          <div>
            <p className="text-[14.5px]">Visible modules</p>
            <p className={`text-[12.5px] ${muted}`}>{description}</p>
          </div>
        </div>
        <div className="space-y-3">
          {moduleGroups.map((group) => {
            const parentActive = (form.menus || []).includes(group.parent.id);
            const activeChildren = group.children.filter((menu) => (form.menus || []).includes(menu.id));
            const allChildrenActive = group.children.length > 0 && activeChildren.length === group.children.length;
            return (
            <div key={group.parent.id} className={cx("rounded-[16px] border p-3.5", darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white")}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <PermissionButton
                  darkMode={darkMode}
                  active={parentActive}
                  label={group.parent.label}
                  onClick={() => toggleAccessMenu(setForm, group.parent.id)}
                />
                <span className={`px-1 text-[12px] ${muted}`}>
                  {activeChildren.length}/{group.children.length} submodules
                </span>
              </div>
              <div className={cx("mt-3 inline-flex flex-wrap rounded-full p-1", darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]")}>
                {[
                  ["none", "No access"],
                  ["parent", "Parent only"],
                  ["all", "All"],
                ].map(([mode, label]) => {
                  const active = mode === "none"
                    ? !parentActive
                    : mode === "parent"
                      ? parentActive && !activeChildren.length
                      : parentActive && allChildrenActive;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setForm((current) => {
                          const groupIds = new Set([group.parent.id, ...group.children.map((menu) => menu.id)]);
                          const rest = (current.menus || []).filter((id) => !groupIds.has(id));
                          if (mode === "none") return { ...current, menus: rest };
                          if (mode === "parent") return { ...current, menus: [...rest, group.parent.id] };
                          return { ...current, menus: [...rest, group.parent.id, ...group.children.map((menu) => menu.id)] };
                        });
                      }}
                      className={cx(
                        "h-8 rounded-full px-3.5 text-[12.5px] transition",
                        active
                          ? darkMode ? "bg-[#26272d] text-white" : "bg-white text-[#141414] shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                          : darkMode ? "text-white/55 hover:text-white" : "text-[#8a8a8a] hover:text-[#141414]",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {group.children.map((menu) => (
                  <PermissionButton
                    key={menu.id}
                    darkMode={darkMode}
                    active={(form.menus || []).includes(menu.id)}
                    label={menu.label}
                    onClick={() => toggleAccessMenu(setForm, menu.id)}
                  />
                ))}
              </div>
            </div>
            );
          })}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {standaloneMenuItems.map((menu) => (
              <PermissionButton
                key={menu.id}
                darkMode={darkMode}
                active={(form.menus || []).includes(menu.id)}
                label={menu.label}
                onClick={() => toggleAccessField(setForm, "menus", menu.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={panel}>
        <div className="mb-4 flex items-center gap-3">
          <IconTile icon={SlidersHorizontal} tone="peach" darkMode={darkMode} size="sm" />
          <div>
            <p className="text-[14.5px]">Action permissions</p>
            <p className={`text-[12.5px] ${muted}`}>Control what this access profile can change or manage.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {privilegeItems.map((privilege) => (
            <PermissionButton
              key={privilege.id}
              darkMode={darkMode}
              active={(form.privileges || []).includes(privilege.id)}
              label={privilege.label}
              onClick={() => toggleAccessField(setForm, "privileges", privilege.id)}
            />
          ))}
        </div>
      </div>
    </>
  );
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
  const [userAccessModal, setUserAccessModal] = useState(null);
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
  const menuById = useMemo(() => new Map(menuItems.map((menu) => [menu.id, menu])), [menuItems]);
  const moduleGroups = useMemo(() => menuItems
    .filter((menu) => menuItems.some((item) => item.parent === menu.id))
    .map((parent) => ({
      parent,
      children: menuItems.filter((menu) => menu.parent === parent.id),
    })), [menuItems]);
  const groupedMenuIds = useMemo(() => new Set(moduleGroups.flatMap((group) => [group.parent.id, ...group.children.map((menu) => menu.id)])), [moduleGroups]);
  const standaloneMenuItems = useMemo(
    () => menuItems.filter((menu) => !menu.parent && !groupedMenuIds.has(menu.id)),
    [groupedMenuIds, menuItems],
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

  function toggleAccessField(setter, field, value) {
    setter((current) => ({
      ...current,
      [field]: (current[field] || []).includes(value)
        ? (current[field] || []).filter((item) => item !== value)
        : [...(current[field] || []), value],
    }));
  }

  function toggleAccessMenu(setter, value) {
    setter((current) => {
      const currentMenus = current.menus || [];
      const active = currentMenus.includes(value);
      const item = menuById.get(value);
      const childIds = menuItems.filter((menu) => menu.parent === value).map((menu) => menu.id);
      const parentId = item?.parent;
      let menus = currentMenus;
      if (childIds.length) {
        const groupIds = new Set([value, ...childIds]);
        menus = active ? currentMenus.filter((id) => !groupIds.has(id)) : [...new Set([...currentMenus, value])];
      } else {
        menus = active
          ? currentMenus.filter((id) => id !== value)
          : [...new Set([...currentMenus, ...(parentId ? [parentId] : []), value])];
      }
      return { ...current, menus };
    });
  }

  function openUserAccess(user) {
    setUserAccessModal({
      id: user.id,
      displayName: user.displayName || user.username,
      username: user.username,
      menus: [...(user.userMenus || [])],
      privileges: [...(user.userPrivileges || [])],
    });
  }

  async function saveUserAccess(event) {
    event.preventDefault();
    if (!userAccessModal?.id) return;
    try {
      setSaving(true);
      await api(`/admin/users/${userAccessModal.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          menus: userAccessModal.menus || [],
          privileges: userAccessModal.privileges || [],
        }),
      });
      toast.success("User access updated");
      setUserAccessModal(null);
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || "Could not update user access");
    } finally {
      setSaving(false);
    }
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

  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const rowLine = darkMode ? "border-white/[0.07]" : "border-[#f0f0ee]";
  const iconButton = cx("grid h-8 w-8 place-items-center rounded-full transition-colors", darkMode ? "bg-white/[0.06] text-white/70 hover:bg-white/10" : "bg-[#f4f4f2] text-[#3d3d3b] hover:bg-[#ebebe8]");
  const dangerButton = cx("grid h-8 w-8 place-items-center rounded-full transition-colors", darkMode ? "bg-[#fb7185]/[0.12] text-[#f7aab5] hover:bg-[#fb7185]/20" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f7d6da]");

  if (loading) {
    return (
      <div className={`flex flex-1 items-center justify-center ${darkMode ? "text-white/60" : "text-[#8a8a8a]"}`}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const activeUserCount = users.filter((user) => !user.blacklisted).length;
  const blockedUserCount = users.length - activeUserCount;
  const customRoleCount = roles.filter((role) => !role.isSystem).length;
  const listIsEmpty = isRolesMode ? !filteredRoles.length : !filteredUsers.length;

  return (
    <>
    <main className={`flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 ${darkMode ? "text-white" : "text-[#141414]"}`}>
      <div className="mx-auto w-full max-w-[1400px]">
        <PageHeader
          darkMode={darkMode}
          badge={isRolesMode ? "Access · Roles" : "Access · Users"}
          badgeIcon={ShieldCheck}
          badgeTone="lavender"
          title={isRolesMode ? "Roles and permissions" : "People and accounts"}
          subtitle={isRolesMode ? "who can open what" : "who signs in, and as what"}
          description={isRolesMode ? "Create roles, choose the modules they see and the actions they can take." : "Create users, assign roles, reset passwords and manage account status."}
          actions={(
            <Button
              darkMode={darkMode}
              variant="primary"
              icon={isRolesMode ? Plus : UserPlus}
              onClick={isRolesMode ? openCreateRole : () => setUserModalOpen(true)}
            >
              {isRolesMode ? "Add role" : "Add user"}
            </Button>
          )}
        />

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {isRolesMode ? (
            <>
              <StatTile darkMode={darkMode} icon={ShieldCheck} tone="lavender" value={roles.length} label="roles" hint={`${customRoleCount} custom`} />
              <StatTile darkMode={darkMode} icon={LayoutGrid} tone="sky" value={menuItems.length} label="modules" />
              <StatTile darkMode={darkMode} icon={SlidersHorizontal} tone="peach" value={privilegeItems.length} label="action permissions" />
              <StatTile darkMode={darkMode} icon={Users} tone="mint" value={users.length} label="people assigned" />
            </>
          ) : (
            <>
              <StatTile darkMode={darkMode} icon={Users} tone="sky" value={users.length} label="users" />
              <StatTile darkMode={darkMode} icon={UserCheck} tone="mint" value={activeUserCount} label="active" />
              <StatTile darkMode={darkMode} icon={UserX} tone="rose" value={blockedUserCount} label="blacklisted" />
              <StatTile darkMode={darkMode} icon={ShieldCheck} tone="lavender" value={roles.length} label="roles to assign" />
            </>
          )}
        </div>

        <section className={cx("mt-6 rounded-[20px] border", darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white")}>
          <div className="flex flex-col gap-4 px-5 pt-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <IconTile icon={isRolesMode ? FileText : Users} tone={isRolesMode ? "lavender" : "sky"} darkMode={darkMode} size="sm" />
              <div>
                <h2 className="text-[15px]">{isRolesMode ? "Role records" : "User records"}</h2>
                <p className={`text-[12.5px] ${muted}`}>{isRolesMode ? "Module and permission access list" : "Role assignment and account status"}</p>
              </div>
            </div>
            <label className={cx("flex h-10 w-full items-center gap-2.5 rounded-full px-4 lg:w-[340px]", darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]")}>
              <Search className={`h-4 w-4 shrink-0 ${muted}`} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={isRolesMode ? "Search role, module..." : "Search user, role, status..."}
                className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-current placeholder:opacity-50"
              />
            </label>
          </div>
        <div className="overflow-x-auto px-5 pb-3 pt-4">
            {listIsEmpty ? (
              <EmptyState
                darkMode={darkMode}
                icon={Search}
                className="mb-2"
                title={normalizedSearch ? "Nothing matches this search" : isRolesMode ? "No roles yet" : "No users yet"}
                text={normalizedSearch ? "Try a different name, role or status." : isRolesMode ? "Add a role to start giving people access." : "Add a user to give someone a login."}
              />
            ) : activeTab === "roles" ? (
              <table className="w-full min-w-[960px] text-left">
                <thead>
                  <tr>
                    {["Name", "Description", "Modules", "Permissions", "Users", ""].map((heading) => (
                      <th key={heading || "actions"} className={`border-b px-3 pb-3 text-[12px] ${rowLine} ${muted}`}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.map((role) => {
                    const userCount = users.filter((user) => user.roleId === role.id).length;
                    return (
                      <tr key={role.id} className={cx("border-b transition-colors last:border-b-0", rowLine, darkMode ? "hover:bg-white/[0.025]" : "hover:bg-[#fafaf9]")}>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-3">
                            <IconTile icon={role.isSystem ? ShieldCheck : FileText} tone={role.isSystem ? "neutral" : "lavender"} darkMode={darkMode} size="sm" />
                            <div>
                              <p className="text-[14px]">{role.name}</p>
                              <p className={`text-[12px] ${muted}`}>{role.isSystem ? "System role" : "Custom role"}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`max-w-[280px] px-3 py-3.5 text-[13px] ${muted}`}><span className="block truncate">{role.description || "No description"}</span></td>
                        <td className="px-3 py-3.5"><Chip darkMode={darkMode} tone="sky">{role.menus?.length || 0} modules</Chip></td>
                        <td className="px-3 py-3.5"><Chip darkMode={darkMode} tone="peach">{role.privileges?.length || 0} permissions</Chip></td>
                        <td className="px-3 py-3.5 text-[14px] tabular-nums">{userCount}</td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button darkMode={darkMode} size="sm" variant="secondary" onClick={() => setDetailModal({ type: "role", item: role })}>
                              View
                            </Button>
                            {!role.isSystem && (
                              <button type="button" onClick={() => openEditRole(role)} className={iconButton} title="Edit role" aria-label="Edit role">
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {!role.isSystem && (
                              <button type="button" onClick={() => setDeleteConfirm({ type: "role", item: role })} className={dangerButton} title="Delete role" aria-label="Delete role">
                                <Trash2 className="h-3.5 w-3.5" />
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
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr>
                    {["Name", "Role", "Status", "Modules", "Permissions", ""].map((heading) => (
                      <th key={heading || "actions"} className={`border-b px-3 pb-3 text-[12px] ${rowLine} ${muted}`}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const role = roleMap.get(user.roleId);
                    const isSystemSuperAdmin = String(user.username || "").toLowerCase() === "adminuipl";
                    return (
                      <tr key={user.id} className={cx("border-b transition-colors last:border-b-0", rowLine, darkMode ? "hover:bg-white/[0.025]" : "hover:bg-[#fafaf9]")}>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} name={user.displayName || user.username} className="h-9 w-9" />
                            <div>
                              <p className="text-[14px]">{user.displayName}</p>
                              <p className={`text-[12px] ${muted}`}>{user.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <SelectMenu
                            darkMode={darkMode}
                            value={user.roleId || ""}
                            options={roleOptions}
                            onChange={(roleId) => updateUser(user.id, { roleId })}
                            disabled={isSystemSuperAdmin}
                            className="w-[180px]"
                            size="sm"
                          />
                        </td>
                        <td className="px-3 py-3"><Chip darkMode={darkMode} tone={user.blacklisted ? "rose" : "mint"}>{user.blacklisted ? "Blacklisted" : "Active"}</Chip></td>
                        <td className="px-3 py-3 text-[14px] tabular-nums">{user.menus?.length || role?.menus?.length || 0}</td>
                        <td className="px-3 py-3 text-[14px] tabular-nums">{user.privileges?.length || role?.privileges?.length || 0}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button darkMode={darkMode} size="sm" variant="secondary" onClick={() => setDetailModal({ type: "user", item: user })}>
                              View
                            </Button>
                            <button type="button" onClick={() => openPasswordModal(user)} className={iconButton} title="Reset password" aria-label="Reset password">
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>
                            {!user.isSuperAdmin && (
                              <button type="button" onClick={() => openUserAccess(user)} className={iconButton} title="User module access" aria-label="User module access">
                                <ShieldCheck className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {!user.isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => updateUser(user.id, { blacklisted: !user.blacklisted })}
                                className={cx("grid h-8 w-8 place-items-center rounded-full transition-colors", user.blacklisted ? (darkMode ? "bg-[#4ade80]/[0.12] text-[#a7e8bf]" : "bg-[#e4f1e6] text-[#2f7a4f]") : (darkMode ? "bg-[#fbbf24]/[0.12] text-[#f5d27a]" : "bg-[#fbf0d4] text-[#8a6200]"))}
                                title={user.blacklisted ? "Unblock user" : "Blacklist user"}
                                aria-label={user.blacklisted ? "Unblock user" : "Blacklist user"}
                              >
                                {user.blacklisted ? <Check className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            {!user.isSuperAdmin && (
                              <button type="button" onClick={() => setDeleteConfirm({ type: "user", item: user })} className={dangerButton} title="Delete user" aria-label="Delete user">
                                <Trash2 className="h-3.5 w-3.5" />
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
        </section>
      </div>
    </main>

      {roleModalOpen && (
        <Modal darkMode={darkMode} title={roleForm.id ? "Edit role" : "Add role"} eyebrow="Name the role, then pick its modules and actions" icon={ShieldCheck} tone="lavender" onClose={() => setRoleModalOpen(false)} maxWidth="max-w-3xl">
          <form onSubmit={saveRole} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <FieldLabel darkMode={darkMode}>Role name</FieldLabel>
                <FieldInput darkMode={darkMode} value={roleForm.name} onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Enter role name" required />
              </label>
              <label className="space-y-1.5">
                <FieldLabel darkMode={darkMode}>Description</FieldLabel>
                <FieldInput darkMode={darkMode} value={roleForm.description} onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe this role" />
              </label>
            </div>

            <AccessEditor
              darkMode={darkMode}
              muted={muted}
              form={roleForm}
              setForm={setRoleForm}
              privilegeItems={privilegeItems}
              moduleGroups={moduleGroups}
              standaloneMenuItems={standaloneMenuItems}
              toggleAccessField={toggleAccessField}
              toggleAccessMenu={toggleAccessMenu}
            />

            <Button type="submit" darkMode={darkMode} variant="primary" size="lg" disabled={saving} loading={saving} icon={ShieldCheck} className="w-full">
              {roleForm.id ? "Save role" : "Create role"}
            </Button>
          </form>
        </Modal>
      )}

      {userModalOpen && (
        <Modal darkMode={darkMode} title="Invite a new user" eyebrow="Login details and the role they get" icon={UserPlus} tone="sky" onClose={() => setUserModalOpen(false)} maxWidth="max-w-xl">
          <form onSubmit={createUser} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <FieldLabel darkMode={darkMode}>Username</FieldLabel>
                <FieldInput darkMode={darkMode} value={userForm.username} onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))} placeholder="Enter username" required />
              </label>
              <label className="space-y-1.5">
                <FieldLabel darkMode={darkMode}>Display name</FieldLabel>
                <FieldInput darkMode={darkMode} value={userForm.displayName} onChange={(event) => setUserForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Enter full name" />
              </label>
            </div>

            <label className="block space-y-1.5">
              <FieldLabel darkMode={darkMode}>Temporary password</FieldLabel>
              <PasswordInput darkMode={darkMode} value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} placeholder="Create a password" required />
            </label>

            <div className={cx("rounded-[20px] p-4 sm:p-5", darkMode ? "bg-white/[0.035]" : "bg-[#f7f7f5]")}>
              <div className="mb-3 flex items-center gap-3">
                <IconTile icon={ShieldCheck} tone="lavender" darkMode={darkMode} size="sm" />
                <div>
                  <p className="text-[14.5px]">Assign role</p>
                  <p className={`text-[12.5px] ${muted}`}>The role controls visible modules and available actions.</p>
                </div>
              </div>
              <SelectMenu darkMode={darkMode} value={userForm.roleId} options={roleOptions} onChange={(roleId) => setUserForm((current) => ({ ...current, roleId }))} />
            </div>

            <AccessEditor
              darkMode={darkMode}
              muted={muted}
              form={userForm}
              setForm={setUserForm}
              privilegeItems={privilegeItems}
              moduleGroups={moduleGroups}
              standaloneMenuItems={standaloneMenuItems}
              toggleAccessField={toggleAccessField}
              toggleAccessMenu={toggleAccessMenu}
              description="Optional extra access for this specific user on top of their role."
            />

            <Button type="submit" darkMode={darkMode} variant="primary" size="lg" disabled={saving} loading={saving} icon={UserPlus} className="w-full">
              Add user
            </Button>
          </form>
        </Modal>
      )}

      {userAccessModal && (
        <Modal darkMode={darkMode} title={`Access for ${userAccessModal.displayName}`} eyebrow="Extra access on top of their role" icon={ShieldCheck} tone="mint" onClose={() => setUserAccessModal(null)} maxWidth="max-w-3xl">
          <form onSubmit={saveUserAccess} className="space-y-5">
            <Notice darkMode={darkMode} tone="blue">
              User-specific access is added on top of the assigned role. Leave these empty to use only the role access for {userAccessModal.username}.
            </Notice>
            <AccessEditor
              darkMode={darkMode}
              muted={muted}
              form={userAccessModal}
              setForm={setUserAccessModal}
              privilegeItems={privilegeItems}
              moduleGroups={moduleGroups}
              standaloneMenuItems={standaloneMenuItems}
              toggleAccessField={toggleAccessField}
              toggleAccessMenu={toggleAccessMenu}
              description="Choose extra pages this specific user can open in addition to their role."
            />
            <Button type="submit" darkMode={darkMode} variant="primary" size="lg" disabled={saving} loading={saving} icon={ShieldCheck} className="w-full">
              Save user access
            </Button>
          </form>
        </Modal>
      )}

      {passwordModalOpen && (
        <Modal darkMode={darkMode} title="Reset password" eyebrow="Set a new password for this account" icon={KeyRound} tone="amber" onClose={() => setPasswordModalOpen(false)} maxWidth="max-w-md">
          <form onSubmit={resetPassword} className="space-y-3">
            <PasswordInput darkMode={darkMode} value={passwordForm.password} onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))} placeholder="New password" required />
            <PasswordInput darkMode={darkMode} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} placeholder="Confirm password" required />
            <Button type="submit" darkMode={darkMode} variant="primary" size="lg" disabled={saving} loading={saving} icon={KeyRound} className="mt-2 w-full">
              Reset password
            </Button>
          </form>
        </Modal>
      )}

      {detailModal && (() => {
        const role = detailModal.type === "role" ? detailModal.item : roleMap.get(detailModal.item.roleId);
        const user = detailModal.type === "user" ? detailModal.item : null;
        const assignedUsers = detailModal.type === "role" ? users.filter((item) => item.roleId === role.id) : [];
        const soft = cx("rounded-[16px] p-4", darkMode ? "bg-white/[0.04]" : "bg-[#f4f4f2]");
        return (
          <Modal
            darkMode={darkMode}
            title={detailModal.type === "role" ? role.name : user.displayName}
            eyebrow={detailModal.type === "role" ? "Role details" : "User details"}
            icon={detailModal.type === "role" ? ShieldCheck : Users}
            tone={detailModal.type === "role" ? "lavender" : "sky"}
            onClose={() => setDetailModal(null)}
            maxWidth="max-w-3xl"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {detailModal.type === "role" ? (
                <>
                  <StatTile darkMode={darkMode} icon={Users} tone="mint" value={assignedUsers.length} label="assigned users" className="min-h-[104px]" />
                  <StatTile darkMode={darkMode} icon={LayoutGrid} tone="sky" value={role.menus?.length || 0} label="modules" className="min-h-[104px]" />
                  <StatTile darkMode={darkMode} icon={SlidersHorizontal} tone="peach" value={role.privileges?.length || 0} label="permissions" className="min-h-[104px]" />
                </>
              ) : (
                <>
                  <div className={soft}><p className={`text-[12px] ${muted}`}>Username</p><p className="mt-1.5 text-[14px]">{user.username}</p></div>
                  <div className={soft}><p className={`text-[12px] ${muted}`}>Role</p><p className="mt-1.5 text-[14px]">{role?.name || "No role"}</p></div>
                  <div className={soft}><p className={`text-[12px] ${muted}`}>Status</p><div className="mt-1.5"><Chip darkMode={darkMode} tone={user.blacklisted ? "rose" : "mint"}>{user.blacklisted ? "Blacklisted" : "Active"}</Chip></div></div>
                </>
              )}
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <p className={`mb-3 text-[12.5px] ${muted}`}>Visible modules</p>
                <div className="flex flex-wrap gap-1.5">{(role?.menus || []).map((id) => <Chip key={id} darkMode={darkMode} tone="sky">{menuItems.find((item) => item.id === id)?.label || id}</Chip>)}{!role?.menus?.length && <span className={`text-[13px] ${muted}`}>No modules assigned</span>}</div>
              </div>
              <div>
                <p className={`mb-3 text-[12.5px] ${muted}`}>Action permissions</p>
                <div className="flex flex-wrap gap-1.5">{(role?.privileges || []).map((id) => <Chip key={id} darkMode={darkMode} tone="peach">{privilegeItems.find((item) => item.id === id)?.label || id}</Chip>)}{!role?.privileges?.length && <span className={`text-[13px] ${muted}`}>No action permissions assigned</span>}</div>
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
