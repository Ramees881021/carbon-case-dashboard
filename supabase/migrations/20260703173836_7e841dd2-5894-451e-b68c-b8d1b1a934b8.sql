CREATE TABLE public.project_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_images TO authenticated;
GRANT ALL ON public.project_images TO service_role;

ALTER TABLE public.project_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX project_images_project_id_idx ON public.project_images(project_id);

CREATE POLICY "project images readable"
ON public.project_images FOR SELECT TO authenticated
USING (true);

CREATE POLICY "submitter or manager insert project images"
ON public.project_images FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND (
    public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.submitter_id = auth.uid()
    )
  )
);

CREATE POLICY "uploader or manager delete project images"
ON public.project_images FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'admin')
);

-- Storage policies for project-images bucket
CREATE POLICY "project image files readable"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'project-images');

CREATE POLICY "authenticated upload project image files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-images' AND owner = auth.uid());

CREATE POLICY "owner or manager delete project image files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-images' AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'admin')
  )
);