ALTER TABLE public.projects
  ADD COLUMN requested_status public.project_status,
  ADD COLUMN requested_actual_co2e_t_yr numeric,
  ADD COLUMN requested_note text;

CREATE POLICY "submitters request transition"
ON public.projects
FOR UPDATE
TO authenticated
USING (submitter_id = auth.uid() AND status IN ('validated','execution'))
WITH CHECK (submitter_id = auth.uid() AND status IN ('validated','execution'));