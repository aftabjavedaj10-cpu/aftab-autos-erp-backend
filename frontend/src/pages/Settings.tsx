import React, { useEffect, useMemo, useState } from "react";
import type { Company, CompanyInvite, CompanyMember, Profile, UserRole } from "../types";
import {
  companyAPI,
  companyInviteAPI,
  companyMemberAPI,
  profileAPI,
} from "../services/apiService";
import {
  getActiveCompanyId,
  getProfile,
  getUserId,
  setActiveCompanyId,
  setProfile,
} from "../services/supabaseAuth";

const ROLE_OPTIONS: UserRole[] = ["admin", "manager", "staff"];

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
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<UserRole>("staff");
  const [companyUsers, setCompanyUsers] = useState<(Profile & { memberId?: string })[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentMemberRole = useMemo(() => {
    const member = members.find((m) => m.companyId === activeCompanyId);
    return member?.role;
  }, [members, activeCompanyId]);

  const isAdmin = currentMemberRole === "admin";

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
          const [companyMembers, inviteRows] = await Promise.all([
            companyMemberAPI.listMembers(defaultCompanyId),
            companyInviteAPI.listInvites(defaultCompanyId),
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
        } else {
          setCompanyUsers([]);
          setInvites([]);
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
      await companyMemberAPI.addMember(created.id, userId, "admin");
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
        logo_url: companyDraft.logoUrl || null,
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
                logoUrl: updated.logoUrl,
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

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-slate-500 dark:text-slate-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
          Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          Manage company access and user roles.
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl">
          {success}
        </div>
      )}

      {companies.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6">
          <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase mb-3">
            Create Company
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Create your company to start managing users and data.
          </p>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name"
              className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
            />
            <button
              onClick={handleCreateCompany}
              disabled={saving}
              className="bg-orange-600 hover:bg-orange-700 text-white font-black px-6 py-3 rounded-2xl text-sm uppercase tracking-widest disabled:opacity-60"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {companies.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase">
                Company
              </h2>
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                <select
                  value={activeCompanyId || ""}
                  onChange={async (e) => {
                    const nextId = e.target.value;
                    setActiveCompanyIdState(nextId);
                    setActiveCompanyId(nextId);
                    const [companyMembers, inviteRows] = await Promise.all([
                      companyMemberAPI.listMembers(nextId),
                      companyInviteAPI.listInvites(nextId),
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
                  }}
                  className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2 text-sm font-bold"
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
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">
              Your role: {currentMemberRole || "staff"}
            </div>
          </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3">
            Company Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={companyDraft.name}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Company name"
                className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
              />
              <input
                value={companyDraft.phone}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="Phone"
                className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
              />
              <input
                value={companyDraft.ntn}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, ntn: e.target.value }))
                }
                placeholder="NTN / Tax ID"
                className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
              />
              <input
                value={companyDraft.logoUrl}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, logoUrl: e.target.value }))
                }
                placeholder="Logo URL"
                className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
              />
              <input
                value={companyDraft.address}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="Address"
                className="md:col-span-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
              />
              <div className="md:col-span-2 space-y-2">
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder="Add branch name"
                    className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
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
                    className="bg-slate-900 dark:bg-orange-600 text-white font-black px-5 py-3 rounded-2xl text-sm uppercase tracking-widest"
                  >
                    Add Branch
                  </button>
                </div>
                {companyDraft.branches.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No branches added yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {companyDraft.branches.map((branch) => (
                      <span
                        key={branch}
                        className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-2 rounded-full"
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
                          ×
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
                disabled={saving || !isAdmin}
                className="bg-slate-900 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-500 text-white font-black px-6 py-3 rounded-2xl text-sm uppercase tracking-widest disabled:opacity-60"
              >
                Save Details
              </button>
              {!isAdmin && (
                <p className="text-xs text-slate-400">Only admins can edit.</p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3">
              Add Member
            </h3>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="User email"
                className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2 text-sm font-bold"
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as UserRole)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2 text-sm font-bold"
              >
                {ROLE_OPTIONS.map((role) => (
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
                disabled={saving || !isAdmin}
                className="bg-orange-600 hover:bg-orange-700 text-white font-black px-5 py-2 rounded-2xl text-sm uppercase tracking-widest disabled:opacity-60"
              >
                Add
              </button>
            </div>
            {!isAdmin && (
              <p className="text-xs text-slate-400 mt-2">
                Only admins can add members.
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3">
              Team Members
            </h3>
            {companyUsers.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No users found.
              </p>
            ) : (
              <div className="space-y-3">
                {companyUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {user.email || user.fullName || user.id}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {user.id}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {isAdmin ? (
                          <select
                            value={user.role}
                            onChange={(e) =>
                              handleRoleChange(user.id, e.target.value as UserRole)
                            }
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider"
                            disabled={saving || user.id === profile?.id}
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {user.role}
                          </span>
                        )}
                        {isAdmin && user.id !== profile?.id && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                if (!activeCompanyId) return;
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
                                if (!activeCompanyId) return;
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
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3">
              Pending Invites
            </h3>
            {invites.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No pending invites.
              </p>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {invite.email}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Role: {invite.role} • Status: {invite.status}
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
                        disabled={!isAdmin || saving}
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
    </div>
  );
};

export default SettingsPage;
