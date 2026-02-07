import React, { useEffect, useMemo, useState } from "react";
import type { Company, CompanyMember, Profile, UserRole } from "../types";
import { companyAPI, companyMemberAPI, profileAPI } from "../services/apiService";
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
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<UserRole>("staff");
  const [companyUsers, setCompanyUsers] = useState<(Profile & { memberId?: string })[]>([]);
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
          const companyMembers = await companyMemberAPI.listMembers(defaultCompanyId);
          const mappedProfiles = companyMembers.map((m: any) => ({
            id: m.user_id ?? m.userId,
            email: m.profiles?.email,
            role: m.role,
            companyId: m.company_id ?? m.companyId,
            memberId: m.id,
          }));
          setCompanyUsers(mappedProfiles);
        } else {
          setCompanyUsers([]);
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
                    const companyMembers = await companyMemberAPI.listMembers(nextId);
                    const mappedProfiles = companyMembers.map((m: any) => ({
                      id: m.user_id ?? m.userId,
                      email: m.profiles?.email,
                      role: m.role,
                      companyId: m.company_id ?? m.companyId,
                      memberId: m.id,
                    }));
                    setCompanyUsers(mappedProfiles);
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
                    const user = await profileAPI.findUserByEmail(
                      newMemberEmail.trim()
                    );
                    await companyMemberAPI.addMember(
                      activeCompanyId,
                      user.id,
                      newMemberRole
                    );
                    const companyMembers = await companyMemberAPI.listMembers(
                      activeCompanyId
                    );
                    const mappedProfiles = companyMembers.map((m: any) => ({
                      id: m.user_id ?? m.userId,
                      email: m.profiles?.email,
                      role: m.role,
                      companyId: m.company_id ?? m.companyId,
                      memberId: m.id,
                    }));
                    setCompanyUsers(mappedProfiles);
                    setNewMemberEmail("");
                    setSuccess("Member added");
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
