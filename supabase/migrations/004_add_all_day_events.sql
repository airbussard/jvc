-- Add is_all_day column to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT FALSE;

-- Update existing events to have is_all_day = false
UPDATE public.events
SET is_all_day = FALSE
WHERE is_all_day IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.events.is_all_day IS 'Indicates if the event is an all-day event (no specific times)';