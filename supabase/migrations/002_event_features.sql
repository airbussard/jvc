-- Add color field to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3b82f6';

-- Create attendance status enum
CREATE TYPE attendance_status AS ENUM ('attending_onsite', 'attending_hybrid', 'absent');

-- Create event_attendances table
CREATE TABLE IF NOT EXISTS public.event_attendances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status attendance_status NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id) -- Prevent duplicate entries
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_attendances_event_id ON public.event_attendances(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendances_user_id ON public.event_attendances(user_id);

-- Enable RLS for event_attendances
ALTER TABLE public.event_attendances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_attendances

-- Everyone can view attendances
CREATE POLICY "Attendances are viewable by authenticated users"
  ON public.event_attendances FOR SELECT
  TO authenticated
  USING (true);

-- Users can manage their own attendance
CREATE POLICY "Users can insert own attendance"
  ON public.event_attendances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance"
  ON public.event_attendances FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own attendance"
  ON public.event_attendances FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_event_attendances_updated_at
  BEFORE UPDATE ON public.event_attendances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();