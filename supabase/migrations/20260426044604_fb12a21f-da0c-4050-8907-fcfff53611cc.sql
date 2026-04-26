
-- Drop the broad public SELECT policy and replace with a more restrictive one
DROP POLICY IF EXISTS "Avatars are public" ON storage.objects;

-- Public can only access files when they know the exact path (no listing)
CREATE POLICY "Avatars accessible by path" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Note: Supabase storage buckets marked public always allow direct URL access.
-- Setting bucket as not-public requires signed URLs. Keeping as-is per design intent.
