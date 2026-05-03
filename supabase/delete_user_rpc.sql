-- Crée une fonction sécurisée pour supprimer complètement un utilisateur (employé ou client)
-- Seuls les administrateurs et super administrateurs peuvent l'exécuter.

CREATE OR REPLACE FUNCTION public.delete_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Exécute avec les privilèges du créateur de la fonction (souvent postgres, qui a accès à auth.users)
SET search_path = public
AS $$
BEGIN
  -- 1. Vérifier que l'utilisateur qui appelle la fonction est un admin ou super_admin
  IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Non autorisé: seuls les administrateurs peuvent supprimer des utilisateurs.';
  END IF;

  -- 2. Empêcher la suppression du compte admin principal (sécurité)
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte.';
  END IF;

  -- 3. Supprimer l'utilisateur de auth.users (ceci déclenchera les CASCADE pour supprimer le profil, les rôles, etc.)
  DELETE FROM auth.users WHERE id = target_user_id;

END;
$$;
