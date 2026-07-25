
-- Fix: assign_project_code needs search_path
CREATE OR REPLACE FUNCTION public.assign_project_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'CX-' || lpad(nextval('public.project_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Lock down SECURITY DEFINER helpers
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- called only by trigger on auth.users; no direct execute needed
