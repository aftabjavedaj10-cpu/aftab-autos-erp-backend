import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SB_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
  let invitedUserId: string | null = null;

  const { data: inviteData, error: inviteError } = await supabase.auth.admin
    .inviteUserByEmail(email);

  if (inviteError) {
    const message = inviteError.message || "Invite failed";
    if (!message.includes("already been registered")) {
      return jsonResponse(400, { error: message });
    }

    // User already exists, lookup profile by email
    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();

    if (profileError || !existingProfile?.id) {
      return jsonResponse(400, { error: "User exists but profile not found" });
    }

    invitedUserId = existingProfile.id;
  } else if (inviteData?.user?.id) {
    invitedUserId = inviteData.user.id;
  }

  if (!invitedUserId) {
    return jsonResponse(400, { error: "Invite failed" });
  }

  // Add member role (if already exists, ignore)
  const { error: memberError } = await supabase
    .from("company_members")
    .insert({
      user_id: invitedUserId,
      company_id,
      role,
    })
    .select()
    .maybeSingle();

  if (memberError && !memberError.message.includes("duplicate")) {
    return jsonResponse(400, { error: memberError.message });
  }

  // Track invite
  const { error: inviteTrackError } = await supabase
    .from("company_invites")
    .upsert(
      {
        company_id,
        email,
        role,
        invited_by: userData.user.id,
        status: inviteError ? "accepted" : "sent",
        last_sent_at: new Date().toISOString(),
      },
      { onConflict: "company_id,email" }
    );

  if (inviteTrackError) {
    return jsonResponse(400, { error: inviteTrackError.message });
  }

  return jsonResponse(200, { ok: true, user_id: invitedUserId });
});
