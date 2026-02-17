import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  Company,
  CompanyInvite,
  CompanyMember,
  CompanyRole,
  Profile,
  UserRole,
} from "../types";
import {
  companyAPI,
  companyInviteAPI,
  companyMemberAPI,
  companyAdminAPI,
  roleAPI,
  profileAPI,
  storageAPI,
} from "../services/apiService";
import {
  getActiveCompanyId,
  getProfile,
  getUserId,
  setActiveCompanyId,
  setProfile,
  hasPermission,
} from "../services/supabaseAuth";
import { DEFAULT_PRINT_TEMPLATE_SETTINGS } from "../services/printSettings";

const ROLE_OPTIONS: UserRole[] = ["admin", "manager", "staff"];

const PERMISSION_CATALOG = [
  { key: "dashboard.view", label: "Dashboard: View" },
  { key: "products.read", label: "Products: View" },
  { key: "products.write", label: "Products: Create & Edit" },
  { key: "products.delete", label: "Products: Delete" },
  { key: "customers.read", label: "Customers: View" },
  { key: "customers.write", label: "Customers: Create & Edit" },
  { key: "customers.delete", label: "Customers: Delete" },
  { key: "vendors.read", label: "Vendors: View" },
  { key: "vendors.write", label: "Vendors: Create & Edit" },
  { key: "vendors.delete", label: "Vendors: Delete" },
  { key: "categories.read", label: "Categories: View" },
  { key: "categories.write", label: "Categories: Create & Edit" },
  { key: "categories.delete", label: "Categories: Delete" },
  { key: "sales_invoices.read", label: "Sales Invoices: View" },
  { key: "sales_invoices.write", label: "Sales Invoices: Create & Edit" },
  { key: "sales_invoices.delete", label: "Sales Invoices: Delete" },
  { key: "settings.view", label: "Settings: View" },
  { key: "settings.manage_company", label: "Settings: Manage Company" },
  { key: "settings.manage_members", label: "Settings: Manage Members" },
];

const SettingsPage: React.FC = () => {
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [companyDraft, setCompanyDraft] = useState({
    name: "",
    logoUrl: "",
    address: "",
    phone: "",
    ntn: "",
    branches: [] as string[],
  });
  const [branchInput, setBranchInput] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<UserRole>("staff");
  const [companyUsers, setCompanyUsers] = useState<(Profile & { memberId?: string })[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [activeSection, setActiveSection] = useState<"company" | "members" | "roles" | "print">(
    "company"
  );
  const [printSettings, setPrintSettings] = useState(DEFAULT_PRINT_TEMPLATE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentMemberRole = useMemo(() => {
    const member = members.find((m) => m.companyId === activeCompanyId);
    return member?.role;
  }, [members, activeCompanyId]);

  const isAdmin = currentMemberRole === "admin";
  const isSystemRole = (roleName?: string) =>
    ["admin", "manager", "staff"].includes((roleName || "").toLowerCase());
  const canManageCompany = isAdmin && hasPermission("settings.manage_company");
  const canManageMembers = isAdmin && hasPermission("settings.manage_members");
  const canViewSettings = hasPermission("settings.view");
  const roleOptions = useMemo<UserRole[]>(
    () => (roles.length > 0 ? roles.map((r) => r.name) : ROLE_OPTIONS),
    [roles]
  );
  const getRolePermissions = (roleName?: string) =>
    roles.find((r) => r.name === roleName)?.permissions || [];

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const myProfile = await profileAPI.getMyProfile();
      const normalized = {
        id: myProfile.id,
        email: myProfile.email,
        fullName: myProfile.full_name ?? myProfile.fullName,
        role: myProfile.role,
        companyId: myProfile.company_id ?? myProfile.companyId,
      } as Profile;
      setProfileState(normalized);
      setProfile(normalized);

      const userId = getUserId();
      if (userId) {
        const membershipRows = await companyAPI.listMyCompanies(userId);
        const mappedCompanies: Company[] = membershipRows
          .map((row: any) => row.companies)
          .filter((c: any) => Boolean(c))
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            logoUrl: c.logo_url ?? c.logoUrl,
            address: c.address,
            phone: c.phone,
            ntn: c.ntn,
            branches: c.branches,
            createdAt: c.created_at ?? c.createdAt,
          }));
        setCompanies(mappedCompanies);

        const mappedMembers = membershipRows.map((row: any) => ({
          id: row.id,
          userId: row.user_id ?? row.userId,
          companyId: row.company_id ?? row.companyId,
          role: row.role,
          createdAt: row.created_at ?? row.createdAt,
          company: row.companies
            ? {
                id: row.companies.id,
                name: row.companies.name,
                createdAt: row.companies.created_at ?? row.companies.createdAt,
              }
            : undefined,
        }));
        setMembers(mappedMembers);

        const storedCompanyId = getActiveCompanyId();
        const defaultCompanyId =
          storedCompanyId && mappedCompanies.some((c) => c.id === storedCompanyId)
            ? storedCompanyId
            : mappedCompanies[0]?.id || null;
        setActiveCompanyIdState(defaultCompanyId);
        if (defaultCompanyId) setActiveCompanyId(defaultCompanyId);

        if (defaultCompanyId) {
          const [companyMembers, inviteRows, roleRows] = await Promise.all([
            companyMemberAPI.listMembers(defaultCompanyId),
            companyInviteAPI.listInvites(defaultCompanyId),
            roleAPI.list(defaultCompanyId).catch(() => [] as CompanyRole[]),
          ]);
          const mappedProfiles = companyMembers.map((m: any) => ({
            id: m.user_id ?? m.userId ?? m.profiles?.id,
            email: m.profiles?.email,
            role: m.role,
            companyId: m.company_id ?? m.companyId,
            memberId: m.id,
          }));
          setCompanyUsers(mappedProfiles);
          const mappedRoles = Array.isArray(roleRows) ? roleRows : [];
          setRoles(mappedRoles);
          setSelectedRoleId(mappedRoles[0]?.id || null);
          setInvites(
            inviteRows.map((row: any) => ({
              id: row.id,
              companyId: row.company_id ?? row.companyId,
              email: row.email,
              role: row.role,
              status: row.status,
              invitedBy: row.invited_by ?? row.invitedBy,
              createdAt: row.created_at ?? row.createdAt,
              updatedAt: row.updated_at ?? row.updatedAt,
              lastSentAt: row.last_sent_at ?? row.lastSentAt,
            }))
          );
        } else {
          setCompanyUsers([]);
          setInvites([]);
          setRoles([]);
          setSelectedRoleId(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = getProfile();
    if (cached) {
      setProfileState(cached as Profile);
    }
    refresh();
  }, []);

  useEffect(() => {
    const current = companies.find((c) => c.id === activeCompanyId);
    if (current) {
      setCompanyDraft({
        name: current.name || "",
        logoUrl: current.logoUrl || "",
        address: current.address || "",
            phone: current.phone || "",
            ntn: current.ntn || "",
            branches: current.branches || [],
          });
      setBranchInput("");
    }
  }, [companies, activeCompanyId]);

  useEffect(() => {
    if (!activeCompanyId) return;
    roleAPI
      .list(activeCompanyId)
      .then((rows) => {
        const mapped = Array.isArray(rows) ? rows : [];
        setRoles(mapped);
        setSelectedRoleId((prev) => prev || mapped[0]?.id || null);
      })
      .catch(() => {
        // silent fail; roles UI will show empty state
      });
  }, [activeCompanyId]);

  useEffect(() => {
    const raw = localStorage.getItem("printTemplateSettings");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setPrintSettings((prev) => ({
        ...prev,
        ...parsed,
      }));
    } catch {
      // ignore invalid local storage payload
    }
  }, []);

  const handleCreateCompany = async () => {
    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await companyAPI.create(companyName.trim());
      const userId = getUserId();
      if (!userId) throw new Error("Not authenticated");
      try {
        await companyMemberAPI.addMember(created.id, userId, "admin");
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (!message.includes("duplicate") && !message.includes("23505")) {
          throw err;
        }
      }
      setCompanies((prev) => [...prev, { id: created.id, name: created.name }]);
      setActiveCompanyIdState(created.id);
      setActiveCompanyId(created.id);
      setCompanyUsers((prev) => [
        ...prev,
        { id: userId, email: profile?.email, role: "admin", companyId: created.id },
      ]);
      setCompanyName("");
      setSuccess("Company created. You are now the admin.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const member = companyUsers.find((u) => u.id === userId);
      if (!member?.memberId) throw new Error("Member not found");
      const updated = await companyMemberAPI.updateRole(member.memberId, role);
      setCompanyUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u))
      );
      setSuccess("Role updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  const normalizeLogoUrl = (url: string) =>
    url.includes("/storage/v1/object/") && !url.includes("/object/public/")
      ? url.replace("/storage/v1/object/", "/storage/v1/object/public/")
      : url;

  const handleUpdateCompany = async () => {
    if (!activeCompanyId) return;
    if (!companyDraft.name.trim()) {
      setError("Company name is required");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await companyAPI.update(activeCompanyId, {
        name: companyDraft.name.trim(),
        logo_url: companyDraft.logoUrl
          ? normalizeLogoUrl(companyDraft.logoUrl)
          : null,
        address: companyDraft.address || null,
        phone: companyDraft.phone || null,
        ntn: companyDraft.ntn || null,
        branches: companyDraft.branches || null,
      });
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === activeCompanyId
            ? {
                ...c,
                name: updated.name,
                logoUrl: updated.logoUrl
                  ? normalizeLogoUrl(updated.logoUrl)
                  : updated.logoUrl,
                address: updated.address,
                phone: updated.phone,
                ntn: updated.ntn,
                branches: updated.branches,
              }
            : c
        )
      );
      setSuccess("Company details updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update company");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!activeCompanyId) {
      setError("Select a company first.");
      return;
    }
    const confirmDelete = window.confirm(
      "Delete this company? This will remove all company data, delete member profiles, and delete manager/staff Auth users. This cannot be undone."
    );
    if (!confirmDelete) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await companyAdminAPI.deleteCompany(activeCompanyId);
      const remaining = companies.filter((c) => c.id !== activeCompanyId);
      setCompanies(remaining);
      const nextId = remaining[0]?.id || null;
      setActiveCompanyIdState(nextId);
      if (nextId) {
        setActiveCompanyId(nextId);
        const [companyMembers, inviteRows] = await Promise.all([
          companyMemberAPI.listMembers(nextId),
          companyInviteAPI.listInvites(nextId),
        ]);
        const mappedProfiles = companyMembers.map((m: any) => ({
          id: m.user_id ?? m.userId ?? m.profiles?.id,
          email: m.profiles?.email,
          role: m.role,
          companyId: m.company_id ?? m.companyId,
          memberId: m.id,
        }));
        setCompanyUsers(mappedProfiles);
        setInvites(
          inviteRows.map((row: any) => ({
            id: row.id,
            companyId: row.company_id ?? row.companyId,
            email: row.email,
            role: row.role,
            status: row.status,
            invitedBy: row.invited_by ?? row.invitedBy,
            createdAt: row.created_at ?? row.createdAt,
            updatedAt: row.updated_at ?? row.updatedAt,
            lastSentAt: row.last_sent_at ?? row.lastSentAt,
          }))
        );
      } else {
        setCompanyUsers([]);
        setInvites([]);
      }
      setSuccess("Company deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete company");
    } finally {
      setSaving(false);
    }
  };

  const seedDefaultRoles = async () => {
    if (!activeCompanyId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const allPerms = PERMISSION_CATALOG.map((p) => p.key);
      const managerPerms = allPerms.filter(
        (p) => !p.startsWith("settings.manage")
      );
      const staffPerms = allPerms.filter(
        (p) => p.endsWith(".read") || p === "dashboard.view"
      );
      const created = await Promise.all([
        roleAPI.create(activeCompanyId, "admin", allPerms, true),
        roleAPI.create(activeCompanyId, "manager", managerPerms, true),
        roleAPI.create(activeCompanyId, "staff", staffPerms, true),
      ]);
      setRoles(created);
      setSelectedRoleId(created[0]?.id || null);
      setSuccess("Default roles created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create roles");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!activeCompanyId) return;
    const name = newRoleName.trim();
    if (!name) {
      setError("Role name is required");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await roleAPI.create(activeCompanyId, name, []);
      setRoles((prev) => [...prev, created]);
      setSelectedRoleId(created.id);
      setNewRoleName("");
      setSuccess("Role created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await roleAPI.remove(roleId);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      setSelectedRoleId((prev) => (prev === roleId ? null : prev));
      setSuccess("Role deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermission = async (roleId: string, permission: string) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const current = role.permissions || [];
    const next = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await roleAPI.update(roleId, { permissions: next });
      setRoles((prev) => prev.map((r) => (r.id === roleId ? updated : r)));
      setSuccess("Permissions updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update permissions");
    } finally {
      setSaving(false);
    }
  };

  if (!canViewSettings) {
    return (
      <div className="p-5">
        <p className="text-slate-500 dark:text-slate-400">
          You do not have permission to view settings.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-5">
        <p className="text-slate-500 dark:text-slate-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
          Settings
        </h1>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          Manage company access and user roles.
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-xl">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl">
          {success}
        </div>
      )}

      {companies.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5">
          <h2 className="text-base font-black text-slate-900 dark:text-white uppercase mb-3">
            Create Company
          </h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-4">
            Create your company to start managing users and data.
          </p>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name"
              className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold text-slate-900 dark:text-white"
            />
            <button
              onClick={handleCreateCompany}
              disabled={saving}
              className="bg-orange-600 hover:bg-orange-700 text-white font-black px-3 py-2 rounded-2xl text-[10px] uppercase tracking-widest disabled:opacity-60"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {companies.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white uppercase">
                Company
              </h2>
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                <select
                  value={activeCompanyId || ""}
                  onChange={async (e) => {
                    const nextId = e.target.value;
                    setActiveCompanyIdState(nextId);
                    setActiveCompanyId(nextId);
                    const [companyMembers, inviteRows, roleRows] = await Promise.all([
                      companyMemberAPI.listMembers(nextId),
                      companyInviteAPI.listInvites(nextId),
                      roleAPI.list(nextId).catch(() => [] as CompanyRole[]),
                    ]);
                    const mappedProfiles = companyMembers.map((m: any) => ({
                      id: m.user_id ?? m.userId ?? m.profiles?.id,
                      email: m.profiles?.email,
                      role: m.role,
                      companyId: m.company_id ?? m.companyId,
                      memberId: m.id,
                    }));
                    setCompanyUsers(mappedProfiles);
                    const mappedRoles = Array.isArray(roleRows) ? roleRows : [];
                    setRoles(mappedRoles);
                    setSelectedRoleId(mappedRoles[0]?.id || null);
                    setInvites(
                      inviteRows.map((row: any) => ({
                        id: row.id,
                        companyId: row.company_id ?? row.companyId,
                        email: row.email,
                        role: row.role,
                        status: row.status,
                        invitedBy: row.invited_by ?? row.invitedBy,
                        createdAt: row.created_at ?? row.createdAt,
                        updatedAt: row.updated_at ?? row.updatedAt,
                        lastSentAt: row.last_sent_at ?? row.lastSentAt,
                      }))
                    );
                  }}
                  className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className="text-slate-500 dark:text-slate-400 text-sm">
                  {companies.find((c) => c.id === activeCompanyId)?.name}
                </span>
              </div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Your role: {currentMemberRole || "staff"}
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setActiveSection("company")}
                className={`px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                  activeSection === "company"
                    ? "bg-slate-900 text-white dark:bg-orange-600"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Company Details
              </button>
              <button
                onClick={() => setActiveSection("members")}
                className={`px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                  activeSection === "members"
                    ? "bg-slate-900 text-white dark:bg-orange-600"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Members & Invites
              </button>
              <button
                onClick={() => setActiveSection("roles")}
                className={`px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                  activeSection === "roles"
                    ? "bg-slate-900 text-white dark:bg-orange-600"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Roles & Permissions
              </button>
              <button
                onClick={() => setActiveSection("print")}
                className={`px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                  activeSection === "print"
                    ? "bg-slate-900 text-white dark:bg-orange-600"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Print & Template
              </button>
            </div>

            {activeSection === "company" && (
              <>
            <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase mb-3">
              Company Details
            </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={companyDraft.name}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Company name"
                className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold text-slate-900 dark:text-white"
              />
              <input
                value={companyDraft.phone}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="Phone"
                className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold text-slate-900 dark:text-white"
              />
              <input
                value={companyDraft.ntn}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, ntn: e.target.value }))
                }
                placeholder="NTN / Tax ID"
                className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold text-slate-900 dark:text-white"
              />
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Company Logo (PNG/JPEG)
                </label>
                <div className="relative group aspect-square max-w-[220px] rounded-[1.5rem] bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col items-center justify-center transition-all hover:border-orange-500/50">
                  {companyDraft.logoUrl ? (
                    <>
                      <img
                        src={normalizeLogoUrl(companyDraft.logoUrl)}
                        alt="Company logo preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="p-3 bg-white text-slate-900 rounded-xl font-bold shadow-xl hover:bg-orange-50 transition-all"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCompanyDraft((prev) => ({ ...prev, logoUrl: "" }))
                          }
                          className="p-3 bg-rose-600 text-white rounded-xl font-bold shadow-xl hover:bg-rose-700 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-5 pointer-events-none">
                      <div className="w-12 h-12 bg-orange-100 dark:bg-orange-950/40 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 text-orange-600">
                        ðŸ“·
                      </div>
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                        Upload Logo
                      </p>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium">
                        PNG or JPEG up to 2MB
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={logoInputRef}
                    className="hidden"
                    accept="image/png,image/jpeg"
                    disabled={!canManageCompany || logoUploading}
                    onChange={async (e) => {
                      const inputEl = e.currentTarget;
                      const file = inputEl.files?.[0];
                      if (!file || !activeCompanyId) return;
                      if (file.size > 2 * 1024 * 1024) {
                        setError("Logo must be under 2MB.");
                        inputEl.value = "";
                        return;
                      }
                      setLogoUploading(true);
                      setError(null);
                      setSuccess(null);
                      try {
                        const url = await storageAPI.uploadCompanyLogo(
                          activeCompanyId,
                          file
                        );
                        setCompanyDraft((prev) => ({ ...prev, logoUrl: url }));
                        setSuccess("Logo uploaded. Click Save Details to apply.");
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "Failed to upload logo"
                        );
                      } finally {
                        setLogoUploading(false);
                        inputEl.value = "";
                      }
                    }}
                  />
                  {!companyDraft.logoUrl && (
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                    disabled={!canManageCompany || logoUploading}
                      className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                    />
                  )}
                </div>
              </div>
              <input
                value={companyDraft.address}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="Address"
                className="md:col-span-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold text-slate-900 dark:text-white"
              />
              <div className="md:col-span-2 space-y-2">
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder="Add branch name"
                    className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = branchInput.trim();
                      if (!trimmed) return;
                      setCompanyDraft((prev) => ({
                        ...prev,
                        branches: prev.branches.includes(trimmed)
                          ? prev.branches
                          : [...prev.branches, trimmed],
                      }));
                      setBranchInput("");
                    }}
                    className="bg-slate-900 dark:bg-orange-600 text-white font-black px-5 py-2 rounded-2xl text-sm uppercase tracking-widest"
                  >
                    Add Branch
                  </button>
                </div>
                {companyDraft.branches.length === 0 ? (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    No branches added yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {companyDraft.branches.map((branch) => (
                      <span
                        key={branch}
                        className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-bold px-3 py-2 rounded-full"
                      >
                        {branch}
                        <button
                          type="button"
                          onClick={() =>
                            setCompanyDraft((prev) => ({
                              ...prev,
                              branches: prev.branches.filter((b) => b !== branch),
                            }))
                          }
                          className="text-slate-400 hover:text-rose-600"
                        >
                          Ã—
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleUpdateCompany}
                disabled={saving || !canManageCompany}
                className="bg-slate-900 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-500 text-white font-black px-3 py-2 rounded-2xl text-[10px] uppercase tracking-widest disabled:opacity-60"
              >
                Save Details
              </button>
              {canManageCompany && (
                <button
                  onClick={handleDeleteCompany}
                  disabled={saving}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black px-3 py-2 rounded-2xl text-[10px] uppercase tracking-widest disabled:opacity-60"
                >
                  Delete Company
                </button>
              )}
              {!canManageCompany && (
                <p className="text-[10px] text-slate-400">Only admins can edit.</p>
              )}
            </div>
              </>
            )}
          </div>

          {activeSection === "roles" && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase mb-3">
                Roles & Permissions
              </h3>
              {!canManageMembers && (
                <p className="text-[10px] text-slate-400">
                  Only admins can manage roles and permissions.
                </p>
              )}
              {canManageMembers && (
                <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {roles.length === 0 ? (
                        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            No roles yet. Create a role or seed defaults.
                          </p>
                          <button
                            onClick={seedDefaultRoles}
                            disabled={saving || !canManageMembers}
                            className="mt-3 w-full bg-slate-900 dark:bg-orange-600 text-white font-black px-3 py-2 rounded-2xl text-[10px] uppercase tracking-widest disabled:opacity-60"
                          >
                            Seed Default Roles
                          </button>
                        </div>
                      ) : (
                        roles.map((role) => (
                          <button
                            key={role.id}
                            onClick={() => setSelectedRoleId(role.id)}
                            className={`w-full text-left px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                              selectedRoleId === role.id
                                ? "bg-slate-900 text-white dark:bg-orange-600"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {role.name}
                          </button>
                        ))
                      )}
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 space-y-2">
                      <input
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="New role name"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold"
                      />
                      <button
                        onClick={handleCreateRole}
                        disabled={saving || !canManageMembers}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black px-3 py-2 rounded-2xl text-[10px] uppercase tracking-widest disabled:opacity-60"
                      >
                        Create Role
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                    {roles.length === 0 ? (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Select a role to manage permissions.
                      </p>
                    ) : (
                      (() => {
                        const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0];
                        if (!selectedRole) {
                          return (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              Select a role to manage permissions.
                            </p>
                          );
                        }
                        const selectedPermissions = selectedRole.permissions || [];
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
                                  {selectedRole.name}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Toggle what this role can access.
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteRole(selectedRole.id)}
                                disabled={saving || !canManageMembers || selectedRole.isSystem || isSystemRole(selectedRole.name)}
                                className="text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 disabled:opacity-50"
                              >
                                Delete Role
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {PERMISSION_CATALOG.map((perm) => (
                                <label
                                  key={perm.key}
                                  className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                                >
                                  <span>{perm.label}</span>
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={selectedPermissions.includes(perm.key)}
                                    onChange={() =>
                                      handleTogglePermission(selectedRole.id, perm.key)
                                    }
                                    disabled={!canManageMembers}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === "members" && (
            <div className="space-y-4">
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase mb-3">
              Add Member
            </h3>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="User email"
                className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold"
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as UserRole)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (!activeCompanyId) return;
                  setSaving(true);
                  setError(null);
                  setSuccess(null);
                  try {
                    await companyMemberAPI.inviteMember(
                      activeCompanyId,
                      newMemberEmail.trim(),
                      newMemberRole
                    );
                    const [companyMembers, inviteRows] = await Promise.all([
                      companyMemberAPI.listMembers(activeCompanyId),
                      companyInviteAPI.listInvites(activeCompanyId),
                    ]);
                    const mappedProfiles = companyMembers.map((m: any) => ({
                      id: m.user_id ?? m.userId,
                      email: m.profiles?.email,
                      role: m.role,
                      companyId: m.company_id ?? m.companyId,
                      memberId: m.id,
                    }));
                    setCompanyUsers(mappedProfiles);
                    setInvites(
                      inviteRows.map((row: any) => ({
                        id: row.id,
                        companyId: row.company_id ?? row.companyId,
                        email: row.email,
                        role: row.role,
                        status: row.status,
                        invitedBy: row.invited_by ?? row.invitedBy,
                        createdAt: row.created_at ?? row.createdAt,
                        updatedAt: row.updated_at ?? row.updatedAt,
                        lastSentAt: row.last_sent_at ?? row.lastSentAt,
                      }))
                    );
                    setNewMemberEmail("");
                    setSuccess("Invite sent");
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Failed to add member"
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving || !canManageMembers}
                className="bg-orange-600 hover:bg-orange-700 text-white font-black px-3 py-2 rounded-2xl text-sm uppercase tracking-widest disabled:opacity-60"
              >
                Add
              </button>
            </div>
            {!canManageMembers && (
              <p className="text-[10px] text-slate-400 mt-2">
                Only admins can add members.
              </p>
            )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase mb-3">
              Team Members
            </h3>
            {companyUsers.length === 0 ? (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                No users found.
              </p>
            ) : (
              <div className="space-y-3">
                {companyUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-3 py-2"
                  >
                    <div>
                      <p className="text-[10px] font-black text-slate-900 dark:text-white">
                        {user.email || user.fullName || user.id}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {user.id}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                          Perms: {getRolePermissions(user.role).length}
                        </span>
                        {canManageMembers ? (
                          <select
                            value={user.role}
                            onChange={(e) =>
                              handleRoleChange(user.id, e.target.value as UserRole)
                            }
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                            disabled={saving || user.id === profile?.id}
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {user.role}
                          </span>
                        )}
                        {canManageMembers && user.id !== profile?.id && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                if (!activeCompanyId) {
                                  setError("Select a company first.");
                                  return;
                                }
                                if (!user.id) {
                                  setError("User id missing. Refresh the page.");
                                  return;
                                }
                                setSaving(true);
                                setError(null);
                                setSuccess(null);
                                try {
                                  await companyMemberAPI.removeMemberByUser(
                                    activeCompanyId,
                                    user.id,
                                    false
                                  );
                                  const [companyMembers, inviteRows] = await Promise.all([
                                    companyMemberAPI.listMembers(activeCompanyId),
                                    companyInviteAPI.listInvites(activeCompanyId),
                                  ]);
                                  const mappedProfiles = companyMembers.map((m: any) => ({
                                    id: m.user_id ?? m.userId ?? m.profiles?.id,
                                    email: m.profiles?.email,
                                    role: m.role,
                                    companyId: m.company_id ?? m.companyId,
                                    memberId: m.id,
                                  }));
                                  setCompanyUsers(mappedProfiles);
                                  setInvites(
                                    inviteRows.map((row: any) => ({
                                      id: row.id,
                                      companyId: row.company_id ?? row.companyId,
                                      email: row.email,
                                      role: row.role,
                                      status: row.status,
                                      invitedBy: row.invited_by ?? row.invitedBy,
                                      createdAt: row.created_at ?? row.createdAt,
                                      updatedAt: row.updated_at ?? row.updatedAt,
                                      lastSentAt: row.last_sent_at ?? row.lastSentAt,
                                    }))
                                  );
                                  setSuccess("User removed from company");
                                } catch (err) {
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to remove user"
                                  );
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              className="text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700"
                            >
                              Remove
                            </button>
                            <button
                              onClick={async () => {
                                if (!activeCompanyId) {
                                  setError("Select a company first.");
                                  return;
                                }
                                if (!user.id) {
                                  setError("User id missing. Refresh the page.");
                                  return;
                                }
                                const confirmDelete = window.confirm(
                                  "Delete this user from Supabase Auth? This cannot be undone."
                                );
                                if (!confirmDelete) return;
                                setSaving(true);
                                setError(null);
                                setSuccess(null);
                                try {
                                  await companyMemberAPI.removeMemberByUser(
                                    activeCompanyId,
                                    user.id,
                                    true
                                  );
                                  const [companyMembers, inviteRows] = await Promise.all([
                                    companyMemberAPI.listMembers(activeCompanyId),
                                    companyInviteAPI.listInvites(activeCompanyId),
                                  ]);
                                  const mappedProfiles = companyMembers.map((m: any) => ({
                                    id: m.user_id ?? m.userId ?? m.profiles?.id,
                                    email: m.profiles?.email,
                                    role: m.role,
                                    companyId: m.company_id ?? m.companyId,
                                    memberId: m.id,
                                  }));
                                  setCompanyUsers(mappedProfiles);
                                  setInvites(
                                    inviteRows.map((row: any) => ({
                                      id: row.id,
                                      companyId: row.company_id ?? row.companyId,
                                      email: row.email,
                                      role: row.role,
                                      status: row.status,
                                      invitedBy: row.invited_by ?? row.invitedBy,
                                      createdAt: row.created_at ?? row.createdAt,
                                      updatedAt: row.updated_at ?? row.updatedAt,
                                      lastSentAt: row.last_sent_at ?? row.lastSentAt,
                                    }))
                                  );
                                  setSuccess("User deleted from Auth");
                                } catch (err) {
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to delete user"
                                  );
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              className="text-[10px] font-black uppercase tracking-widest text-rose-700 hover:text-rose-800"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase mb-3">
              Pending Invites
            </h3>
            {invites.length === 0 ? (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                No pending invites.
              </p>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-3 py-2"
                  >
                    <div>
                      <p className="text-[10px] font-black text-slate-900 dark:text-white">
                        {invite.email}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Role: {invite.role} â€¢ Status: {invite.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!activeCompanyId) return;
                          setSaving(true);
                          setError(null);
                          setSuccess(null);
                          try {
                            await companyMemberAPI.inviteMember(
                              activeCompanyId,
                              invite.email,
                              invite.role
                            );
                            const inviteRows = await companyInviteAPI.listInvites(
                              activeCompanyId
                            );
                            setInvites(
                              inviteRows.map((row: any) => ({
                                id: row.id,
                                companyId: row.company_id ?? row.companyId,
                                email: row.email,
                                role: row.role,
                                status: row.status,
                                invitedBy: row.invited_by ?? row.invitedBy,
                                createdAt: row.created_at ?? row.createdAt,
                                updatedAt: row.updated_at ?? row.updatedAt,
                                lastSentAt: row.last_sent_at ?? row.lastSentAt,
                              }))
                            );
                            setSuccess("Invite sent");
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Failed to resend invite"
                            );
                          } finally {
                            setSaving(false);
                          }
                        }}
                        disabled={!canManageMembers || saving}
                        className="bg-slate-900 dark:bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl disabled:opacity-60"
                      >
                        Resend
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
              </div>
            </div>
          )}

          {activeSection === "print" && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase mb-3">
                Print & Template Settings
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-4">
                Customize default print behavior and layout visibility.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Default Template
                  </label>
                  <select
                    value={printSettings.defaultTemplate}
                    onChange={(e) =>
                      setPrintSettings((prev) => ({
                        ...prev,
                        defaultTemplate: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold"
                  >
                    <option value="invoice">Invoice</option>
                    <option value="receipt">Receipt</option>
                    <option value="a5">A5</option>
                    <option value="token">Product Token</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Footer Text
                  </label>
                  <input
                    value={printSettings.footerText}
                    onChange={(e) =>
                      setPrintSettings((prev) => ({
                        ...prev,
                        footerText: e.target.value,
                      }))
                    }
                    placeholder="Thank you for your business"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold"
                  />
                </div>

                <label className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  <span>Show Company Logo</span>
                  <input
                    type="checkbox"
                    checked={printSettings.showCompanyLogo}
                    onChange={(e) =>
                      setPrintSettings((prev) => ({
                        ...prev,
                        showCompanyLogo: e.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  <span>Show Company Address</span>
                  <input
                    type="checkbox"
                    checked={printSettings.showCompanyAddress}
                    onChange={(e) =>
                      setPrintSettings((prev) => ({
                        ...prev,
                        showCompanyAddress: e.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  <span>Show Tax ID (NTN)</span>
                  <input
                    type="checkbox"
                    checked={printSettings.showTaxId}
                    onChange={(e) =>
                      setPrintSettings((prev) => ({
                        ...prev,
                        showTaxId: e.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  <span>Show Invoice Notes</span>
                  <input
                    type="checkbox"
                    checked={printSettings.showNotes}
                    onChange={(e) =>
                      setPrintSettings((prev) => ({
                        ...prev,
                        showNotes: e.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  <span>Show Urdu Name In Print</span>
                  <input
                    type="checkbox"
                    checked={Boolean((printSettings as any).showUrduName)}
                    onChange={(e) =>
                      setPrintSettings((prev) => ({
                        ...prev,
                        showUrduName: e.target.checked,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="mt-4">
                <button
                  onClick={() => {
                    localStorage.setItem(
                      "printTemplateSettings",
                      JSON.stringify(printSettings)
                    );
                    setSuccess("Print template settings saved");
                    setError(null);
                  }}
                  disabled={saving || !canManageCompany}
                  className="bg-slate-900 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-500 text-white font-black px-3 py-2 rounded-2xl text-[10px] uppercase tracking-widest disabled:opacity-60"
                >
                  Save Print Settings
                </button>
                {!canManageCompany && (
                  <p className="text-[10px] text-slate-400 mt-2">
                    Only admins can change print settings.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsPage;


