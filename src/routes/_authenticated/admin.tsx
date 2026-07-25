import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Plus, Star, X } from "lucide-react";

import {
  fetchCategories,
  fetchProjects,
  fetchSites,
  fetchTeam,
  fetchYearTargets,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { STATUS_ORDER, STATUS_META, type ProjectStatus } from "@/lib/status";
import { fmtNumber } from "@/lib/format";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const AVATAR_PALETTE = [
  "#0073EA", "#00C875", "#FDAB3D", "#E2445C", "#A25DDC",
  "#4EBBF0", "#FF7B7B", "#037F4C", "#9AADBD", "#DF2F4A",
];

const TABS = [
  { key: "fy", label: "FY Target" },
  { key: "sites", label: "Sites" },
  { key: "categories", label: "Project Categories" },
  { key: "team", label: "Team Members" },
  { key: "statuses", label: "Workflow Statuses" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Kilowatt" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<TabKey>("fy");

  if (!isAdmin) {
    return <div className="p-8 text-sm text-muted-foreground">Admins only.</div>;
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">Manage reference data and multi-year targets.</p>
      </div>
      <div className="flex gap-6">
        <nav className="w-52 shrink-0 space-y-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm font-medium",
                tab === t.key ? "bg-accent text-accent-foreground" : "text-foreground/70 hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 min-w-0">
          {tab === "fy" && <FYSection />}
          {tab === "sites" && <SitesSection />}
          {tab === "categories" && <CategoriesSection />}
          {tab === "team" && <TeamSection />}
          {tab === "statuses" && <StatusesSection />}
        </div>
      </div>
    </div>
  );
}

/* ---------- FY Targets ---------- */
function FYSection() {
  const qc = useQueryClient();
  const { data: years = [] } = useQuery({ queryKey: ["year_targets"], queryFn: fetchYearTargets });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const realised = projects
    .filter((p) => p.status === "completed")
    .reduce((s, p) => s + Number(p.actual_co2e_t_yr || 0), 0);

  const current = years.find((y) => y.is_current);
  const pct = current && Number(current.target_co2e_t_yr) > 0
    ? Math.min(100, (realised / Number(current.target_co2e_t_yr)) * 100)
    : 0;
  const circ = 2 * Math.PI * 54;
  const dash = (pct / 100) * circ;

  async function promote(id: string) {
    await supabase.from("year_targets").update({ is_current: false }).neq("id", id);
    await supabase.from("year_targets").update({ is_current: true }).eq("id", id);
    toast.success("Current year updated.");
    qc.invalidateQueries({ queryKey: ["year_targets"] });
  }
  async function remove(id: string) {
    const y = years.find((r) => r.id === id);
    if (y?.is_current) { toast.error("Can't delete the current year."); return; }
    const { error } = await supabase.from("year_targets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Year removed.");
    setConfirmDelete(null);
    qc.invalidateQueries({ queryKey: ["year_targets"] });
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl p-6 card-shadow flex items-center gap-6">
        <div className="relative">
          <svg width={140} height={140} viewBox="0 0 120 120">
            <circle cx={60} cy={60} r={54} stroke="var(--muted)" strokeWidth={12} fill="none" />
            <circle cx={60} cy={60} r={54} stroke="var(--status-completed)" strokeWidth={12} fill="none"
              strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 60 60)" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-display text-2xl font-semibold">{Math.round(pct)}%</div>
            <div className="text-xs text-muted-foreground">of target</div>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Live progress</div>
          <div className="font-display text-xl font-semibold mt-1">
            {fmtNumber(realised)} <span className="text-muted-foreground text-base font-normal">/ {fmtNumber(Number(current?.target_co2e_t_yr ?? 0))} tCO₂e</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {current?.year_label ?? "No current year set"} · realised from completed projects
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl card-shadow overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b">
          <div className="font-display font-semibold">Multi-year targets</div>
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" /> Add year</Button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Year</th>
              <th className="text-right px-4 py-2 font-medium">Target (tCO₂e)</th>
              <th className="text-right px-4 py-2 font-medium">Actual (tCO₂e)</th>
              <th className="text-center px-4 py-2 font-medium">Current</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {adding && <NewYearRow onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); qc.invalidateQueries({ queryKey: ["year_targets"] }); }} />}
            {years.map((y) => (
              editing === y.id ? (
                <EditYearRow key={y.id} year={y} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["year_targets"] }); }} />
              ) : (
                <tr key={y.id} className="border-t">
                  <td className="px-4 py-2.5 font-mono">{y.year_label}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmtNumber(Number(y.target_co2e_t_yr))}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                    {y.is_current ? <span className="italic">live · {fmtNumber(realised)}</span> : (y.actual_co2e_t_yr != null ? fmtNumber(Number(y.actual_co2e_t_yr)) : "—")}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {y.is_current ? (
                      <span className="inline-flex items-center gap-1 text-primary text-xs font-medium"><Star className="h-3 w-3" /> Current</span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => promote(y.id)}>Make current</Button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(y.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {confirmDelete === y.id ? (
                        <>
                          <Button size="sm" variant="destructive" onClick={() => remove(y.id)}>Confirm</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" disabled={y.is_current} onClick={() => setConfirmDelete(y.id)}>Delete</Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewYearRow({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [actual, setActual] = useState("");
  const [makeCurrent, setMakeCurrent] = useState(false);
  async function save() {
    if (!label || !target) { toast.error("Year and target required."); return; }
    if (makeCurrent) {
      await supabase.from("year_targets").update({ is_current: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    }
    const { error } = await supabase.from("year_targets").insert({
      year_label: label,
      target_co2e_t_yr: Number(target),
      actual_co2e_t_yr: actual ? Number(actual) : null,
      is_current: makeCurrent,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Year added.");
    onSaved();
  }
  return (
    <tr className="border-t bg-muted/20">
      <td className="px-4 py-2"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="FY27" className="h-8" /></td>
      <td className="px-4 py-2"><Input type="number" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} className="h-8 text-right font-mono" /></td>
      <td className="px-4 py-2"><Input type="number" step="0.1" value={actual} onChange={(e) => setActual(e.target.value)} className="h-8 text-right font-mono" placeholder="Optional" /></td>
      <td className="px-4 py-2 text-center">
        <label className="inline-flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} /> Set current
        </label>
      </td>
      <td className="px-4 py-2 text-right">
        <div className="inline-flex gap-1">
          <Button size="sm" onClick={save}><Check className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-3.5 w-3.5" /></Button>
        </div>
      </td>
    </tr>
  );
}

function EditYearRow({
  year, onCancel, onSaved,
}: {
  year: Awaited<ReturnType<typeof fetchYearTargets>>[number];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [target, setTarget] = useState(String(year.target_co2e_t_yr));
  const [actual, setActual] = useState(year.actual_co2e_t_yr != null ? String(year.actual_co2e_t_yr) : "");
  async function save() {
    const { error } = await supabase
      .from("year_targets")
      .update({
        target_co2e_t_yr: Number(target),
        actual_co2e_t_yr: actual === "" ? null : Number(actual),
      })
      .eq("id", year.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved.");
    onSaved();
  }
  return (
    <tr className="border-t bg-muted/20">
      <td className="px-4 py-2 font-mono">{year.year_label}</td>
      <td className="px-4 py-2"><Input type="number" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} className="h-8 text-right font-mono" /></td>
      <td className="px-4 py-2"><Input type="number" step="0.1" value={actual} onChange={(e) => setActual(e.target.value)} className="h-8 text-right font-mono" disabled={year.is_current} placeholder={year.is_current ? "live" : ""} /></td>
      <td className="px-4 py-2 text-center text-xs text-muted-foreground">{year.is_current ? "current" : ""}</td>
      <td className="px-4 py-2 text-right">
        <div className="inline-flex gap-1">
          <Button size="sm" onClick={save}><Check className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-3.5 w-3.5" /></Button>
        </div>
      </td>
    </tr>
  );
}

/* ---------- Sites ---------- */
function SitesSection() {
  const qc = useQueryClient();
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: fetchSites });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) m.set(p.site_id, (m.get(p.site_id) ?? 0) + 1);
    return m;
  }, [projects]);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0073EA");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function add() {
    if (!name) return;
    const { error } = await supabase.from("sites").insert({ name, color_hex: color });
    if (error) { toast.error(error.message); return; }
    setName(""); setAdding(false); toast.success("Site added.");
    qc.invalidateQueries({ queryKey: ["sites"] });
  }
  async function saveEdit(id: string) {
    const { error } = await supabase.from("sites").update({ name: editName, color_hex: editColor }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditing(null); toast.success("Renamed — applied to all projects using this site.");
    qc.invalidateQueries({ queryKey: ["sites"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  }
  async function remove(id: string) {
    const count = usage.get(id) ?? 0;
    if (count > 0) { toast.error(`Can't delete — ${count} project${count > 1 ? "s" : ""} still use this site.`); setConfirmDelete(null); return; }
    const { error } = await supabase.from("sites").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Site removed."); setConfirmDelete(null);
    qc.invalidateQueries({ queryKey: ["sites"] });
  }

  return (
    <div className="bg-card rounded-xl card-shadow overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b">
        <div className="font-display font-semibold">Sites</div>
        {!adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" /> Add site</Button>}
      </div>
      <div className="divide-y">
        {adding && (
          <div className="px-6 py-3 flex items-center gap-3">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 rounded border" />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Site name" className="max-w-xs" />
            <div className="ml-auto flex gap-1">
              <Button size="sm" onClick={add}><Check className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}
        {sites.map((s) => (
          <div key={s.id} className="px-6 py-3 flex items-center gap-3">
            {editing === s.id ? (
              <>
                <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-8 w-10 rounded border" />
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-xs" />
                <div className="ml-auto flex gap-1">
                  <Button size="sm" onClick={() => saveEdit(s.id)}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              </>
            ) : (
              <>
                <span className="h-4 w-4 rounded" style={{ backgroundColor: s.color_hex }} />
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">{usage.get(s.id) ?? 0} project{(usage.get(s.id) ?? 0) !== 1 && "s"}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(s.id); setEditName(s.name); setEditColor(s.color_hex); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  {confirmDelete === s.id ? (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => remove(s.id)}>Confirm</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(s.id)}>Delete</Button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Categories ---------- */
function CategoriesSection() {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1);
    return m;
  }, [projects]);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function add() {
    if (!name) return;
    const { error } = await supabase.from("categories").insert({ name });
    if (error) { toast.error(error.message); return; }
    setName(""); setAdding(false); toast.success("Category added.");
    qc.invalidateQueries({ queryKey: ["categories"] });
  }
  async function saveEdit(id: string) {
    const { error } = await supabase.from("categories").update({ name: editName }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditing(null); toast.success("Renamed — applied everywhere.");
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  }
  async function remove(id: string) {
    const count = usage.get(id) ?? 0;
    if (count > 0) { toast.error(`Can't delete — ${count} project${count > 1 ? "s" : ""} still use this category.`); setConfirmDelete(null); return; }
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Category removed."); setConfirmDelete(null);
    qc.invalidateQueries({ queryKey: ["categories"] });
  }

  return (
    <div className="bg-card rounded-xl card-shadow overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b">
        <div className="font-display font-semibold">Project categories</div>
        {!adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" /> Add category</Button>}
      </div>
      <div className="divide-y">
        {adding && (
          <div className="px-6 py-3 flex items-center gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" className="max-w-xs" />
            <div className="ml-auto flex gap-1">
              <Button size="sm" onClick={add}><Check className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}
        {cats.map((c) => (
          <div key={c.id} className="px-6 py-3 flex items-center gap-3">
            {editing === c.id ? (
              <>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-xs" />
                <div className="ml-auto flex gap-1">
                  <Button size="sm" onClick={() => saveEdit(c.id)}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              </>
            ) : (
              <>
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{usage.get(c.id) ?? 0} project{(usage.get(c.id) ?? 0) !== 1 && "s"}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(c.id); setEditName(c.name); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  {confirmDelete === c.id ? (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => remove(c.id)}>Confirm</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(c.id)}>Delete</Button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Team ---------- */
function TeamSection() {
  const qc = useQueryClient();
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: fetchTeam });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) if (p.submitter_id) m.set(p.submitter_id, (m.get(p.submitter_id) ?? 0) + 1);
    return m;
  }, [projects]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>("submitter");

  async function updateRole(userId: string) {
    const { error: e1 } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (e1) { toast.error(e1.message); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: editRole as any });
    if (error) { toast.error(error.message); return; }
    setEditing(null); toast.success("Role updated.");
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  async function remove(id: string) {
    if ((usage.get(id) ?? 0) > 0) {
      toast.error("Can't remove — this person has submitted projects.");
      setConfirmDelete(null); return;
    }
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Member removed."); setConfirmDelete(null);
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  return (
    <div className="bg-card rounded-xl card-shadow overflow-hidden">
      <div className="px-6 py-4 border-b">
        <div className="font-display font-semibold">Team members</div>
        <div className="text-xs text-muted-foreground mt-1">
          New members join by signing up. Assign them roles here.
        </div>
      </div>
      <div className="divide-y">
        {team.map((m) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const roleList = (m as any).user_roles as { role: string }[] | undefined;
          const primaryRole = roleList?.[0]?.role ?? "submitter";
          return (
            <div key={m.id} className="px-6 py-3 flex items-center gap-3">
              <UserAvatar name={m.full_name} color={m.avatar_color_hex} size={32} />
              <div className="flex-1">
                <div className="font-medium text-sm">{m.full_name}</div>
                <div className="text-xs text-muted-foreground">{usage.get(m.id) ?? 0} projects submitted</div>
              </div>
              {editing === m.id ? (
                <>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="submitter">Submitter</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="leadership">Leadership</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => updateRole(m.id)}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" /></Button>
                </>
              ) : (
                <>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize">{primaryRole}</span>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(m.id); setEditRole(primaryRole); }}>Change role</Button>
                  {confirmDelete === m.id ? (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => remove(m.id)}>Confirm</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(m.id)}>Remove</Button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Statuses (read-only) ---------- */
function StatusesSection() {
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  return (
    <div className="bg-card rounded-xl card-shadow overflow-hidden">
      <div className="px-6 py-4 border-b">
        <div className="font-display font-semibold">Workflow statuses</div>
        <div className="text-xs text-muted-foreground mt-1">
          Fixed values that drive workflow logic — not editable.
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Status</th>
            <th className="text-left px-4 py-2 font-medium">Key</th>
            <th className="text-left px-4 py-2 font-medium">Colour</th>
            <th className="text-right px-4 py-2 font-medium">Projects</th>
          </tr>
        </thead>
        <tbody>
          {STATUS_ORDER.map((s) => (
            <tr key={s} className="border-t">
              <td className="px-4 py-2.5"><StatusBadge status={s as ProjectStatus} /></td>
              <td className="px-4 py-2.5 font-mono text-xs">{s}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded" style={{ backgroundColor: STATUS_META[s as ProjectStatus].color }} />
                  <span className="font-mono text-xs">{STATUS_META[s as ProjectStatus].color}</span>
                </div>
              </td>
              <td className="px-4 py-2.5 text-right font-mono">{projects.filter((p) => p.status === s).length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Reference kept so palette isn't tree-shaken warning
void AVATAR_PALETTE;