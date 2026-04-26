
-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE public.appointment_status AS ENUM ('scheduled','confirmed','completed','cancelled','no_show');
CREATE TYPE public.notification_type AS ENUM ('info','success','warning','error','client','payment','document','appointment');
CREATE TYPE public.document_category AS ENUM ('passport','diploma','cv','bank_statement','photo','letter','contract','other');
CREATE TYPE public.task_status AS ENUM ('todo','in_progress','done','cancelled');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TABLE public.appointments (
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
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY appt_select ON public.appointments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY appt_insert ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.can_manage_clients(auth.uid()));
CREATE POLICY appt_update ON public.appointments FOR UPDATE TO authenticated USING (public.can_manage_clients(auth.uid()));
CREATE POLICY appt_delete ON public.appointments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_appt_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type notification_type NOT NULL DEFAULT 'info',
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_select_own ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notif_update_own ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notif_insert_staff ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY notif_delete_own ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- DOCUMENTS
-- ============================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category document_category NOT NULL DEFAULT 'other',
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY docs_select ON public.documents FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY docs_insert ON public.documents FOR INSERT TO authenticated WITH CHECK (public.can_manage_clients(auth.uid()));
CREATE POLICY docs_update ON public.documents FOR UPDATE TO authenticated USING (public.can_manage_clients(auth.uid()));
CREATE POLICY docs_delete ON public.documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- AGENT COUNTRY PERMISSIONS
-- ============================================
CREATE TABLE public.agent_country_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  country TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, country)
);
ALTER TABLE public.agent_country_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY acp_select ON public.agent_country_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY acp_manage ON public.agent_country_permissions FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- ============================================
-- ACTIVITY LOG
-- ============================================
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY log_select_admin ON public.activity_log FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY log_insert ON public.activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TASKS
-- ============================================
CREATE TABLE public.tasks (
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
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.can_manage_clients(auth.uid()));
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated USING (public.can_manage_clients(auth.uid()) OR auth.uid() = assigned_to);
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- STORAGE BUCKETS
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents','client-documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars', true);

-- Client documents policies (staff only)
CREATE POLICY "Staff can view client docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff can upload client docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents' AND public.can_manage_clients(auth.uid()));
CREATE POLICY "Staff can update client docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-documents' AND public.can_manage_clients(auth.uid()));
CREATE POLICY "Admin can delete client docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-documents' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')));

-- Avatar policies (public read, own write)
CREATE POLICY "Avatars are public" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX idx_appointments_agent ON public.appointments(agent_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX idx_documents_client ON public.documents(client_id);
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_activity_log_user ON public.activity_log(user_id, created_at DESC);
