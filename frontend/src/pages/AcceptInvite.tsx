import React, { useMemo, useState } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const parseHash = () => {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return {
    accessToken: params.get("access_token") || "",
    type: params.get("type") || "",
  };
};

const decodeEmailFromToken = (token: string) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized);
    const data = JSON.parse(json) as { email?: string };
    return data.email || "";
  } catch {
    return "";
  }
};

const AcceptInvite: React.FC = () => {
  const { accessToken, type } = useMemo(parseHash, []);
  const inviteEmail = useMemo(
    () => (accessToken ? decodeEmailFromToken(accessToken) : ""),
    [accessToken]
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSetPassword = async () => {
    setError(null);
    setSuccess(null);

    if (!SUPABASE_URL) {
      setError("Missing Supabase URL");
      return;
    }

    if (!accessToken) {
      setError("Missing invite token. Please use the invite email link.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error_description || data?.message || "Failed to set password.");
        return;
      }

      setSuccess("Password set. You can now log in with your email and new password.");
    } catch {
      setError("Failed to set password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcf8f2] dark:bg-[#020617] px-4">
      <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-slate-800/60 rounded-[2rem] p-8">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
          Accept Invite
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          {type === "invite"
            ? "Set your password to activate your account."
            : "This link is not a valid invite. Please use the invite email link."}
        </p>

        {error && (
          <div className="mt-4 text-xs font-bold text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {success}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <input
            type="email"
            value={inviteEmail}
            readOnly
            placeholder="Email (from invite)"
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-3 px-4 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none transition-all font-bold text-sm opacity-90"
          />
          <input
            type="password"
            placeholder="Set Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-3 px-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-sm"
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-3 px-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-sm"
          />
          <button
            onClick={handleSetPassword}
            disabled={saving || type !== "invite"}
            className="w-full bg-slate-900 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-500 text-white font-black py-3 rounded-2xl shadow-2xl shadow-orange-600/30 transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Set Password"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;
