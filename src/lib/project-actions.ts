import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import type { ProjectStatus } from "@/lib/status";

export type ReviewStage = "admin_triage" | "manager_review" | "admin_final";

export async function logHistory(projectId: string, actorId: string, text: string) {
  await supabase.from("project_history").insert({
    project_id: projectId,
    actor_id: actorId,
    event_text: text,
  });
}

export async function updateProjectStatus(
  projectId: string,
  actorId: string,
  status: ProjectStatus,
  note?: string,
  extra?: TablesUpdate<"projects">,
) {
  const patch: TablesUpdate<"projects"> = { status, ...(extra ?? {}) };
  const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
  if (error) throw error;
  await logHistory(projectId, actorId, note ?? `Status changed to ${status}`);
}

// ---------- Multi-step review flow (initial validation) ----------

export async function submitForReview(projectId: string, actorId: string, note?: string) {
  const { error } = await supabase
    .from("projects")
    .update({ status: "review", review_stage: "admin_triage" })
    .eq("id", projectId);
  if (error) throw error;
  await logHistory(
    projectId,
    actorId,
    note ? `Sent for review — awaiting admin triage: ${note}` : "Sent for review — awaiting admin triage",
  );
}

export async function adminAssignManager(
  projectId: string,
  actorId: string,
  managerId: string,
  managerName: string,
  note?: string,
) {
  const { error } = await supabase
    .from("projects")
    .update({ manager_id: managerId, review_stage: "manager_review" })
    .eq("id", projectId);
  if (error) throw error;
  await logHistory(
    projectId,
    actorId,
    note
      ? `Admin assigned ${managerName} as manager: ${note}`
      : `Admin assigned ${managerName} as manager for verification`,
  );
}

export async function managerVerifyReview(projectId: string, actorId: string, note?: string) {
  const { error } = await supabase
    .from("projects")
    .update({ review_stage: "admin_final" })
    .eq("id", projectId);
  if (error) throw error;
  await logHistory(
    projectId,
    actorId,
    note
      ? `Manager verified — forwarded to admin for final approval: ${note}`
      : "Manager verified — forwarded to admin for final approval",
  );
}

export async function adminFinalApproveReview(
  projectId: string,
  actorId: string,
  note?: string,
) {
  const { error } = await supabase
    .from("projects")
    .update({ status: "validated", review_stage: null })
    .eq("id", projectId);
  if (error) throw error;
  await logHistory(
    projectId,
    actorId,
    note ? `Admin final approval — validated: ${note}` : "Admin final approval — project validated",
  );
}

export async function sendReviewBack(projectId: string, actorId: string, note?: string) {
  const { error } = await supabase
    .from("projects")
    .update({ status: "proposed", review_stage: null })
    .eq("id", projectId);
  if (error) throw error;
  await logHistory(
    projectId,
    actorId,
    note ? `Sent back to submitter: ${note}` : "Sent back to submitter for revisions",
  );
}

// ---------- Multi-step approval flow for execution / completion ----------

export async function requestTransition(
  projectId: string,
  actorId: string,
  target: ProjectStatus,
  opts?: { note?: string; actualCo2e?: number },
) {
  const patch: TablesUpdate<"projects"> = {
    requested_status: target,
    requested_note: opts?.note ?? null,
    requested_actual_co2e_t_yr: opts?.actualCo2e ?? null,
    review_stage: "manager_review",
  };
  const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
  if (error) throw error;
  const label =
    target === "execution"
      ? "Requested move to execution — awaiting manager verification"
      : target === "completed"
        ? `Requested completion${opts?.actualCo2e != null ? ` — M&V ${opts.actualCo2e} tCO₂e/yr` : ""} — awaiting manager verification`
        : `Requested transition to ${target}`;
  await logHistory(projectId, actorId, opts?.note ? `${label}: ${opts.note}` : label);
}

export async function managerForwardRequest(
  projectId: string,
  actorId: string,
  note?: string,
) {
  const { error } = await supabase
    .from("projects")
    .update({ review_stage: "admin_final" })
    .eq("id", projectId);
  if (error) throw error;
  await logHistory(
    projectId,
    actorId,
    note
      ? `Manager verified request — forwarded to admin for final approval: ${note}`
      : "Manager verified request — forwarded to admin for final approval",
  );
}

export async function approveRequest(
  projectId: string,
  actorId: string,
  target: ProjectStatus,
  requestedActualCo2e: number | null,
  note?: string,
) {
  const extra: TablesUpdate<"projects"> = {
    requested_status: null,
    requested_note: null,
    requested_actual_co2e_t_yr: null,
    review_stage: null,
  };
  if (target === "completed" && requestedActualCo2e != null) {
    extra.actual_co2e_t_yr = requestedActualCo2e;
    extra.actual_completion_date = new Date().toISOString().slice(0, 10);
  }
  await updateProjectStatus(
    projectId,
    actorId,
    target,
    note ? `Admin final approval — ${target}: ${note}` : `Admin final approval — moved to ${target}`,
    extra,
  );
}

export async function rejectRequest(
  projectId: string,
  actorId: string,
  note?: string,
) {
  const { error } = await supabase
    .from("projects")
    .update({
      requested_status: null,
      requested_note: null,
      requested_actual_co2e_t_yr: null,
      review_stage: null,
    })
    .eq("id", projectId);
  if (error) throw error;
  await logHistory(
    projectId,
    actorId,
    note ? `Rejected pending request: ${note}` : "Rejected pending request",
  );
}