import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { fetchProjectDetail, fetchTeam } from "@/lib/queries";
import { StatusBadge } from "@/components/status-badge";
import { SiteTag } from "@/components/site-tag";
import { UserAvatar } from "@/components/user-avatar";
import { ProjectGallery } from "@/components/project-gallery";
import { ProjectMembers } from "@/components/project-members";
import { ProjectChat } from "@/components/project-chat";
import { fmtCurrency, fmtDate, fmtNumber } from "@/lib/format";
import {
  requestTransition,
  approveRequest,
  rejectRequest,
  submitForReview,
  adminAssignManager,
  managerVerifyReview,
  adminFinalApproveReview,
  sendReviewBack,
  managerForwardRequest,
} from "@/lib/project-actions";
import { useAuth } from "@/hooks/use-auth";
import { STATUS_META } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/projects_/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Project ${params.id.slice(0, 8)} — Kilowatt` }],
  }),
  component: DetailPage,
});

function DetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, hasRole, isAdmin } = useAuth();

  const { data: p, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProjectDetail(id),
  });
  const { data: team = [] } = useQuery({
    queryKey: ["team"],
    queryFn: fetchTeam,
    enabled: isAdmin,
  });

  const [mvValue, setMvValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickedManager, setPickedManager] = useState("");

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!p) return <div className="p-8">Not found.</div>;

  const isOwner = !!user && p.submitter_id === user.id;
  const isAssignedManager = !!user && p.manager_id === user.id;
  const canDoManagerDesk = isAssignedManager || isAdmin;
  const stage = p.review_stage as
    | "admin_triage"
    | "manager_review"
    | "admin_final"
    | null;

  const canSubmitForReview =
    isOwner && (p.status === "proposed" || p.status === "hold") && !stage;
  const hasPending = p.requested_status != null;
  const canRequestExecution =
    isOwner && p.status === "validated" && !hasPending && !stage;
  const canRequestCompletion =
    isOwner && p.status === "execution" && !hasPending && !stage;

  const managers = team.filter((m) =>
    m.user_roles.some((r) => r.role === "manager" || r.role === "admin"),
  );

  const stageLabel: Record<NonNullable<typeof stage>, string> = {
    admin_triage: "Awaiting admin triage",
    manager_review: "Awaiting manager verification",
    admin_final: "Awaiting admin final approval",
  };

  const variance =
    p.actual_co2e_t_yr != null && Number(p.expected_co2e_t_yr) > 0
      ? ((Number(p.actual_co2e_t_yr) - Number(p.expected_co2e_t_yr)) / Number(p.expected_co2e_t_yr)) * 100
      : null;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["project", id] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  }

  async function run(fn: () => Promise<void>, successMsg: string) {
    if (!user) return;
    setBusy(true);
    try {
      await fn();
      setNote("");
      toast.success(successMsg);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl space-y-4">
      <button
        onClick={() => navigate({ to: "/projects" })}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> All projects
      </button>

      <div className="bg-card rounded-xl p-6 card-shadow">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-xs text-muted-foreground">{p.code}</div>
            <h1 className="font-display text-2xl font-semibold mt-1">{p.title}</h1>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <StatusBadge status={p.status} />
              {stage && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-900 px-2 py-0.5 text-xs font-medium">
                  {stageLabel[stage]}
                  {hasPending && <> · → {STATUS_META[p.requested_status!].label}</>}
                </span>
              )}
              {p.site && <SiteTag name={p.site.name} color={p.site.color_hex} />}
              <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs">{p.category?.name}</span>
            </div>
          </div>
        </div>
        {p.description && <p className="mt-4 text-sm text-foreground/80 whitespace-pre-line">{p.description}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-xl p-6 card-shadow">
            <div className="font-display font-semibold mb-4">Energy & carbon impact case</div>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Baseline energy" value={`${fmtNumber(Number(p.baseline_energy_mwh_yr))} MWh/yr`} />
              <Stat label="Expected savings" value={`${fmtNumber(Number(p.expected_savings_mwh_yr))} MWh/yr`} />
              <Stat label="Projected CO₂e reduction" value={`${fmtNumber(Number(p.expected_co2e_t_yr))} t/yr`} />
              <Stat label="Simple payback" value={p.simple_payback_years ? `${fmtNumber(Number(p.simple_payback_years))} yrs` : "—"} />
              {p.actual_co2e_t_yr != null && (
                <>
                  <Stat label="Actual CO₂e (M&V)" value={`${fmtNumber(Number(p.actual_co2e_t_yr))} t/yr`} tone="#00C875" />
                  <Stat
                    label="Variance vs projection"
                    value={variance != null ? `${variance > 0 ? "+" : ""}${variance.toFixed(1)}%` : "—"}
                    tone={variance != null && variance >= 0 ? "#00C875" : "#E2445C"}
                  />
                </>
              )}
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 card-shadow">
            <div className="font-display font-semibold mb-4">Activity</div>
            <ol className="space-y-3">
              {p.history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  {h.actor ? (
                    <UserAvatar name={h.actor.full_name} color={h.actor.avatar_color_hex} size={28} />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-muted" />
                  )}
                  <div className="text-sm flex-1">
                    <div>
                      <span className="font-medium">{h.actor?.full_name ?? "System"}</span>{" "}
                      <span className="text-muted-foreground">{h.event_text}</span>
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">{fmtDate(h.created_at)}</div>
                  </div>
                </li>
              ))}
              {p.history.length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
            </ol>
          </div>

          <ProjectGallery
            projectId={p.id}
            canUpload={hasRole("manager") || isOwner}
          />

          <ProjectChat
            projectId={p.id}
            currentUserId={user!.id}
            isAdmin={isAdmin}
          />
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-xl p-6 card-shadow space-y-3">
            <div className="font-display font-semibold">Key facts</div>
            <Stat label="Submitter" value={p.submitter?.full_name ?? "—"} />
            <Stat label="Assigned manager" value={p.manager?.full_name ?? "— not yet assigned"} />
            <Stat label="Proposed" value={fmtDate(p.proposed_date)} />
            <Stat label="Planned start" value={fmtDate(p.planned_start_date)} />
            <Stat label="Planned end" value={fmtDate(p.planned_end_date)} />
            <Stat label="CAPEX estimate" value={fmtCurrency(Number(p.capex_estimate))} />
          </div>

          <ProjectMembers
            projectId={p.id}
            submitterId={p.submitter_id}
            managerId={p.manager_id}
            isAdmin={isAdmin}
          />

          {/* Submitter: send for review */}
          {canSubmitForReview && (
            <div className="bg-card rounded-xl p-6 card-shadow space-y-3">
              <div className="font-display font-semibold">Submit for review</div>
              <p className="text-xs text-muted-foreground">
                Send this project to the admin. Admin will assign a manager to verify
                the energy &amp; carbon case before final approval.
              </p>
              <Textarea
                placeholder="Optional note for the reviewer…"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={busy}
                onClick={() =>
                  run(
                    () => submitForReview(p!.id, user!.id, note || undefined),
                    "Sent to admin for triage.",
                  )
                }
              >
                Send for review
              </Button>
            </div>
          )}

          {/* Admin desk — initial triage: assign manager */}
          {isAdmin && p.status === "review" && stage === "admin_triage" && (
            <div className="bg-card rounded-xl p-6 card-shadow space-y-3">
              <div className="font-display font-semibold">Admin triage</div>
              <p className="text-xs text-muted-foreground">
                Assign this project to a manager for verification.
              </p>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Manager
              </Label>
              <Select value={pickedManager} onValueChange={setPickedManager}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                  {managers.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No managers available — assign the manager role in Admin first.
                    </div>
                  )}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Note for the manager (optional)…"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => sendReviewBack(p!.id, user!.id, note || undefined),
                      "Sent back to submitter.",
                    )
                  }
                >
                  Send back
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy || !pickedManager}
                  onClick={() => {
                    const mgr = managers.find((m) => m.id === pickedManager);
                    if (!mgr) return;
                    run(
                      () =>
                        adminAssignManager(
                          p!.id,
                          user!.id,
                          mgr.id,
                          mgr.full_name,
                          note || undefined,
                        ),
                      `Assigned to ${mgr.full_name}.`,
                    );
                  }}
                >
                  Assign manager
                </Button>
              </div>
            </div>
          )}

          {/* Manager desk — verify review */}
          {canDoManagerDesk &&
            p.status === "review" &&
            stage === "manager_review" && (
              <div className="bg-card rounded-xl p-6 card-shadow space-y-3">
                <div className="font-display font-semibold">Manager verification</div>
                <p className="text-xs text-muted-foreground">
                  Verify the energy &amp; carbon case. On approval it is forwarded to
                  the admin for final approval.
                </p>
                <Textarea
                  placeholder="Verification note (optional)…"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => sendReviewBack(p!.id, user!.id, note || undefined),
                        "Sent back to submitter.",
                      )
                    }
                  >
                    Send back
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => managerVerifyReview(p!.id, user!.id, note || undefined),
                        "Forwarded to admin for final approval.",
                      )
                    }
                  >
                    Verify &amp; forward
                  </Button>
                </div>
              </div>
            )}

          {/* Admin desk — final approval of review */}
          {isAdmin && p.status === "review" && stage === "admin_final" && (
            <div className="bg-card rounded-xl p-6 card-shadow space-y-3">
              <div className="font-display font-semibold">Admin final approval</div>
              <p className="text-xs text-muted-foreground">
                Manager has verified the energy &amp; carbon case. Grant final approval
                to move the project to Validated.
              </p>
              <Textarea
                placeholder="Optional approval note…"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => sendReviewBack(p!.id, user!.id, note || undefined),
                      "Sent back to submitter.",
                    )
                  }
                >
                  Send back
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => adminFinalApproveReview(p!.id, user!.id, note || undefined),
                      "Project validated.",
                    )
                  }
                >
                  Final approve
                </Button>
              </div>
            </div>
          )}

          {/* Submitter: request execution / completion */}
          {(canRequestExecution || canRequestCompletion) && (
            <div className="bg-card rounded-xl p-6 card-shadow space-y-3">
              <div className="font-display font-semibold">
                {canRequestExecution ? "Start execution" : "Log completion"}
              </div>
              <p className="text-xs text-muted-foreground">
                {canRequestExecution
                  ? "Request approval to kick off execution. Your manager verifies, then admin gives final approval."
                  : "Submit measured savings. Your manager verifies, then admin gives final approval."}
              </p>
              <Textarea
                placeholder="Note for the manager (optional)…"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {canRequestCompletion && (
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Measured CO₂e (t/yr)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={mvValue}
                    onChange={(e) => setMvValue(e.target.value)}
                    placeholder="e.g. 128.4"
                  />
                </div>
              )}
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => {
                  if (canRequestExecution) {
                    run(
                      () =>
                        requestTransition(p!.id, user!.id, "execution", {
                          note: note || undefined,
                        }),
                      "Sent to manager for verification.",
                    );
                  } else {
                    if (!mvValue) {
                      toast.error("Enter the measured CO₂e result.");
                      return;
                    }
                    run(
                      () =>
                        requestTransition(p!.id, user!.id, "completed", {
                          note: note || undefined,
                          actualCo2e: Number(mvValue),
                        }).then(() => {
                          setMvValue("");
                        }),
                      "Completion sent to manager for verification.",
                    );
                  }
                }}
              >
                {canRequestExecution ? "Request move to execution" : "Submit for completion approval"}
              </Button>
            </div>
          )}

          {/* Manager desk — verify pending exec/completion request */}
          {canDoManagerDesk && hasPending && stage === "manager_review" && (
            <div className="bg-card rounded-xl p-6 card-shadow space-y-3">
              <div className="font-display font-semibold">
                Manager verification — {STATUS_META[p.requested_status!].label}
              </div>
              <p className="text-xs text-muted-foreground">
                Submitter requested move to{" "}
                <span className="font-medium text-foreground">
                  {STATUS_META[p.requested_status!].label}
                </span>
                {p.requested_actual_co2e_t_yr != null && (
                  <> with M&amp;V {fmtNumber(Number(p.requested_actual_co2e_t_yr))} tCO₂e/yr</>
                )}
                . Verify and forward to admin for final approval.
              </p>
              {p.requested_note && (
                <div className="text-xs bg-muted/50 rounded p-2">{p.requested_note}</div>
              )}
              <Textarea
                placeholder="Verification note (optional)…"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => rejectRequest(p!.id, user!.id, note || undefined),
                      "Request rejected.",
                    )
                  }
                >
                  Reject
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => managerForwardRequest(p!.id, user!.id, note || undefined),
                      "Forwarded to admin.",
                    )
                  }
                >
                  Verify &amp; forward
                </Button>
              </div>
            </div>
          )}

          {/* Admin desk — final approve pending exec/completion request */}
          {isAdmin && hasPending && stage === "admin_final" && (
            <div className="bg-card rounded-xl p-6 card-shadow space-y-3">
              <div className="font-display font-semibold">
                Admin final approval — {STATUS_META[p.requested_status!].label}
              </div>
              <p className="text-xs text-muted-foreground">
                Manager has verified. Grant final approval to move project to{" "}
                <span className="font-medium text-foreground">
                  {STATUS_META[p.requested_status!].label}
                </span>
                {p.requested_actual_co2e_t_yr != null && (
                  <> with measured {fmtNumber(Number(p.requested_actual_co2e_t_yr))} tCO₂e/yr</>
                )}
                .
              </p>
              {p.requested_note && (
                <div className="text-xs bg-muted/50 rounded p-2">{p.requested_note}</div>
              )}
              <Textarea
                placeholder="Optional approval note…"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => rejectRequest(p!.id, user!.id, note || undefined),
                      "Request rejected.",
                    )
                  }
                >
                  Reject
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        approveRequest(
                          p!.id,
                          user!.id,
                          p!.requested_status!,
                          p!.requested_actual_co2e_t_yr != null
                            ? Number(p!.requested_actual_co2e_t_yr)
                            : null,
                          note || undefined,
                        ),
                      "Approved.",
                    )
                  }
                >
                  Final approve
                </Button>
              </div>
            </div>
          )}

          {/* Owner waiting banner */}
          {isOwner && stage && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-xs">
              {stageLabel[stage]}
              {hasPending && (
                <>
                  {" "}
                  for move to{" "}
                  <span className="font-semibold">
                    {STATUS_META[p.requested_status!].label}
                  </span>
                </>
              )}
              .
            </div>
          )}

          <Link
            to="/projects"
            className="block text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Back to all projects
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}