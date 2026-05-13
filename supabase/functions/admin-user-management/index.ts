// Admin-only user CRUD via Supabase Auth Admin API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "Admin",
    });
    if (!isAdmin) return json({ error: "Forbidden: admin only" }, 403);

    const { action, payload } = await req.json();

    if (action === "create") {
      const { email, password, full_name, role } = payload;
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (error) throw error;
      // profile is created via handle_new_user trigger; assign role if provided
      if (role && created.user) {
        await admin.from("user_roles").insert({
          user_id: created.user.id,
          role,
          created_by: userData.user.id,
        });
      }
      return json({ user: created.user });
    }

    if (action === "update") {
      const { user_id, email, full_name, password } = payload;
      const updates: Record<string, unknown> = {};
      if (email) updates.email = email;
      if (password) updates.password = password;
      if (full_name !== undefined) updates.user_metadata = { full_name };
      if (Object.keys(updates).length) {
        const { error } = await admin.auth.admin.updateUserById(user_id, updates);
        if (error) throw error;
      }
      const profileUpdate: Record<string, unknown> = {};
      if (email) profileUpdate.email = email;
      if (full_name !== undefined) profileUpdate.full_name = full_name;
      if (Object.keys(profileUpdate).length) {
        await admin.from("profiles").update(profileUpdate).eq("user_id", user_id);
      }
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const { email, redirect_to } = payload;
      if (!email) return json({ error: "Email is required" }, 400);
      const { error } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo: redirect_to,
      });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      const { user_id } = payload;
      if (user_id === userData.user.id) {
        return json({ error: "You cannot delete your own account" }, 400);
      }
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-user-management error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
