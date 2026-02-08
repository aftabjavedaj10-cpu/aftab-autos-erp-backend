type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
  expires_at?: number;
  user?: {
    id: string;
    email?: string;
  };
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const STORAGE_KEY = "supabase.auth.session";
const PROFILE_KEY = "supabase.auth.profile";
const ACTIVE_COMPANY_KEY = "supabase.active_company_id";

const nowInSeconds = () => Math.floor(Date.now() / 1000);

const saveSession = (session: SupabaseSession) => {
  const expiresAt =
    session.expires_at ?? (session.expires_in ? nowInSeconds() + session.expires_in : undefined);
  const payload = { ...session, expires_at: expiresAt };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
};

const loadSession = (): SupabaseSession | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SupabaseSession;
  } catch {
    return null;
  }
};

const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(ACTIVE_COMPANY_KEY);
};

const authRequest = async (path: string, body: any) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase env vars");
  }

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      data?.msg ||
      data?.error_description ||
      data?.message ||
      data?.error ||
      "Auth failed";
    const code = data?.error_code || data?.code || "";
    throw new Error(code ? `${msg} (${code})` : msg);
  }

  return data as SupabaseSession;
};

export const signUpWithPassword = async (email: string, password: string) => {
  const session = await authRequest("/auth/v1/signup", { email, password });
  return saveSession(session);
};

const refreshSession = async (refreshToken: string) => {
  const session = await authRequest("/auth/v1/token?grant_type=refresh_token", {
    refresh_token: refreshToken,
  });
  return saveSession(session);
};

export const signInWithPassword = async (email: string, password: string) => {
  const session = await authRequest("/auth/v1/token?grant_type=password", { email, password });
  return saveSession(session);
};

export const signOut = async () => {
  const session = loadSession();
  if (!session || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    clearSession();
    return;
  }

  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
  } finally {
    clearSession();
  }
};

export const getSession = () => loadSession();

export const setProfile = (profile: any) => {
  if (!profile) return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

export const getProfile = () => {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getCompanyId = () => {
  const profile = getProfile();
  return profile?.companyId ?? profile?.company_id ?? null;
};

export const setActiveCompanyId = (companyId: string) => {
  localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
};

export const getActiveCompanyId = () => {
  return localStorage.getItem(ACTIVE_COMPANY_KEY);
};

export const getUserRole = () => {
  const profile = getProfile();
  return profile?.role ?? null;
};

export const getUserId = () => {
  const session = loadSession();
  if (session?.user?.id) return session.user.id;
  if (!session?.access_token) return null;

  try {
    const payload = session.access_token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded?.sub || null;
  } catch {
    return null;
  }
};

export const getAccessToken = async () => {
  const session = loadSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  const expiresAt = session.expires_at || 0;
  const isExpired = nowInSeconds() >= expiresAt - 60;

  if (isExpired && session.refresh_token) {
    const refreshed = await refreshSession(session.refresh_token);
    return refreshed.access_token;
  }

  return session.access_token;
};
