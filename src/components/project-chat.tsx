import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { fmtDate } from "@/lib/format";

type Msg = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: { full_name: string; avatar_color_hex: string } | null;
};

async function fetchMessages(projectId: string): Promise<Msg[]> {
  const { data, error } = await supabase
    .from("project_messages")
    .select("id,user_id,content,created_at")
    .eq("project_id", projectId)
    .order("created_at");
  if (error) throw error;
  const ids = Array.from(new Set((data ?? []).map((m) => m.user_id)));
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_color_hex")
    .in("id", ids);
  const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (data ?? []).map((m) => ({
    ...m,
    profile: pmap.get(m.user_id) ?? null,
  }));
}

export function ProjectChat({
  projectId,
  currentUserId,
  isAdmin,
}: {
  projectId: string;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], error } = useQuery({
    queryKey: ["project-messages", projectId],
    queryFn: () => fetchMessages(projectId),
    refetchInterval: 5000,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel(`project-messages-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_messages", filter: `project_id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["project-messages", projectId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, qc]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const { error } = await supabase
      .from("project_messages")
      .insert({ project_id: projectId, user_id: currentUserId, content: body });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
    qc.invalidateQueries({ queryKey: ["project-messages", projectId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("project_messages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["project-messages", projectId] });
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl p-6 card-shadow text-sm text-muted-foreground">
        You don't have access to this project's chat.
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 card-shadow space-y-3">
      <div className="font-display font-semibold">Project chat</div>
      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto space-y-3 border rounded-lg p-3 bg-muted/30"
      >
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8">
            No messages yet. Start the conversation.
          </div>
        )}
        {messages.map((m) => {
          const mine = m.user_id === currentUserId;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <UserAvatar
                name={m.profile?.full_name ?? "?"}
                color={m.profile?.avatar_color_hex ?? "#94a3b8"}
                size={28}
              />
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                <div className="text-[11px] text-muted-foreground px-1">
                  {m.profile?.full_name ?? "Unknown"} · {fmtDate(m.created_at)}
                </div>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                    mine ? "bg-primary text-primary-foreground" : "bg-background border"
                  }`}
                >
                  {m.content}
                </div>
                {(mine || isAdmin) && (
                  <button
                    onClick={() => remove(m.id)}
                    className="text-[11px] text-muted-foreground hover:text-destructive px-1 mt-0.5 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button onClick={send} disabled={sending || !text.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}