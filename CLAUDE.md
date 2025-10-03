Wir brauchen für unseren Jugendverband (jVC) ein kleines Websystem in dem wir alle unsere Termine managen. Es soll drei accountstufen geben: Normal, Moderator*in, und Administrator. Als Grundlage soll Supabase verwendet werden, das Projekt wird über github auf inem Caprover server gedeployed. Administratoren sollen die anderen Nutzer managen können - also neuen Account anlegen (dann soll automatisch eine Einladungsmail versendet werden um auch das passwort zu setzen). Denk dir das sinnvoll aus. Moderatoren sollen Termine in einem gemeinsamen Kalender angezeigt werden und per knopfdruck in ein iphone kalender kompatibles format exportiert werden können. Sprich: man soll einen zeitraum wählen können und alle Termine in diesem Zeitraum als datei fürs iphone/mac oder andere kalender exportieren können. Zudem soll jeder Nutzer seine eigenen Urlaube in seinem Profil hinterlegen können, also auch mehrere Urlaubszeiträume, wenn gewünscht. Es sollen außerdem F Tage eingetragen werden können (auch mehrere hintereinander) an denen man schlicht nicht verfügbar ist. In einem Verfügbarkeitskalender sollte man dann sehen wo jemand urlaub oder F tage hat, auch gerne zusätzlich als overlay oder gute lösung um das irgendwie im kalender sichtbar zu haben, wer an welchem termin potentiell verfügbar ist / oder ggf einen Urlaub oder F tag an einem termin stehen hat. Diese sollen natürlich nicht dann mitexportiert werden in den Dateien, die man sich in den kalender ziehen kann. Denk dir das mal sinnvoll aus.

Datenbank: Supabase

SUPABASE:

DB: JingJang1001!!

ANON: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxenRicXhjbWxnZXp4bW1ycWpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MjYzMjUsImV4cCI6MjA3NDIwMjMyNX0.6yYEoxsehaYnD3wP1Mbv8K6Z3A9bTFHtIzfWC2Iqxug

SRK: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxenRicXhjbWxnZXp4bW1ycWpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODYyNjMyNSwiZXhwIjoyMDc0MjAyMzI1fQ.ug-qv3G9KRB_dyeKsvTxdPYBGnr-E3f1YJtrXVybq8o

und github:

https://github.com/airbussard/jvc

bitte immer pushen und committen. Sprich mit mir auf deutsch.

System: Next.JS als basis.

## Projektstruktur

### Tech-Stack
- **Frontend**: Next.js 15 mit App Router, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Deployment**: CapRover via GitHub
- **Kalender**: React Big Calendar
- **Export**: ICS-Format für Kalender-Apps

### Datenbankschema

#### Tabellen
1. **profiles** (erweitert Supabase auth.users)
   - id (uuid, FK zu auth.users)
   - role (enum: 'normal', 'moderator', 'admin')
   - full_name
   - created_at
   - updated_at

2. **events** (Termine)
   - id (uuid)
   - title
   - description
   - start_datetime
   - end_datetime
   - location
   - color (Farbcode für Termin)
   - is_all_day (Boolean für ganztägige Termine)
   - created_by (FK zu profiles)
   - created_at
   - updated_at

3. **vacations** (Urlaube)
   - id (uuid)
   - user_id (FK zu profiles)
   - start_date
   - end_date
   - note
   - created_at

4. **unavailable_days** (F-Tage)
   - id (uuid)
   - user_id (FK zu profiles)
   - date
   - reason
   - created_at

5. **event_attendances** (Teilnahmen)
   - id (uuid)
   - event_id (FK zu events)
   - user_id (FK zu profiles)
   - status (enum: 'attending_onsite', 'attending_hybrid', 'absent')
   - created_at
   - updated_at

### Benutzerrollen

- **Normal**: Kann eigene Urlaube/F-Tage verwalten, Termine einsehen
- **Moderator**: Zusätzlich Termine erstellen/bearbeiten
- **Administrator**: Vollzugriff, Benutzerverwaltung, Einladungen

### Hauptfunktionen

1. **Terminkalender**
   - Monats-/Wochen-/Tagesansicht
   - Agenda-Ansicht mit allen zukünftigen Terminen (365 Tage)
   - Farbcodierung nach Termin
   - Schnelle Terminerfassung
   - Ganztägige Termine (auch mehrtägig)
   - Mobile-optimierte Ansicht

2. **Verfügbarkeitsübersicht**
   - Kalender mit Urlaubs-/F-Tage-Overlay
   - Farbliche Markierung (Rot=Urlaub, Orange=F-Tag)
   - Seitenleiste mit Abwesenheitsübersicht
   - Konfliktanzeige bei Überschneidungen

3. **Export-Funktion**
   - Zeitraum wählbar (Von-Bis-Datum)
   - ICS-Format (iPhone/Mac/Outlook kompatibel)
   - Korrekte Mehrtages-Event-Unterstützung
   - Nur Termine (keine privaten Daten)
   - Anzahl der zu exportierenden Termine wird angezeigt

4. **Teilnahme-Management**
   - Drei Status: Vor Ort, Hybrid, Abwesend
   - Teilnehmerliste mit Avataren
   - Visuelle Kennzeichnung eigener Teilnahmen
   - Direkte Statusänderung im Termin-Modal

5. **Admin-Panel**
   - Benutzerübersicht mit Rollenverwaltung
   - Einladungen per E-Mail versenden
   - Benutzer löschen/bearbeiten

6. **Profil-Einstellungen**
   - Eigene Urlaube verwalten (mehrere Zeiträume)
   - F-Tage eintragen
   - Passwort ändern
   - Vollständiger Name bearbeitbar

### Installierte Pakete
- next@15.5.3
- react@19.1.1
- typescript@5.9.2
- tailwindcss@3.4.17 (v4 ist inkompatibel)
- @supabase/supabase-js (wird installiert)
- react-big-calendar (wird installiert)
- date-fns (wird installiert)
- ical-generator (wird installiert)

### Scripts
```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
```

### Umgebungsvariablen (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://fqztbqxcmlgezxmmrqjh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Deployment (CapRover)
- Dockerfile für Next.js
- captain-definition für automatisches Deployment
- GitHub Actions für CI/CD

### Entwicklungsfortschritt
✅ Next.js Projekt initialisiert
✅ Supabase Integration konfiguriert
✅ Datenbankschema erstellt (supabase/schema.sql)
✅ Auth-System implementiert
✅ UI-Komponenten entwickelt
✅ Kalender-Features umgesetzt
✅ Export-Funktion erstellt (ICS-Format mit korrekter Mehrtages-Unterstützung)
✅ Deployment-Setup konfiguriert
✅ Passwort-Vergessen-Funktion
✅ Erweiterte Termin-Features:
   - Farbauswahl für Termine
   - Teilnahme-Management (Vor Ort/Hybrid/Abwesend)
   - Teilnehmerliste mit Status
   - Visuelle Kennzeichnung eigener Teilnahmen
   - Ganztägige Termine (auch mehrtägig)
✅ Responsive Design für Mobile/Tablet/Desktop
✅ Verfügbarkeitskalender mit Urlaubs-/F-Tage-Overlay
✅ Agenda-Ansicht zeigt alle zukünftigen Termine (365 Tage)
✅ Moderatoren-Berechtigungen korrigiert

### Wichtige SQL-Befehle für Supabase

#### Basis-Schema
Das Schema in `supabase/schema.sql` muss im Supabase SQL-Editor ausgeführt werden:
1. Gehe zu https://supabase.com/dashboard/project/fqztbqxcmlgezxmmrqjh/sql
2. Füge den Inhalt von `supabase/schema.sql` ein
3. Führe das Skript aus

#### Migrationen (in dieser Reihenfolge ausführen!)
Nach dem Basis-Schema müssen folgende Migrationen ausgeführt werden:
1. **002_event_features.sql** - Fügt Farben und Teilnahme-Management hinzu
2. **003_fix_moderator_permissions.sql** - Korrigiert Moderator-Berechtigungen
3. **004_add_all_day_events.sql** - Aktiviert ganztägige Termine

**WICHTIG**: Alle Migrationen befinden sich im Ordner `supabase/migrations/`

### Setup-Anweisungen

#### 1. Lokale Entwicklung starten
```bash
npm run dev
```
Öffne http://localhost:3000

#### 2. Supabase konfigurieren
- Führe das SQL-Schema aus (siehe oben)
- Aktiviere E-Mail-Authentifizierung in Supabase Dashboard
- Konfiguriere SMTP-Einstellungen für Einladungs-E-Mails

#### 3. Ersten Admin-User erstellen
1. Registriere einen Benutzer über Supabase Dashboard
2. Führe folgendes SQL aus:
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'USER_ID_HERE';
```

#### 4. CapRover Deployment
- Erstelle App in CapRover
- **WICHTIG**: Füge Umgebungsvariablen in CapRover hinzu (siehe CAPROVER_ENV.md):
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY
- Deploye die App via GitHub oder manuell
- Konfiguriere GitHub Secrets (falls automatisches Deployment gewünscht):
  - CAPROVER_SERVER
  - CAPROVER_APP
  - CAPROVER_APP_TOKEN

### Projektstruktur
```
jvc/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API-Routen (Einladungen, Admin)
│   │   ├── dashboard/    # Haupt-Dashboard
│   │   ├── login/        # Anmeldung
│   │   └── reset-password/ # Passwort zurücksetzen
│   ├── components/       # React-Komponenten
│   │   ├── AdminPanel.tsx    # Admin-Verwaltung
│   │   ├── CalendarView.tsx  # Hauptkalender
│   │   ├── AvailabilityView.tsx # Verfügbarkeitsansicht
│   │   ├── EventModalExtended.tsx # Termin-Bearbeitung
│   │   ├── ExportDialog.tsx  # ICS-Export
│   │   ├── ProfileSettings.tsx # Profil/Urlaube/F-Tage
│   │   └── DashboardClient.tsx # Dashboard-Layout
│   ├── lib/              # Utilities
│   │   └── supabase.ts   # Supabase-Clients (Server/Client)
│   └── types/            # TypeScript-Definitionen
│       └── database.ts   # Generierte DB-Typen
├── supabase/             # Datenbank
│   ├── schema.sql        # Basis-Schema
│   └── migrations/       # Schrittweise Änderungen
├── public/               # Statische Dateien
├── Dockerfile            # Multi-Stage Build
├── captain-definition    # CapRover Deployment
└── .github/workflows/    # CI/CD Pipeline
```

### Bekannte Probleme und Lösungen

#### 1. Tailwind CSS v4 Inkompatibilität
- **Problem**: Build-Fehler mit Tailwind v4
- **Lösung**: Verwende Tailwind CSS v3.4.17

#### 2. TypeScript Supabase Queries
- **Problem**: "Property does not exist on type 'never'"
- **Lösung**: Type Assertion mit `(supabase as any)` bei INSERT mit `.select().single()`

#### 3. Moderator-Berechtigungen
- **Problem**: Moderatoren konnten keine Termine erstellen
- **Lösung**: Migration 003_fix_moderator_permissions.sql ausführen

#### 4. Mehrtägige ganztägige Termine im Export
- **Problem**: Nur erster Tag wurde exportiert
- **Lösung**: ICS benötigt exklusives End-Datum (+1 Tag)

### UI/UX Features

#### Responsive Design
- **Mobile**: Kompakte Navigation mit Hamburger-Menü
- **Tablet**: Optimierte Button-Layouts
- **Desktop**: Volle Funktionalität mit Seitenleisten

#### Farbschema
- **Header**: Anthrazit-grau (#374151)
- **Primärfarbe**: Blau (#3b82f6)
- **Urlaub**: Rot (#ef4444)
- **F-Tag**: Orange (#f97316)
- **Eigene Teilnahme**: Grüner Rahmen (#10b981)

#### Besondere Features
- Termine mit eigener Teilnahme haben visuellen Indikator
- Anzahl der zu exportierenden Termine wird live angezeigt
- Agenda-Ansicht scrollt automatisch zu aktuellem Datum
- Mobile Ansicht nutzt kompakte Bezeichnungen