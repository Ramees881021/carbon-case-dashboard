import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Trash2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/format";

type ImageRow = {
  id: string;
  project_id: string;
  uploaded_by: string | null;
  storage_path: string;
  caption: string | null;
  created_at: string;
  signedUrl?: string;
};

async function fetchProjectImages(projectId: string): Promise<ImageRow[]> {
  const { data, error } = await supabase
    .from("project_images")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ImageRow[];
  if (rows.length === 0) return rows;
  const paths = rows.map((r) => r.storage_path);
  const { data: signed } = await supabase.storage
    .from("project-images")
    .createSignedUrls(paths, 60 * 60);
  const byPath = new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl]));
  return rows.map((r) => ({
    ...r,
    signedUrl: byPath.get(r.storage_path) ?? undefined,
  }));
}

export function ProjectGallery({
  projectId,
  canUpload,
}: {
  projectId: string;
  canUpload: boolean;
}) {
  const { user, isManager } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<ImageRow | null>(null);

  const { data: images = [], isLoading } = useQuery({
    queryKey: ["project-images", projectId],
    queryFn: () => fetchProjectImages(projectId),
  });

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !user) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} isn't an image`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 10MB`);
          continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("project-images")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { error: rowErr } = await supabase.from("project_images").insert({
          project_id: projectId,
          uploaded_by: user.id,
          storage_path: path,
          caption: caption || null,
        });
        if (rowErr) {
          await supabase.storage.from("project-images").remove([path]);
          throw rowErr;
        }
      }
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Photos added to album");
      qc.invalidateQueries({ queryKey: ["project-images", projectId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(img: ImageRow) {
    if (!user) return;
    setBusy(true);
    try {
      await supabase.storage.from("project-images").remove([img.storage_path]);
      const { error } = await supabase.from("project_images").delete().eq("id", img.id);
      if (error) throw error;
      toast.success("Photo removed");
      qc.invalidateQueries({ queryKey: ["project-images", projectId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card rounded-xl p-6 card-shadow">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display font-semibold">Project album</div>
          <div className="text-xs text-muted-foreground">
            Photos for records and external audits.
          </div>
        </div>
        {canUpload && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <ImagePlus className="h-4 w-4 mr-1" />
            Add photos
          </Button>
        )}
      </div>

      {canUpload && (
        <div className="mb-4 space-y-2">
          <Input
            placeholder="Caption for the next upload (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading photos…</div>
      ) : images.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
          No photos yet.{canUpload && " Use “Add photos” to upload site or progress images."}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((img) => {
            const canDelete = user && (img.uploaded_by === user.id || isManager);
            return (
              <div
                key={img.id}
                className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
                onClick={() => setLightbox(img)}
              >
                {img.signedUrl ? (
                  <img
                    src={img.signedUrl}
                    alt={img.caption ?? "Project photo"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    (unavailable)
                  </div>
                )}
                {img.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-xs line-clamp-2">
                    {img.caption}
                  </div>
                )}
                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(img);
                    }}
                    className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete photo"
                    disabled={busy}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <div
            className="max-w-5xl max-h-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.signedUrl && (
              <img
                src={lightbox.signedUrl}
                alt={lightbox.caption ?? "Project photo"}
                className="max-h-[80vh] max-w-full rounded-lg"
              />
            )}
            <div className="mt-3 text-center text-white/90 text-sm">
              {lightbox.caption && <div className="font-medium">{lightbox.caption}</div>}
              <div className="text-white/60 text-xs mt-1">
                Uploaded {fmtDate(lightbox.created_at)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}