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

### Benutzerrollen

- **Normal**: Kann eigene Urlaube/F-Tage verwalten, Termine einsehen
- **Moderator**: Zusätzlich Termine erstellen/bearbeiten
- **Administrator**: Vollzugriff, Benutzerverwaltung, Einladungen

### Hauptfunktionen

1. **Terminkalender**
   - Monats-/Wochen-/Tagesansicht
   - Farbcodierung nach Typ
   - Schnelle Terminerfassung

2. **Verfügbarkeitsübersicht**
   - Overlay mit Urlaubs-/F-Tagen
   - Farbliche Markierung verfügbarer Personen
   - Konfliktanzeige bei Überschneidungen

3. **Export-Funktion**
   - Zeitraum wählbar
   - ICS-Format (iPhone/Mac kompatibel)
   - Nur Termine (keine privaten Daten)

4. **Admin-Panel**
   - Benutzerübersicht
   - Einladungen versenden
   - Rollenverwaltung

### Installierte Pakete
- next@15.5.3
- react@19.1.1
- typescript@5.9.2
- tailwindcss@4.1.13
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
✅ Export-Funktion erstellt (ICS-Format)
✅ Deployment-Setup konfiguriert

### Wichtige SQL-Befehle für Supabase
Das Schema in `supabase/schema.sql` muss im Supabase SQL-Editor ausgeführt werden:
1. Gehe zu https://supabase.com/dashboard/project/fqztbqxcmlgezxmmrqjh/sql
2. Füge den Inhalt von `supabase/schema.sql` ein
3. Führe das Skript aus

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
- Füge Umgebungsvariablen hinzu (aus .env.local)
- Konfiguriere GitHub Secrets:
  - CAPROVER_SERVER
  - CAPROVER_APP
  - CAPROVER_APP_TOKEN

### Projektstruktur
```
jvc/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API-Routen
│   │   ├── dashboard/    # Dashboard-Seite
│   │   └── login/        # Login-Seite
│   ├── components/       # React-Komponenten
│   ├── lib/             # Supabase-Clients
│   └── types/           # TypeScript-Typen
├── supabase/            # Datenbankschema
├── Dockerfile           # Docker-Konfiguration
├── captain-definition   # CapRover-Config
└── .github/workflows/   # GitHub Actions
```