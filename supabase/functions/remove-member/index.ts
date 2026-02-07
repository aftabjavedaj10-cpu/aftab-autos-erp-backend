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

  const { company_id, user_id, delete_user } = await req.json().catch(() => ({}));
  if (!company_id || !user_id) {
    return jsonResponse(400, { error: "company_id and user_id required" });
  }

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

  const { error: deleteMemberError } = await supabase
    .from("company_members")
    .delete()
    .eq("company_id", company_id)
    .eq("user_id", user_id);

  if (deleteMemberError) {
    return jsonResponse(400, { error: deleteMemberError.message });
  }

  if (delete_user) {
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user_id);
    if (deleteUserError) {
      return jsonResponse(400, { error: deleteUserError.message });
    }
  }

  return jsonResponse(200, { ok: true });
});
