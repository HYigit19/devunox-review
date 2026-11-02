# devunox Review

Entwickelt von **devunoxAI** – KI-Automatisierung, Websites, Web-Apps und Dashboards: [www.devunox.ai](https://www.devunox.ai)

Feedback-Tool für Kunden-Apps: Kunden setzen **Pins direkt in der laufenden App**, schreiben einen Kommentar, hängen Bilder und Dokumente an. devunox antwortet, setzt den Status, und der Kunde nimmt die Umsetzung ab.

Adresse: **https://project.review.devunox.ai**

| Teil | Wo | Was |
|---|---|---|
| Review-Portal | `public/index.html`, `app.js`, `app.css` | Projekte, Board/Liste, Detail mit Verlauf, Kunden, Konto (DE/EN) |
| Widget | `public/widget.js` | wird per `<script>` in die Kunden-App eingebunden |
| API | `src/` (Cloudflare Worker) | Login, Rechte, Feedback, Antworten, Dateien |
| Daten | D1 `devunox-review-db` (Westeuropa) | Kunden, Projekte, Feedback, Antworten |
| Dateien | R2 `devunox-review-dateien` (Jurisdiktion **EU**) | Screenshots und Anhänge, nicht öffentlich |

## So funktioniert es

1. **devunox legt einen Kunden an** (Portal → Kunden → Neuer Kunde). Pro Kunde gibt es **genau eine Person**, die kommentiert. Sie bekommt einen **Einladungslink** (14 Tage, einmalig) und legt damit ihr Passwort fest.
2. **Projekt anlegen**: Name, Adresse der deployten App, GitHub-Repo. Unter *Einstellungen* steht der Code-Schnipsel für die App.
3. **Widget in die App einbauen** – eine Zeile vor `</body>`:
   ```html
   <script src="https://project.review.devunox.ai/widget.js" data-project="geoauftrag" defer></script>
   ```
   Normale Besucher sehen nichts. Das Widget erscheint nur mit Feedback-Zugang.
4. **Kunde klickt im Portal auf „App öffnen und kommentieren“.** Die App öffnet sich mit einem Einmal-Link, das Widget meldet ihn automatisch an (30 Tage im Browser gemerkt). Alternativ: App-Adresse mit `?feedback` öffnen und im Widget anmelden.
5. Im Widget: **„Pin setzen“** → auf die Stelle tippen → Kommentar, Art (Fehler/Design/Funktion/Text/Idee), Wichtigkeit, Anhänge. Ein **Screenshot** des sichtbaren Bereichs mit Markierung wird automatisch mitgeschickt.
6. **devunox** sieht alles im Board (Offen → In Arbeit → Bitte prüfen → Erledigt), antwortet, hängt Dateien an, legt eigene (auch interne) Aufgaben an.
7. Steht ein Punkt auf **„Bitte prüfen“**, kann der Kunde **„Passt so – erledigt“** oder **„Noch nicht in Ordnung“** (mit Begründung) wählen.

Bei neuem Feedback oder Antworten des Kunden kommt eine Mail an `hyigit@outlook.de` (Cloudflare Email Routing, Absender `review@devunox.ai`). Kunden sehen Neues im Portal und im Widget (blauer Punkt).

## Anbindung devunox CRM

Neues Kunden-Feedback, Kundenantworten und Statuswechsel gehen per signiertem Webhook an das devunox CRM (`CRM_WEBHOOK_URL`, Standard `https://crm.devunox.ai/hooks/review`). Dort werden sie automatisch zu Aufgaben im passenden Projekt. Statusänderungen aus dem CRM kommen über `POST /api/integrations/crm/status` zurück.
- **Einrichtung:** Das Secret `CRM_WEBHOOK_SECRET` im Worker setzen. Es muss derselbe Wert sein wie `REVIEW_WEBHOOK_SECRET` im CRM. Ohne Secret ist die Anbindung aus.
- **Sicherheit:** HMAC-SHA256 über Zeitstempel und Inhalt, 5 Minuten gültig. Interne Aufgaben werden nie gesendet.

## Rechte

- **Kunde**: sieht nur die Projekte seiner Firma, keine internen Aufgaben. Darf eigenes Feedback bearbeiten/löschen, solange es offen ist und niemand geantwortet hat. Status nur: abnehmen oder wieder öffnen.
- **devunox (admin)**: alles.
- Widget-Sitzungen gelten nur für das eine Projekt, für das sie erzeugt wurden.

## Sicherheit

- Passwörter PBKDF2-SHA256 (100 000 Runden), Sperre nach 5 Fehlversuchen (15 Min.), Bremse je IP.
- Portal: HttpOnly-/Secure-Cookie, Origin-Prüfung bei Änderungen, strenge Content-Security-Policy (`public/_headers`).
- Widget: Bearer-Token (fremde Domain), in D1 liegt nur der SHA-256.
- Dateien nur über signierte, kurzlebige Links (`/f/<id>?e=…&s=…`), Auslieferung mit Sandbox-CSP.

## Deployment (Cloudflare Workers Builds)

Einmalig im Cloudflare-Dashboard:

1. **Workers & Pages → Create → Import a repository → `HYigit19/devunox-review`**. Build-Befehl leer lassen, Deploy-Befehl `npx wrangler deploy` (Standard).
   Beim ersten Deployment wird der R2-Bucket `devunox-review-dateien` (EU) automatisch angelegt. Falls das Build-Log einen Fehler zum Bucket zeigt: unter R2 → *Create bucket* → Name `devunox-review-dateien`, *Location: Specify jurisdiction → EU*, dann erneut deployen.
2. Worker `devunox-review` → **Settings → Domains & Routes → Add → Custom Domain → `project.review.devunox.ai`**.

Danach deployt jeder Push auf `main` automatisch. Die Tabellen legt der Worker beim ersten Aufruf selbst an (`src/schema.js`).

### devunox-Konto anlegen

```bash
node scripts/create-admin.mjs "Name" mail@beispiel.de   # gibt SQL + Einmalpasswort aus
npx wrangler d1 execute devunox-review-db --remote --command "<SQL>"
```
Beim ersten Login muss ein eigenes Passwort gesetzt werden.

## Lokal entwickeln

```bash
npm install
npx wrangler dev                      # http://127.0.0.1:8787
node scripts/create-admin.mjs "Test" test@example.com Test-Passwort-1 > /tmp/a.sql
npx wrangler d1 execute devunox-review-db --local --file /tmp/a.sql
```
Hinweis: `wrangler dev` schreibt Links (Einladung) mit der Produktiv-Domain – lokal den Host durch `127.0.0.1:8787` ersetzen.

## Geplant (Phase 2/3)

- Feedback ↔ GitHub-Issues im Kunden-Repo synchronisieren, Status zurückmelden
- Feedback-Runden mit Stichtag, Abnahmeprotokoll als PDF
- Umsetzung offener Punkte durch Claude direkt im Kunden-Repo
