import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { fetchSites, fetchCategories } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const searchSchema = z.object({ site: z.string().optional() });

export const Route = createFileRoute("/_authenticated/projects_/new")({
  head: () => ({
    meta: [{ title: "New project — Kilowatt" }],
  }),
  validateSearch: searchSchema,
  component: NewProjectPage,
});

function NewProjectPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { site: presetSite } = Route.useSearch();
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: fetchSites });
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [f, setF] = useState({
    title: "",
    description: "",
    site_id: presetSite ?? "",
    category_id: "",
    baseline_energy_mwh_yr: "",
    expected_savings_mwh_yr: "",
    expected_co2e_t_yr: "",
    simple_payback_years: "",
    capex_estimate: "",
    planned_start_date: "",
    planned_end_date: "",
  });
  const [saving, setSaving] = useState(false);

  const upd = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title || !f.site_id || !f.category_id) {
      toast.error("Title, site, and category are required.");
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      title: f.title,
      site_id: f.site_id,
      category_id: f.category_id,
      submitter_id: user!.id,
      status: "proposed",
      capex_estimate: f.capex_estimate ? Number(f.capex_estimate) : 0,
      baseline_energy_mwh_yr: f.baseline_energy_mwh_yr ? Number(f.baseline_energy_mwh_yr) : 0,
      expected_savings_mwh_yr: f.expected_savings_mwh_yr ? Number(f.expected_savings_mwh_yr) : 0,
      expected_co2e_t_yr: f.expected_co2e_t_yr ? Number(f.expected_co2e_t_yr) : 0,
      proposed_date: new Date().toISOString().slice(0, 10),
    };
    if (f.description) payload.description = f.description;
    if (f.simple_payback_years) payload.simple_payback_years = Number(f.simple_payback_years);
    if (f.planned_start_date) payload.planned_start_date = f.planned_start_date;
    if (f.planned_end_date) payload.planned_end_date = f.planned_end_date;
    const { data, error } = await supabase
      .from("projects")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(payload as any)
      .select()
      .single();
    if (error || !data) {
      setSaving(false);
      toast.error(error?.message ?? "Failed to create project.");
      return;
    }
    await supabase.from("project_history").insert({
      project_id: data.id,
      actor_id: user!.id,
      event_text: `Project proposed by submitter`,
    });
    toast.success(`Project ${data.code} created.`);
    navigate({ to: "/projects/$id", params: { id: data.id } });
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">New project</h1>
        <p className="text-sm text-muted-foreground">Capture the energy and carbon impact case.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-6">
        <Section title="Project identity">
          <Field label="Title *">
            <Input value={f.title} onChange={(e) => upd("title", e.target.value)} placeholder="e.g. VFDs on cooling tower fans" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Site *">
              <Select value={f.site_id} onValueChange={(v) => upd("site_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category *">
              <Select value={f.category_id} onValueChange={(v) => upd("category_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={4} value={f.description} onChange={(e) => upd("description", e.target.value)} />
          </Field>
        </Section>

        <Section title="Energy & carbon impact case">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Baseline energy (MWh/yr)"><Input type="number" step="0.1" value={f.baseline_energy_mwh_yr} onChange={(e) => upd("baseline_energy_mwh_yr", e.target.value)} /></Field>
            <Field label="Expected savings (MWh/yr)"><Input type="number" step="0.1" value={f.expected_savings_mwh_yr} onChange={(e) => upd("expected_savings_mwh_yr", e.target.value)} /></Field>
            <Field label="Expected CO₂e reduction (t/yr)"><Input type="number" step="0.1" value={f.expected_co2e_t_yr} onChange={(e) => upd("expected_co2e_t_yr", e.target.value)} /></Field>
            <Field label="Simple payback (yrs)"><Input type="number" step="0.1" value={f.simple_payback_years} onChange={(e) => upd("simple_payback_years", e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="Financials & timeline">
          <div className="grid grid-cols-2 gap-4">
            <Field label="CAPEX estimate (USD)"><Input type="number" step="1" value={f.capex_estimate} onChange={(e) => upd("capex_estimate", e.target.value)} /></Field>
            <div />
            <Field label="Planned start"><Input type="date" value={f.planned_start_date} onChange={(e) => upd("planned_start_date", e.target.value)} /></Field>
            <Field label="Planned end"><Input type="date" value={f.planned_end_date} onChange={(e) => upd("planned_end_date", e.target.value)} /></Field>
          </div>
        </Section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/projects" })}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create project"}</Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl p-6 card-shadow space-y-4">
      <div className="font-display font-semibold">{title}</div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}