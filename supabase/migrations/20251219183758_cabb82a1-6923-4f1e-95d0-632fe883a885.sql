-- Add report_format_id column to scheduled_reports
ALTER TABLE public.scheduled_reports 
ADD COLUMN report_format_id UUID REFERENCES public.report_formats(id) ON DELETE SET NULL;