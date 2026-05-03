CREATE OR REPLACE FUNCTION public.delete_client_steps(target_client_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier si l'utilisateur est admin ou agent
  IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'agent', 'manager')
  ) THEN
    RAISE EXCEPTION 'Non autorisé: permissions insuffisantes.';
  END IF;

  DELETE FROM public.client_steps WHERE client_id = target_client_id;
END;
$$;
