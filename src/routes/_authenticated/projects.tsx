import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Search } from "lucide-react";

import { fetchProjects, fetchSites, fetchCategories } from "@/lib/queries";
import { STATUS_ORDER, STATUS_META, type ProjectStatus } from "@/lib/status";
import { StatusBadge } from "@/components/status-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtCurrency, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Kilowatt" },
      { name: "description", content: "All CAPEX energy and carbon impact projects, grouped by site or by workflow status." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: fetchSites });
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [q, setQ] = useState("");
  const [siteId, setSiteId] = useState<string>("all");
  const [catId, setCatId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (siteId !== "all" && p.site_id !== siteId) return false;
      if (catId !== "all" && p.category_id !== catId) return false;
      if (status !== "all" && p.status !== status) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!p.title.toLowerCase().includes(s) && !p.code.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [projects, siteId, catId, status, q]);

  const bySite = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const s of sites) map.set(s.id, []);
    for (const p of filtered) {
      const arr = map.get(p.site_id) ?? [];
      arr.push(p);
      map.set(p.site_id, arr);
    }
    return map;
  }, [filtered, sites]);

  return (
    <div className="p-8 space-y-4 max-w-[1600px]">
      <div className="bg-card rounded-xl p-4 card-shadow flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search title or ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={siteId} onValueChange={setSiteId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Site" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sites</SelectItem>
            {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={catId} onValueChange={setCatId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4 space-y-4">
          {sites.map((site) => {
            const rows = bySite.get(site.id) ?? [];
            const open = !collapsed[site.id];
            return (
              <div key={site.id} className="bg-card rounded-xl card-shadow overflow-hidden">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [site.id]: open }))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{ borderLeft: `4px solid ${site.color_hex}` }}
                >
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-semibold" style={{ color: site.color_hex }}>{site.name}</span>
                  <span className="text-xs text-muted-foreground">{rows.length} project{rows.length !== 1 && "s"}</span>
                </button>
                {open && (
                  <div className="border-t">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium px-4 py-2 w-[36%]">Project</th>
                          <th className="text-left font-medium px-3 py-2">Owner</th>
                          <th className="text-left font-medium px-3 py-2">Category</th>
                          <th className="text-left font-medium px-3 py-2">Status</th>
                          <th className="text-right font-medium px-3 py-2">CAPEX</th>
                          <th className="text-right font-medium px-4 py-2">CO₂e t/yr</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((p) => (
                          <tr
                            key={p.id}
                            onClick={() => navigate({ to: "/projects/$id", params: { id: p.id } })}
                            className="border-t hover:bg-muted/30 cursor-pointer"
                          >
                            <td className="px-4 py-2.5">
                              <div className="font-medium">{p.title}</div>
                              <div className="font-mono text-xs text-muted-foreground">{p.code}</div>
                            </td>
                            <td className="px-3 py-2.5">
                              {p.submitter && (
                                <div className="flex items-center gap-2">
                                  <UserAvatar name={p.submitter.full_name} color={p.submitter.avatar_color_hex} size={24} />
                                  <span className="text-xs">{p.submitter.full_name}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs">
                                {p.category?.name}
                              </span>
                            </td>
                            <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs">{fmtCurrency(Number(p.capex_estimate))}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs">{fmtNumber(Number(p.expected_co2e_t_yr))}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={6} className="px-4 py-2 border-t">
                            <Link
                              to="/projects/new"
                              search={{ site: site.id } as never}
                              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add item
                            </Link>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {STATUS_ORDER.map((s) => {
              const rows = filtered.filter((p) => p.status === s);
              const meta = STATUS_META[s];
              return (
                <div key={s} className="bg-card rounded-xl card-shadow flex flex-col min-h-40">
                  <div
                    className="px-3 py-2 rounded-t-xl text-white text-xs font-semibold flex items-center justify-between"
                    style={{ backgroundColor: meta.color }}
                  >
                    <span>{meta.label}</span>
                    <span>{rows.length}</span>
                  </div>
                  <div className="p-2 space-y-2 flex-1">
                    {rows.map((p) => (
                      <Link
                        key={p.id}
                        to="/projects/$id"
                        params={{ id: p.id }}
                        className="block bg-background border rounded-md p-2.5 hover:card-shadow transition-all"
                      >
                        <div className="text-sm font-medium leading-snug">{p.title}</div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground truncate">
                            {p.site?.name}
                          </span>
                          {p.submitter && (
                            <UserAvatar name={p.submitter.full_name} color={p.submitter.avatar_color_hex} size={20} />
                          )}
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {fmtNumber(Number(p.expected_co2e_t_yr))} tCO₂e/yr
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}