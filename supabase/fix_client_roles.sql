-- Ce script s'assure que TOUS les utilisateurs ayant un compte client 
-- ont correctement le rôle 'client' et supprime le rôle 'agent' s'ils l'ont eu par erreur.

DO $$
DECLARE
    client_record RECORD;
BEGIN
    FOR client_record IN SELECT auth_user_id FROM public.clients WHERE auth_user_id IS NOT NULL
    LOOP
        -- Ajouter le rôle 'client'
        INSERT INTO public.user_roles (user_id, role) 
        VALUES (client_record.auth_user_id, 'client') 
        ON CONFLICT (user_id, role) DO NOTHING;

        -- Retirer le rôle 'agent' s'il a été ajouté par erreur
        DELETE FROM public.user_roles 
        WHERE user_id = client_record.auth_user_id AND role = 'agent';
    END LOOP;
END $$;
