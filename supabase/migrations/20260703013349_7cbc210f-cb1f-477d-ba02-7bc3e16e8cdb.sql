
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('submitter','manager','leadership','admin');
CREATE TYPE public.project_status AS ENUM ('proposed','review','validated','execution','completed','hold');

-- =========================================================
-- UTILITY: updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'New User',
  avatar_color_hex TEXT NOT NULL DEFAULT '#0073EA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles readable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- USER ROLES (separate table + security definer helper)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles readable by authenticated" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Admins can manage user_roles
CREATE POLICY "admins manage user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- New user trigger -> profile + default role
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  palette TEXT[] := ARRAY['#0073EA','#00C875','#FDAB3D','#E2445C','#A25DDC','#4EBBF0'];
  color TEXT;
  is_first BOOLEAN;
BEGIN
  color := palette[1 + (floor(random()*array_length(palette,1)))::int];
  INSERT INTO public.profiles (id, full_name, avatar_color_hex)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), color);

  -- First user = admin, everyone else = submitter (managers/leadership assigned by admin)
  SELECT NOT EXISTS(SELECT 1 FROM public.user_roles) INTO is_first;
  IF is_first THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'manager');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'submitter');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- SITES
-- =========================================================
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color_hex TEXT NOT NULL DEFAULT '#0073EA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sites readable" ON public.sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write sites" ON public.sites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- CATEGORIES
-- =========================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories readable" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- PROJECTS
-- =========================================================
CREATE SEQUENCE public.project_code_seq START 100;

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  submitter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status public.project_status NOT NULL DEFAULT 'proposed',
  capex_estimate NUMERIC(14,2) NOT NULL DEFAULT 0,
  baseline_energy_mwh_yr NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_savings_mwh_yr NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_co2e_t_yr NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_co2e_t_yr NUMERIC(12,2),
  simple_payback_years NUMERIC(6,2) NOT NULL DEFAULT 0,
  proposed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  planned_start_date DATE,
  planned_end_date DATE,
  actual_completion_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.assign_project_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'CX-' || lpad(nextval('public.project_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER projects_assign_code BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.assign_project_code();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects readable" ON public.projects FOR SELECT TO authenticated USING (true);
-- Submitters or managers can create projects; must set themselves as submitter
CREATE POLICY "submitters create projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    submitter_id = auth.uid()
    AND (public.has_role(auth.uid(),'submitter') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin'))
  );
-- Only managers/admins update projects
CREATE POLICY "managers update projects" ON public.projects FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete projects" ON public.projects FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- PROJECT HISTORY
-- =========================================================
CREATE TABLE public.project_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.project_history TO authenticated;
GRANT ALL ON public.project_history TO service_role;
ALTER TABLE public.project_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history readable" ON public.project_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated log history" ON public.project_history FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- =========================================================
-- YEAR TARGETS
-- =========================================================
CREATE TABLE public.year_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_label TEXT NOT NULL UNIQUE,
  target_co2e_t_yr NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_co2e_t_yr NUMERIC(12,2),
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX year_targets_one_current ON public.year_targets((is_current)) WHERE is_current;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.year_targets TO authenticated;
GRANT ALL ON public.year_targets TO service_role;
ALTER TABLE public.year_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "year_targets readable" ON public.year_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write year_targets" ON public.year_targets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- SEED master data (sites, categories, year_targets)
-- =========================================================
INSERT INTO public.sites (name, color_hex) VALUES
  ('Riverside Plant','#0073EA'),
  ('North Yard Works','#00C875'),
  ('Coastal Fabrication','#A25DDC'),
  ('Midlands Assembly','#FDAB3D');

INSERT INTO public.categories (name) VALUES
  ('Waste Heat Recovery'),
  ('Compressed Air Optimisation'),
  ('LED Lighting Retrofit'),
  ('VFD/Motor Upgrade'),
  ('Solar PV Generation'),
  ('Boiler & Steam System'),
  ('Building Envelope'),
  ('Process Electrification'),
  ('HVAC Optimisation');

INSERT INTO public.year_targets (year_label, target_co2e_t_yr, actual_co2e_t_yr, is_current) VALUES
  ('FY23', 1200, 1085, false),
  ('FY24', 1500, 1420, false),
  ('FY25', 1800, 1655, false),
  ('FY26', 2200, NULL, true);
