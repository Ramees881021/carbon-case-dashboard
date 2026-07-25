import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, UserPlus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { fetchTeam } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";

type Member = {
  id: string;
  user_id: string;
  profile: { id: string; full_name: string; avatar_color_hex: string } | null;
};

async function fetchMembers(projectId: string): Promise<Member[]> {
  const { data: rows, error } = await supabase
    .from("project_members")
    .select("id,user_id,created_at")
    .eq("project_id", projectId)
    .order("created_at");
  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_color_hex")
    .in("id", ids);
  const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (rows ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    profile: pmap.get(r.user_id) ?? null,
  }));
}

export function ProjectMembers({
  projectId,
  submitterId,
  managerId,
  isAdmin,
}: {
  projectId: string;
  submitterId: string | null;
  managerId: string | null;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => fetchMembers(projectId),
  });
  const { data: team = [] } = useQuery({
    queryKey: ["team"],
    queryFn: fetchTeam,
    enabled: isAdmin,
  });

  const memberIds = new Set(members.map((m) => m.user_id));
  const excluded = new Set(
    [submitterId, managerId].filter(Boolean) as string[],
  );
  const addable = team.filter(
    (t) => !memberIds.has(t.id) && !excluded.has(t.id),
  );

  async function add() {
    if (!pick) return;
    setBusy(true);
    const { error } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: pick });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPick("");
    toast.success("Member added");
    qc.invalidateQueries({ queryKey: ["project-members", projectId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("project_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    qc.invalidateQueries({ queryKey: ["project-members", projectId] });
  }

  return (
    <div className="bg-card rounded-xl p-6 card-shadow space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-display font-semibold">Team</div>
        <span className="text-xs text-muted-foreground">{members.length + (submitterId ? 1 : 0) + (managerId && managerId !== submitterId ? 1 : 0)} people</span>
      </div>

      <ul className="space-y-2">
        {members.length === 0 && (
          <li className="text-xs text-muted-foreground">No additional members yet.</li>
        )}
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <UserAvatar
              name={m.profile?.full_name ?? "?"}
              color={m.profile?.avatar_color_hex ?? "#94a3b8"}
              size={24}
            />
            <span className="text-sm flex-1 truncate">{m.profile?.full_name ?? "Unknown"}</span>
            {isAdmin && (
              <button
                onClick={() => remove(m.id)}
                className="text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="flex gap-2 pt-2 border-t">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Add member…" />
            </SelectTrigger>
            <SelectContent>
              {addable.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Everyone is already on the project.
                </div>
              )}
              {addable.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={add} disabled={!pick || busy}>
            <UserPlus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}