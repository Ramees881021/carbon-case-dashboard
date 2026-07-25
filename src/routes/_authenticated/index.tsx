import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Leaf,
  Target,
} from "lucide-react";

import { fetchProjects, fetchYearTargets } from "@/lib/queries";
import { STATUS_META, FUNNEL_STATUSES, type ProjectStatus } from "@/lib/status";
import { fmtCurrency, fmtNumber } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { SiteTag } from "@/components/site-tag";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Kilowatt" },
      { name: "description", content: "Live view of CAPEX energy and carbon impact across your portfolio." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, isManager, isLeadership } = useAuth();
  const { data: allProjects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: years = [] } = useQuery({ queryKey: ["year_targets"], queryFn: fetchYearTargets });
  const canSeeAll = isManager || isLeadership;
  const projects = canSeeAll
    ? allProjects
    : allProjects.filter((p) => p.submitter_id === user?.id);

  const pipelineCo2 = projects
    .filter((p) => p.status !== "hold")
    .reduce((s, p) => s + Number(p.expected_co2e_t_yr || 0), 0);
  const totalCapex = projects.reduce((s, p) => s + Number(p.capex_estimate || 0), 0);
  const realisedCo2 = projects
    .filter((p) => p.status === "completed")
    .reduce((s, p) => s + Number(p.actual_co2e_t_yr || 0), 0);
  const awaitingReview = projects.filter((p) => p.status === "review").length;

  const currentYear = years.find((y) => y.is_current);
  const yearTarget = Number(currentYear?.target_co2e_t_yr ?? 0);
  const yearActual = realisedCo2;
  const pct = yearTarget > 0 ? Math.min(100, (yearActual / yearTarget) * 100) : 0;

  const funnel = FUNNEL_STATUSES.map((s) => ({
    status: s,
    count: projects.filter((p) => p.status === s).length,
  }));
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

  const byCategory = new Map<string, number>();
  for (const p of projects) {
    const key = p.category?.name ?? "Uncategorised";
    byCategory.set(key, (byCategory.get(key) ?? 0) + Number(p.expected_co2e_t_yr || 0));
  }
  const catRows = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxCat = Math.max(1, ...catRows.map(([, v]) => v));

  const recent = [...projects].slice(0, 6);

  const kpis: {
    label: string;
    value: string;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
  }[] = [
    {
      label: "Pipeline CO₂e reduction",
      value: `${fmtNumber(pipelineCo2)} t/yr`,
      sub: "Across all active proposals",
      icon: Leaf,
      tone: "#00C875",
    },
    {
      label: "Total CAPEX in portfolio",
      value: fmtCurrency(totalCapex),
      sub: `${projects.length} projects tracked`,
      icon: DollarSign,
      tone: "#0073EA",
    },
    {
      label: "Realised CO₂e (M&V)",
      value: `${fmtNumber(realisedCo2)} t/yr`,
      sub: "Measured on completed projects",
      icon: CheckCircle2,
      tone: "#A25DDC",
    },
    {
      label: "Awaiting review",
      value: String(awaitingReview),
      sub: awaitingReview ? "Manager action needed" : "All clear",
      icon: Activity,
      tone: "#FDAB3D",
    },
  ];

  const circ = 2 * Math.PI * 54;
  const dash = (pct / 100) * circ;

  return (
    <div className="p-8 space-y-6 max-w-[1400px]">
      {!canSeeAll && (
        <div className="text-xs text-muted-foreground">
          Showing your submitted projects only. Managers and leadership see the full portfolio.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card rounded-xl p-5 card-shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {k.label}
                </div>
                <div className="mt-2 font-display text-2xl font-semibold">{k.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{k.sub}</div>
              </div>
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${k.tone}1F`, color: k.tone }}
              >
                <k.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-6 card-shadow flex items-center gap-6">
          <div className="relative">
            <svg width={140} height={140} viewBox="0 0 120 120">
              <circle cx={60} cy={60} r={54} stroke="var(--muted)" strokeWidth={12} fill="none" />
              <circle
                cx={60}
                cy={60}
                r={54}
                stroke="var(--status-completed)"
                strokeWidth={12}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-2xl font-semibold">{Math.round(pct)}%</div>
              <div className="text-xs text-muted-foreground">of target</div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" /> {currentYear?.year_label ?? "Current year"} target
            </div>
            <div className="font-display text-xl font-semibold mt-1">
              {fmtNumber(yearActual)} <span className="text-muted-foreground text-base font-normal">/ {fmtNumber(yearTarget)} tCO₂e</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Realised from completed projects (M&V)
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-6 card-shadow lg:col-span-2">
          <div className="font-display font-semibold mb-4">Project pipeline</div>
          <div className="space-y-3">
            {funnel.map((f) => (
              <div key={f.status} className="flex items-center gap-3">
                <div className="w-32 shrink-0">
                  <StatusBadge status={f.status as ProjectStatus} />
                </div>
                <div className="flex-1 h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className="h-full flex items-center justify-end pr-2 text-xs font-semibold text-white rounded-md"
                    style={{
                      width: `${(f.count / maxFunnel) * 100}%`,
                      backgroundColor: STATUS_META[f.status as ProjectStatus].color,
                      minWidth: f.count > 0 ? 30 : 0,
                    }}
                  >
                    {f.count > 0 ? f.count : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-6 card-shadow lg:col-span-2">
          <div className="font-display font-semibold mb-4">CO₂e reduction potential by category</div>
          <div className="space-y-3">
            {catRows.map(([name, v]) => (
              <div key={name} className="flex items-center gap-3 text-sm">
                <div className="w-56 shrink-0 truncate">{name}</div>
                <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md bg-primary"
                    style={{ width: `${(v / maxCat) * 100}%` }}
                  />
                </div>
                <div className="w-24 text-right font-mono text-xs text-muted-foreground">
                  {fmtNumber(v)} t/yr
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl p-6 card-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="font-display font-semibold">Recently updated</div>
            <Link to="/projects" className="text-xs text-primary flex items-center gap-1 hover:underline">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recent.map((p) => (
              <Link
                key={p.id}
                to="/projects/$id"
                params={{ id: p.id }}
                className="block p-3 rounded-md hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm truncate">{p.title}</div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{p.code}</span>
                  {p.site && <SiteTag name={p.site.name} color={p.site.color_hex} />}
                </div>
              </Link>
            ))}
            {recent.length === 0 && (
              <div className="text-sm text-muted-foreground">No projects yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}