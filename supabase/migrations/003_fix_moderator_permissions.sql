-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Moderators and admins can create events" ON public.events;
DROP POLICY IF EXISTS "Moderators and admins can update events" ON public.events;
DROP POLICY IF EXISTS "Moderators and admins can delete events" ON public.events;

-- Recreate policies with proper permissions for moderators
CREATE POLICY "Moderators and admins can create events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

CREATE POLICY "Moderators and admins can update events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

CREATE POLICY "Moderators and admins can delete events"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

-- Verify RLS is enabled
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT ALL ON public.events TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;