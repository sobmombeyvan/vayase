-- ==========================================================
-- VAYASE NAVIGATOR - FRESH DATABASE SETUP
-- ==========================================================
-- Run in Supabase SQL Editor.
--
-- NEW Supabase project  → run SECTION 2 only
-- EXISTING project      → run SECTION 1, then SECTION 2
--
-- After setup: sign up your admin account. The trigger assigns
-- super_admin + admin to the founder email(s) below.
-- ==========================================================

-- ==========================================================
-- SECTION 1 — RESET (optional, for existing projects)
-- ==========================================================
-- WARNING: This deletes ALL app data and auth users.
-- Uncomment the block below only when you want a full wipe.

/*
BEGIN;

-- Drop all public tables (keeps auth/storage infrastructure)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
END $$;

-- Drop custom types
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT typname FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
  ) LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname);
  END LOOP;
END $$;

-- Remove all auth users (fresh start)
DELETE FROM auth.users;

COMMIT;
*/

-- ==========================================================
-- SECTION 2 — FULL SCHEMA
-- ==========================================================

-- =========================
-- ENUMS
-- =========================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'super_admin', 'admin', 'agent', 'marketing_agent',
    'comptable', 'manager', 'support', 'client'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM (
    'new', 'contacted', 'meeting_scheduled', 'converted', 'lost'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_source AS ENUM (
    'facebook', 'whatsapp', 'referral', 'website', 'instagram', 'tiktok', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_status AS ENUM (
    'vip', 'standard', 'late_payment', 'priority'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.step_status AS ENUM (
    'todo', 'in_progress', 'validated', 'blocked', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'pending', 'paid', 'overdue', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contract_status AS ENUM (
    'draft', 'active', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.appointment_status AS ENUM (
    'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'info', 'success', 'warning', 'error', 'client', 'payment', 'document', 'appointment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.document_category AS ENUM (
    'passport', 'diploma', 'cv', 'bank_statement', 'photo', 'letter', 'contract', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM (
    'todo', 'in_progress', 'done', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM (
    'low', 'medium', 'high', 'urgent'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================
-- TABLES
-- =========================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.procedure_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  destination_country TEXT,
  visa_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.procedure_template_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.procedure_templates(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_order INT NOT NULL DEFAULT 0,
  default_due_days INT,
  notes TEXT,
  default_responsible_role public.app_role,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender TEXT,
  date_of_birth DATE,
  address TEXT,
  nationality TEXT,
  profession TEXT,
  marital_status TEXT,
  destination_country TEXT,
  visa_type TEXT,
  program TEXT,
  urgency TEXT DEFAULT 'normal',
  status client_status NOT NULL DEFAULT 'standard',
  agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  procedure_template_id UUID REFERENCES public.procedure_templates(id) ON DELETE SET NULL,
  referred_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_fees_due NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source lead_source NOT NULL DEFAULT 'website',
  source_other TEXT,
  interest_level INT DEFAULT 3 CHECK (interest_level BETWEEN 1 AND 5),
  destination_country TEXT,
  budget NUMERIC(12,2),
  notes TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  referred_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_order INT NOT NULL DEFAULT 0,
  status step_status NOT NULL DEFAULT 'todo',
  due_date DATE,
  responsible_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  is_visible_to_client BOOLEAN NOT NULL DEFAULT true,
  priority INT DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL UNIQUE,
  total_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  status contract_status NOT NULL DEFAULT 'active',
  signed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  payment_method TEXT,
  payment_date DATE,
  due_date DATE,
  status payment_status NOT NULL DEFAULT 'pending',
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  agent_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  appointment_date TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60,
  location TEXT,
  meeting_url TEXT,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type notification_type NOT NULL DEFAULT 'info',
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category document_category NOT NULL DEFAULT 'other',
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID,
  notes TEXT,
  is_visible_to_client BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_country_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  country TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, country)
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_step_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.client_steps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- FUNCTIONS
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_manage_clients(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin','agent','marketing_agent','manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_finance(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin','comptable')
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  assigned_role text;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  assigned_role := NEW.raw_user_meta_data->>'role';

  IF lower(COALESCE(NEW.email, '')) IN ('asapptouch12@gmail.com', 'sobmombeyvan@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF assigned_role = 'client' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_non_admin_agent_reassignment()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.agent_id IS DISTINCT FROM NEW.agent_id
     AND NOT (
       public.has_role(auth.uid(), 'super_admin')
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Only admin/super_admin can change the assigned owner.';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.delete_user(target_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can delete users.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account.';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_client_steps(target_client_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'agent', 'manager')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: insufficient permissions.';
  END IF;

  DELETE FROM public.client_steps WHERE client_id = target_client_id;
END $$;

-- =========================
-- TRIGGERS
-- =========================
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_leads_updated ON public.leads;
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated ON public.clients;
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_client_steps_updated ON public.client_steps;
CREATE TRIGGER trg_client_steps_updated BEFORE UPDATE ON public.client_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_contracts_updated ON public.contracts;
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated ON public.payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_appt_updated ON public.appointments;
CREATE TRIGGER trg_appt_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_docs_updated ON public.documents;
CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated ON public.tasks;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_procedure_templates_updated ON public.procedure_templates;
CREATE TRIGGER trg_procedure_templates_updated BEFORE UPDATE ON public.procedure_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_procedure_template_steps_updated ON public.procedure_template_steps;
CREATE TRIGGER trg_procedure_template_steps_updated BEFORE UPDATE ON public.procedure_template_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_clients_guard_agent_assignment ON public.clients;
CREATE TRIGGER trg_clients_guard_agent_assignment
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.prevent_non_admin_agent_reassignment();

-- =========================
-- RLS
-- =========================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_country_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_step_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_template_steps ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Roles
DROP POLICY IF EXISTS "roles_select_authenticated" ON public.user_roles;
CREATE POLICY "roles_select_authenticated" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "roles_insert_admin" ON public.user_roles;
CREATE POLICY "roles_insert_admin" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "roles_delete_admin" ON public.user_roles;
CREATE POLICY "roles_delete_admin" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- Leads (agent-scoped read)
DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'support')
    OR (public.has_role(auth.uid(), 'agent') AND assigned_to = auth.uid())
  );
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_clients(auth.uid()));
DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads
  FOR UPDATE TO authenticated USING (public.can_manage_clients(auth.uid()));
DROP POLICY IF EXISTS "leads_delete" ON public.leads;
CREATE POLICY "leads_delete" ON public.leads
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Clients (agent-scoped read + client portal)
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'support')
    OR (public.has_role(auth.uid(), 'agent') AND agent_id = auth.uid())
  );
DROP POLICY IF EXISTS "clients_select_own" ON public.clients;
CREATE POLICY "clients_select_own" ON public.clients
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
DROP POLICY IF EXISTS "clients_insert" ON public.clients;
CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_clients(auth.uid()));
DROP POLICY IF EXISTS "clients_update" ON public.clients;
CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE TO authenticated USING (public.can_manage_clients(auth.uid()));
DROP POLICY IF EXISTS "clients_delete" ON public.clients;
CREATE POLICY "clients_delete" ON public.clients
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Client steps
DROP POLICY IF EXISTS "steps_select" ON public.client_steps;
CREATE POLICY "steps_select" ON public.client_steps
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "steps_select_own" ON public.client_steps;
CREATE POLICY "steps_select_own" ON public.client_steps
  FOR SELECT TO authenticated USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "steps_insert" ON public.client_steps;
CREATE POLICY "steps_insert" ON public.client_steps
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_clients(auth.uid()));
DROP POLICY IF EXISTS "steps_update" ON public.client_steps;
CREATE POLICY "steps_update" ON public.client_steps
  FOR UPDATE TO authenticated USING (public.can_manage_clients(auth.uid()));
DROP POLICY IF EXISTS "steps_delete" ON public.client_steps;
CREATE POLICY "steps_delete" ON public.client_steps
  FOR DELETE TO authenticated USING (public.can_manage_clients(auth.uid()));

-- Contracts (finance + client portal)
DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));
DROP POLICY IF EXISTS "contracts_select_own" ON public.contracts;
CREATE POLICY "contracts_select_own" ON public.contracts
  FOR SELECT TO authenticated USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
CREATE POLICY "contracts_insert" ON public.contracts
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts
  FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid()));
DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;
CREATE POLICY "contracts_delete" ON public.contracts
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Payments (finance + client portal)
DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT TO authenticated USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
DROP POLICY IF EXISTS "payments_update" ON public.payments;
CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid()));
DROP POLICY IF EXISTS "payments_delete" ON public.payments;
CREATE POLICY "payments_delete" ON public.payments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Appointments
DROP POLICY IF EXISTS appt_select ON public.appointments;
CREATE POLICY appt_select ON public.appointments
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS appt_insert ON public.appointments;
CREATE POLICY appt_insert ON public.appointments
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_clients(auth.uid()));
DROP POLICY IF EXISTS appt_update ON public.appointments;
CREATE POLICY appt_update ON public.appointments
  FOR UPDATE TO authenticated USING (public.can_manage_clients(auth.uid()));
DROP POLICY IF EXISTS appt_delete ON public.appointments;
CREATE POLICY appt_delete ON public.appointments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Notifications
DROP POLICY IF EXISTS notif_select_own ON public.notifications;
CREATE POLICY notif_select_own ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS notif_update_own ON public.notifications;
CREATE POLICY notif_update_own ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS notif_insert_staff ON public.notifications;
CREATE POLICY notif_insert_staff ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS notif_delete_own ON public.notifications;
CREATE POLICY notif_delete_own ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Documents (staff + client portal)
DROP POLICY IF EXISTS docs_select ON public.documents;
CREATE POLICY docs_select ON public.documents
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS docs_select_own ON public.documents;
CREATE POLICY docs_select_own ON public.documents
  FOR SELECT TO authenticated USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS docs_insert ON public.documents;
CREATE POLICY docs_insert ON public.documents
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_clients(auth.uid()));
DROP POLICY IF EXISTS docs_insert_own ON public.documents;
CREATE POLICY docs_insert_own ON public.documents
  FOR INSERT TO authenticated WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS docs_update ON public.documents;
CREATE POLICY docs_update ON public.documents
  FOR UPDATE TO authenticated USING (public.can_manage_clients(auth.uid()));
DROP POLICY IF EXISTS docs_update_own ON public.documents;
CREATE POLICY docs_update_own ON public.documents
  FOR UPDATE TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));
DROP POLICY IF EXISTS docs_delete ON public.documents;
CREATE POLICY docs_delete ON public.documents
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Agent country permissions
DROP POLICY IF EXISTS acp_select ON public.agent_country_permissions;
CREATE POLICY acp_select ON public.agent_country_permissions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS acp_manage ON public.agent_country_permissions;
CREATE POLICY acp_manage ON public.agent_country_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Activity log
DROP POLICY IF EXISTS log_select_admin ON public.activity_log;
CREATE POLICY log_select_admin ON public.activity_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
DROP POLICY IF EXISTS log_insert ON public.activity_log;
CREATE POLICY log_insert ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Tasks
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_clients(auth.uid()));
DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.can_manage_clients(auth.uid()) OR auth.uid() = assigned_to);
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Step notes
DROP POLICY IF EXISTS "step_notes_select" ON public.client_step_notes;
CREATE POLICY "step_notes_select" ON public.client_step_notes
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "step_notes_insert" ON public.client_step_notes;
CREATE POLICY "step_notes_insert" ON public.client_step_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_clients(auth.uid()) AND auth.uid() = user_id);
DROP POLICY IF EXISTS "step_notes_delete_admin" ON public.client_step_notes;
CREATE POLICY "step_notes_delete_admin" ON public.client_step_notes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Procedure templates
DROP POLICY IF EXISTS procedure_templates_select ON public.procedure_templates;
CREATE POLICY procedure_templates_select ON public.procedure_templates
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS procedure_templates_manage ON public.procedure_templates;
CREATE POLICY procedure_templates_manage ON public.procedure_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS procedure_template_steps_select ON public.procedure_template_steps;
CREATE POLICY procedure_template_steps_select ON public.procedure_template_steps
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS procedure_template_steps_manage ON public.procedure_template_steps;
CREATE POLICY procedure_template_steps_manage ON public.procedure_template_steps
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- =========================
-- STORAGE
-- =========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets SET public = false WHERE id = 'avatars';

DROP POLICY IF EXISTS "Staff can view client docs" ON storage.objects;
CREATE POLICY "Staff can view client docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can upload client docs" ON storage.objects;
CREATE POLICY "Staff can upload client docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents' AND public.can_manage_clients(auth.uid()));

DROP POLICY IF EXISTS "Staff can update client docs" ON storage.objects;
CREATE POLICY "Staff can update client docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'client-documents' AND public.can_manage_clients(auth.uid()));

DROP POLICY IF EXISTS "Admin can delete client docs" ON storage.objects;
CREATE POLICY "Admin can delete client docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-documents' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "Clients can view own docs" ON storage.objects;
CREATE POLICY "Clients can view own docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents' AND (
    (storage.foldername(name))[1] IN (SELECT id::text FROM public.clients WHERE auth_user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Clients can upload own docs" ON storage.objects;
CREATE POLICY "Clients can upload own docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents' AND (
    (storage.foldername(name))[1] IN (SELECT id::text FROM public.clients WHERE auth_user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Authenticated can view avatars" ON storage.objects;
CREATE POLICY "Authenticated can view avatars" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');

-- =========================
-- REALTIME
-- =========================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- =========================
-- INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS idx_clients_agent ON public.clients(agent_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_procedure_template_id ON public.clients(procedure_template_id);
CREATE INDEX IF NOT EXISTS idx_clients_referred_by_user_id ON public.clients(referred_by_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_referred_by_user_id ON public.leads(referred_by_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_converted_by_user_id ON public.leads(converted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_steps_client ON public.client_steps(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_contract ON public.payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_agent ON public.appointments(agent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_documents_client ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_step_notes_step ON public.client_step_notes(step_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_step_notes_user ON public.client_step_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proc_tpl_active ON public.procedure_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_proc_tpl_country ON public.procedure_templates(destination_country);
CREATE INDEX IF NOT EXISTS idx_proc_tpl_steps_tpl ON public.procedure_template_steps(template_id, step_order);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ==========================================================
-- DONE. Next steps:
-- 1. Sign up with your admin email in the app
-- 2. Founder emails auto-get super_admin + admin roles
-- 3. All other signups default to agent (or client if role=client in metadata)
-- ==========================================================
