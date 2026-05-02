-- ==========================================================
-- VAYASE NAVIGATOR - CLIENT PORTAL VISIBILITY UPDATE
-- Run this file in your Supabase SQL Editor.
-- ==========================================================

-- 1. Add visibility columns
ALTER TABLE public.client_steps ADD COLUMN IF NOT EXISTS is_visible_to_client BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_visible_to_client BOOLEAN NOT NULL DEFAULT true;

-- 2. Update existing rows if necessary (default already applies to existing rows usually, but just in case)
UPDATE public.client_steps SET is_visible_to_client = true WHERE is_visible_to_client IS NULL;
UPDATE public.documents SET is_visible_to_client = true WHERE is_visible_to_client IS NULL;
