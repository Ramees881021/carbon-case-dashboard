import { supabase } from "@/integrations/supabase/client";

export type ProfileLite = {
  id: string;
  full_name: string;
  avatar_color_hex: string;
};

async function fetchProfileMap(): Promise<Map<string, ProfileLite>> {
  const { data } = await supabase.from("profiles").select("id,full_name,avatar_color_hex");
  const m = new Map<string, ProfileLite>();
  for (const p of data ?? []) m.set(p.id, p as ProfileLite);
  return m;
}

export async function fetchProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select(`*, site:sites(id,name,color_hex), category:categories(id,name)`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const profiles = await fetchProfileMap();
  return (data ?? []).map((p) => ({
    ...p,
    submitter: p.submitter_id ? profiles.get(p.submitter_id) ?? null : null,
  }));
}

export async function fetchSites() {
  const { data, error } = await supabase.from("sites").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function fetchCategories() {
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function fetchYearTargets() {
  const { data, error } = await supabase
    .from("year_targets")
    .select("*")
    .order("year_label", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchTeam() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");
  if (error) throw error;
  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("user_id, role");
  if (rErr) throw rErr;
  const byUser = new Map<string, { role: string }[]>();
  for (const r of roles ?? []) {
    const list = byUser.get(r.user_id) ?? [];
    list.push({ role: r.role as string });
    byUser.set(r.user_id, list);
  }
  return (data ?? []).map((p) => ({ ...p, user_roles: byUser.get(p.id) ?? [] }));
}

export async function fetchProjectDetail(id: string) {
  const { data: project, error } = await supabase
    .from("projects")
    .select(`*, site:sites(id,name,color_hex), category:categories(id,name)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!project) return null;
  const { data: history } = await supabase
    .from("project_history")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });
  const profiles = await fetchProfileMap();
  return {
    ...project,
    submitter: project.submitter_id ? profiles.get(project.submitter_id) ?? null : null,
    manager: project.manager_id ? profiles.get(project.manager_id) ?? null : null,
    history: (history ?? []).map((h) => ({
      ...h,
      actor: h.actor_id ? profiles.get(h.actor_id) ?? null : null,
    })),
  };
}