
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

DROP POLICY IF EXISTS "Avatars accessible by path" ON storage.objects;

CREATE POLICY "Authenticated can view avatars" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
