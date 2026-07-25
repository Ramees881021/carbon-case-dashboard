ALTER TABLE public.projects ADD COLUMN manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS projects_manager_id_idx ON public.projects(manager_id);