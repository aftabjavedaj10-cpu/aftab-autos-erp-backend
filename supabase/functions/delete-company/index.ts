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

  const { company_id } = await req.json().catch(() => ({}));
  if (!company_id) {
    return jsonResponse(400, { error: "company_id required" });
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

  // Delete storage objects (logo bucket)
  const { data: listData, error: listError } = await supabase.storage
    .from("company-logos")
    .list(`${company_id}`, { limit: 1000 });

  if (!listError && listData?.length) {
    const paths = listData.map((file) => `${company_id}/${file.name}`);
    await supabase.storage.from("company-logos").remove(paths);
  }

  // Load company owner
  const { data: companyRow, error: companyError } = await supabase
    .from("companies")
    .select("id, owner_id")
    .eq("id", company_id)
    .maybeSingle();

  if (companyError || !companyRow) {
    return jsonResponse(400, { error: companyError?.message || "Company not found" });
  }

  const ownerId = companyRow.owner_id;

  // Collect members to delete profiles (exclude owner)
  const { data: members, error: membersError } = await supabase
    .from("company_members")
    .select("user_id")
    .eq("company_id", company_id);

  if (membersError) {
    return jsonResponse(400, { error: membersError.message });
  }

  const memberIds = (members || [])
    .map((m) => m.user_id)
    .filter((id) => typeof id === "string" && id !== ownerId);

  if (memberIds.length > 0) {
    await supabase.from("profiles").delete().in("id", memberIds);
  }

  // Delete company (cascade handles related rows)
  const { error: deleteCompanyError } = await supabase
    .from("companies")
    .delete()
    .eq("id", company_id);

  if (deleteCompanyError) {
    return jsonResponse(400, { error: deleteCompanyError.message });
  }

  return jsonResponse(200, { ok: true });
});
