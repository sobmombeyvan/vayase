-- Add TikTok to lead_source enum
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'tiktok';
