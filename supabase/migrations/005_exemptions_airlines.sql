-- Migration: Airlines und Freistellungen
-- Erstellt Airlines-Tabelle, erweitert profiles und events

-- Airlines-Tabelle
CREATE TABLE IF NOT EXISTS public.airlines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Airline zu Profil hinzufügen (jeder Nutzer gehört zu einer Airline)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS airline_id UUID REFERENCES public.airlines(id) ON DELETE SET NULL;

-- Freistellung-Flag zu Events hinzufügen
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS requires_exemption BOOLEAN DEFAULT false;

-- RLS für Airlines aktivieren
ALTER TABLE public.airlines ENABLE ROW LEVEL SECURITY;

-- Jeder authentifizierte Nutzer kann Airlines sehen
CREATE POLICY "Airlines viewable by authenticated users"
  ON public.airlines FOR SELECT
  TO authenticated
  USING (true);

-- Nur Admins können Airlines erstellen
CREATE POLICY "Only admins can insert airlines"
  ON public.airlines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Nur Admins können Airlines aktualisieren
CREATE POLICY "Only admins can update airlines"
  ON public.airlines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Nur Admins können Airlines löschen
CREATE POLICY "Only admins can delete airlines"
  ON public.airlines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_profiles_airline_id ON public.profiles(airline_id);
CREATE INDEX IF NOT EXISTS idx_events_requires_exemption ON public.events(requires_exemption) WHERE requires_exemption = true;
