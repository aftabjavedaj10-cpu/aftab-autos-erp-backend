import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SB_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? "";

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return jsonResponse(401, { error: "Missing Authorization token" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Invalid user token" });
  }

  const { email, role, company_id } = await req.json().catch(() => ({}));
  if (!email || !role || !company_id) {
    return jsonResponse(400, { error: "email, role, company_id required" });
  }

  // Verify caller is admin of the company
  const { data: adminRow, error: adminError } = await supabase
    .from("company_members")
    .select("id, role")
    .eq("user_id", userData.user.id)
    .eq("company_id", company_id)
    .eq("role", "admin")
    .maybeSingle();

  if (adminError || !adminRow) {
    return jsonResponse(403, { error: "Not authorized" });
  }

  // Invite user (email invite)
  const { data: inviteData, error: inviteError } = await supabase.auth.admin
    .inviteUserByEmail(email);

  if (inviteError || !inviteData?.user) {
    return jsonResponse(400, { error: inviteError?.message || "Invite failed" });
  }

  // Add member role
  const { error: memberError } = await supabase
    .from("company_members")
    .insert({
      user_id: inviteData.user.id,
      company_id,
      role,
    });

  if (memberError) {
    return jsonResponse(400, { error: memberError.message });
  }

  return jsonResponse(200, { ok: true, user_id: inviteData.user.id });
});
