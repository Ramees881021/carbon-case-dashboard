import type { Database } from "@/integrations/supabase/types";

export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export const STATUS_ORDER: ProjectStatus[] = [
  "proposed",
  "review",
  "validated",
  "execution",
  "completed",
  "hold",
];

export const STATUS_META: Record<
  ProjectStatus,
  { label: string; color: string; cssVar: string }
> = {
  proposed: { label: "Not Started", color: "#C4C4C4", cssVar: "--status-proposed" },
  review: { label: "Working On It", color: "#FDAB3D", cssVar: "--status-review" },
  validated: { label: "Approved", color: "#4EBBF0", cssVar: "--status-validated" },
  execution: { label: "In Progress", color: "#A25DDC", cssVar: "--status-execution" },
  completed: { label: "Done", color: "#00C875", cssVar: "--status-completed" },
  hold: { label: "Stuck", color: "#E2445C", cssVar: "--status-hold" },
};

export const FUNNEL_STATUSES: ProjectStatus[] = [
  "proposed",
  "review",
  "validated",
  "execution",
  "completed",
];