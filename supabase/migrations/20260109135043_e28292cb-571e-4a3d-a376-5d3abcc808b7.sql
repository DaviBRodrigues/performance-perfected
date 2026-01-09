-- Create table for client integrations (Meta Ads, Google Ads, etc.)
CREATE TABLE public.client_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('meta_ads', 'google_ads')),
  account_id TEXT NOT NULL,
  account_name TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  credentials JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, platform, account_id)
);

-- Enable RLS
ALTER TABLE public.client_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own client integrations"
ON public.client_integrations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own client integrations"
ON public.client_integrations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own client integrations"
ON public.client_integrations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own client integrations"
ON public.client_integrations
FOR DELETE
USING (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE TRIGGER update_client_integrations_updated_at
BEFORE UPDATE ON public.client_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add platform column to reports table to track which integration was used
ALTER TABLE public.reports ADD COLUMN platform TEXT DEFAULT 'meta_ads';