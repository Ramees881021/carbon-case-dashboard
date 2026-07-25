CREATE POLICY "submitters submit own for review"
ON public.projects
FOR UPDATE
TO authenticated
USING (submitter_id = auth.uid() AND status IN ('proposed','hold'))
WITH CHECK (submitter_id = auth.uid() AND status = 'review');