
-- Project members table
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can see membership (needed to know who is in a chat)
CREATE POLICY "auth read members" ON public.project_members FOR SELECT TO authenticated USING (true);
-- Only admins manage membership
CREATE POLICY "admin insert members" ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete members" ON public.project_members FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Helper: is user in project (submitter, manager, or explicit member, or admin/leadership)
CREATE OR REPLACE FUNCTION public.is_project_participant(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'leadership')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND (p.submitter_id = _user_id OR p.manager_id = _user_id))
    OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = _project_id AND m.user_id = _user_id);
$$;

-- Chat messages
CREATE TABLE public.project_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_messages TO authenticated;
GRANT ALL ON public.project_messages TO service_role;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read messages" ON public.project_messages FOR SELECT TO authenticated
  USING (public.is_project_participant(project_id, auth.uid()));
CREATE POLICY "participants send messages" ON public.project_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_project_participant(project_id, auth.uid()));
CREATE POLICY "author delete messages" ON public.project_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_project_messages_project_created ON public.project_messages(project_id, created_at);
CREATE INDEX idx_project_members_project ON public.project_members(project_id);
