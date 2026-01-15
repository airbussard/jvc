-- Migration: requires_exemption von events nach event_attendances verschieben
-- Jeder Nutzer kann individuell markieren, ob er eine Freistellung benötigt

-- Spalte zu event_attendances hinzufügen
ALTER TABLE public.event_attendances
ADD COLUMN IF NOT EXISTS requires_exemption BOOLEAN DEFAULT false;

-- Spalte aus events entfernen
ALTER TABLE public.events
DROP COLUMN IF EXISTS requires_exemption;
