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

const normalizeCompanyName = (email: string) => {
  if (!email) return "My Company";
  const [local] = email.split("@");
  if (!local) return "My Company";
  return `${local.replace(/\./g, " ").toUpperCase()} COMPANY`;
};

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

  const userId = userData.user.id;
  const email = userData.user.email ?? "";

  // Ensure profile exists
  await supabase.from("profiles").upsert({ id: userId, email });

  // Check existing memberships
  const { data: memberships, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId);

  if (membershipError) {
    return jsonResponse(400, { error: membershipError.message });
  }

  if (memberships && memberships.length > 0) {
    return jsonResponse(200, { ok: true, company_id: memberships[0].company_id });
  }

  const { company_name, full_name, username, phone } = await req.json().catch(() => ({}));
  const name = (company_name as string) || normalizeCompanyName(email);

  await supabase.from("profiles").upsert({
    id: userId,
    email,
    full_name: full_name ?? null,
    username: username ?? null,
    phone: phone ?? null,
  });

  // Create company and add admin membership
  const { data: companyRow, error: companyError } = await supabase
    .from("companies")
    .insert({ name })
    .select()
    .maybeSingle();

  if (companyError || !companyRow?.id) {
    return jsonResponse(400, { error: companyError?.message || "Create company failed" });
  }

  const { error: memberError } = await supabase.from("company_members").insert({
    company_id: companyRow.id,
    user_id: userId,
    role: "admin",
  });

  if (memberError) {
    return jsonResponse(400, { error: memberError.message });
  }

  return jsonResponse(200, { ok: true, company_id: companyRow.id });
});
