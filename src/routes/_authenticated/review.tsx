import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { fetchProjects } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { SiteTag } from "@/components/site-tag";
import { UserAvatar } from "@/components/user-avatar";
import { STATUS_META } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({ meta: [{ title: "Review queue — Kilowatt" }] }),
  component: ReviewPage,
});

type ProjectRow = Awaited<ReturnType<typeof fetchProjects>>[number];

function ReviewPage() {
  const { user, hasRole, isAdmin } = useAuth();
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  if (!hasRole("manager") && !isAdmin) {
    return <div className="p-8 text-sm text-muted-foreground">Managers and admins only.</div>;
  }

  // Items awaiting the current user's desk.
  const items = projects.filter((p) => {
    const stage = p.review_stage;
    if (!stage) return false;
    if (stage === "admin_triage" || stage === "admin_final") return isAdmin;
    if (stage === "manager_review")
      return isAdmin || p.manager_id === user?.id;
    return false;
  });

  const reviews = items.filter((p) => p.status === "review");
  const pending = items.filter((p) => p.requested_status != null);

  return (
    <div className="p-8 max-w-5xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Review queue</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} item{items.length !== 1 && "s"} awaiting your desk.
        </p>
      </div>
      {items.length === 0 && (
        <div className="bg-card rounded-xl p-10 card-shadow text-center text-sm text-muted-foreground">
          Nothing to review right now.
        </div>
      )}
      {reviews.length > 0 && (
        <div className="pt-2">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Energy case reviews
          </h2>
        </div>
      )}
      {reviews.map((p) => (
        <QueueCard key={p.id} project={p} />
      ))}
      {pending.length > 0 && (
        <div className="pt-2">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Status change requests
          </h2>
        </div>
      )}
      {pending.map((p) => (
        <QueueCard key={`pending-${p.id}`} project={p} />
      ))}
    </div>
  );
}

function QueueCard({ project }: { project: ProjectRow }) {
  const stage = project.review_stage as
    | "admin_triage"
    | "manager_review"
    | "admin_final"
    | null;
  const stageLabel: Record<NonNullable<typeof stage>, string> = {
    admin_triage: "Admin triage — assign a manager",
    manager_review: "Manager verification",
    admin_final: "Admin final approval",
  };

  return (
    <div className="bg-card rounded-xl p-6 card-shadow space-y-3">
      <div>
        <div className="font-mono text-xs text-muted-foreground">{project.code}</div>
        <div className="font-display text-lg font-semibold">{project.title}</div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <StatusBadge status={project.status} />
          {project.requested_status && (
            <>
              <span className="text-xs text-muted-foreground">→ requesting</span>
              <StatusBadge status={project.requested_status} />
            </>
          )}
          {stage && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-900 px-2 py-0.5 text-xs font-medium">
              {stageLabel[stage]}
            </span>
          )}
          {project.site && <SiteTag name={project.site.name} color={project.site.color_hex} />}
          {project.submitter && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserAvatar name={project.submitter.full_name} color={project.submitter.avatar_color_hex} size={20} />
              {project.submitter.full_name}
            </span>
          )}
        </div>
      </div>
      {project.requested_note && (
        <div className="text-sm bg-muted/50 rounded p-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
            Note
          </span>
          {project.requested_note}
        </div>
      )}
      <div className="flex justify-end">
        <Button asChild size="sm">
          <Link to="/projects/$id" params={{ id: project.id }}>Open project</Link>
        </Button>
      </div>
    </div>
  );
}