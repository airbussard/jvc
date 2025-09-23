# CapRover Umgebungsvariablen

Diese Umgebungsvariablen müssen in CapRover unter App Configs → Environmental Variables hinzugefügt werden:

## Erforderliche Variablen

```
NEXT_PUBLIC_SUPABASE_URL=https://fqztbqxcmlgezxmmrqjh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxenRicXhjbWxnZXp4bW1ycWpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MjYzMjUsImV4cCI6MjA3NDIwMjMyNX0.6yYEoxsehaYnD3wP1Mbv8K6Z3A9bTFHtIzfWC2Iqxug
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxenRicXhjbWxnZXp4bW1ycWpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODYyNjMyNSwiZXhwIjoyMDc0MjAyMzI1fQ.ug-qv3G9KRB_dyeKsvTxdPYBGnr-E3f1YJtrXVybq8o
```

## Hinweise

1. Diese Variablen müssen BEVOR dem Deployment gesetzt werden
2. Nach dem Setzen der Variablen die App neu deployen
3. Die Service Role Key wird nur für Admin-Funktionen benötigt (User-Einladungen)