// Voraussetzung: npx wrangler dev (Port 8787), die Demo-App mit Widget auf Port 8788, ein lokales Admin-Konto (README).
// Ende-zu-Ende-Test: devunox → Kunde anlegen → Kunde gibt im GEO-Tool Feedback → devunox antwortet → Kunde nimmt ab
import pw from "playwright";
const { chromium, devices } = pw;

const HUB = "http://127.0.0.1:8787";
const OUT = new URL("../test-out", import.meta.url).pathname;
const log = (...a) => console.log("•", ...a);
const errors = [];

const browser = await chromium.launch();
const watch = (page, name) => {
  page.on("pageerror", (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name} console: ${m.text()}`); });
  page.on("dialog", (d) => d.accept());
};

// 1) devunox meldet sich mit Einmalpasswort an und setzt eigenes Passwort
const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const a = await admin.newPage(); watch(a, "admin");
await a.goto(HUB + "/");
await a.screenshot({ path: `${OUT}/01-login.png` });
await a.fill('input[name=email]', "hyigit@outlook.de");
await a.fill('input[name=password]', "Start-Passwort-123");
await a.click("button.primary");
await a.waitForSelector('form[data-form=password]');
await a.fill('input[name=current]', "Start-Passwort-123");
await a.fill('input[name=next]', "Mein-neues-Passwort-1");
await a.fill('input[name=next2]', "Mein-neues-Passwort-1");
await a.click("button.primary");
await a.waitForSelector(".pagehead h1");
log("Admin angemeldet:", await a.textContent(".pagehead h1"));
await a.screenshot({ path: `${OUT}/02-projekte-leer.png` });

// 2) Kunde + erstes Projekt anlegen
await a.click('[data-act=new-client]');
await a.fill('dialog input[name=name]', "Muster Glasfaser GmbH");
await a.fill('dialog input[name=contact_name]', "Anna Berger");
await a.fill('dialog input[name=contact_email]', "anna@muster-glasfaser.de");
await a.fill('dialog input[name=project_name]', "GeoAuftrag");
await a.fill('dialog input[name=app_url]', "http://127.0.0.1:8788/index.html");
await a.fill('dialog input[name=repo_url]', "https://github.com/HYigit19/geoauftrag");
await a.screenshot({ path: `${OUT}/03-kunde-anlegen.png` });
await a.click('dialog button.primary');
await a.waitForSelector("dialog .copy code");
const invite = await a.textContent("dialog .copy code");
log("Einladungslink:", invite);
await a.screenshot({ path: `${OUT}/04-einladungslink.png` });
await a.click('dialog [data-act=close-modal]');

// 3) Kunde nimmt Einladung an
const client = await browser.newContext({ viewport: { width: 1366, height: 860 } });
const c = await client.newPage(); watch(c, "kunde");
await c.goto(invite.replace(/^https?:\/\/[^/]+/, HUB));
await c.waitForSelector('form[data-form=link]');
await c.fill('input[name=password]', "Anna-Passwort-2026");
await c.fill('input[name=password2]', "Anna-Passwort-2026");
await c.click("button.primary");
await c.waitForSelector(".pagehead h1");
log("Kunde sieht:", await c.textContent(".pagehead h1"));
await c.screenshot({ path: `${OUT}/05-kunde-projekt-leer.png` });

// 4) Kunde öffnet die App mit Feedback
const [app] = await Promise.all([client.waitForEvent("page"), c.click('[data-act=open-app]')]);
watch(app, "app");
await app.waitForLoadState("load");
await app.waitForSelector("dvx-review", { state: "attached", timeout: 10000 });
log("App-Adresse nach Übergabe:", app.url());
await app.waitForTimeout(800);
await app.screenshot({ path: `${OUT}/06-app-mit-widget.png` });

const sh = (sel) => app.locator(`dvx-review >> ${sel}`);
await sh(".launcher").click();
await app.waitForTimeout(300);
await app.screenshot({ path: `${OUT}/07-panel-leer.png` });
await sh("[data-act=place]").click();
await app.waitForTimeout(200);
await app.screenshot({ path: `${OUT}/08-pin-modus.png` });
// Auf eine Kachel/Überschrift im Inhalt klicken
const target = app.locator("#center h1").first();
const box = await target.boundingBox();
log("Ziel:", await target.textContent(), box);
await app.mouse.click(box.x + box.width * 0.3, box.y + box.height / 2);
await app.waitForTimeout(300);
await sh(".composer textarea").fill("Die Überschrift ist mir zu klein. Bitte größer und in unserem Firmenblau.\nAußerdem fehlt das Logo oben links.");
await sh('.composer label:has(input[value=design])').click();
await sh(".composer select[name=priority]").selectOption("hoch");
await sh('.composer input[type=file]').setInputFiles(`${OUT}/notiz.txt`);
await app.waitForTimeout(400);
await app.screenshot({ path: `${OUT}/09-kommentar-schreiben.png` });
await sh(".composer button.primary").click();
await sh(".panel .item").waitFor({ timeout: 20000 });
await app.waitForTimeout(800);
await app.screenshot({ path: `${OUT}/10-feedback-gesendet.png` });
log("Panel nach Senden:", (await sh(".panel h3").textContent()).slice(0, 60));

// zweiter Pin auf einer anderen Seite (Hash-Route)
await sh("[data-act=back]").click();
await app.evaluate(() => { location.hash = "#auftraege"; });
await app.waitForTimeout(600);
await sh("[data-act=place]").click();
const t2 = app.locator("#center").locator("button, a, .card, tr").nth(3);
const b2 = await t2.boundingBox();
await app.mouse.click(b2.x + 10, b2.y + b2.height / 2);
await sh(".composer textarea").fill("Hier fehlt eine Spalte für den Auftraggeber.");
await sh('.composer label:has(input[value=funktion])').click();
await sh(".composer button.primary").click();
await sh(".panel .item").waitFor({ timeout: 20000 });
await sh("[data-act=back]").click();
await sh('[data-act=tab][data-tab=all]').click();
await app.waitForTimeout(300);
await app.screenshot({ path: `${OUT}/11-liste-alle.png` });

// 5) devunox sieht das Board
await a.goto(HUB + "/#/p/geoauftrag");
await a.waitForSelector(".board .card");
await a.waitForTimeout(800);
await a.screenshot({ path: `${OUT}/12-board-admin.png` });
await a.click('.board .card:has(.ct .pin:text-is("1"))');
await a.waitForSelector(".drawer h2");
await a.waitForTimeout(500);
await a.screenshot({ path: `${OUT}/13-detail-admin.png` });
await a.fill('form[data-form=reply] textarea', "Danke! Wir haben die Überschrift vergrößert und das Logo ergänzt. Bitte einmal prüfen.");
await a.setInputFiles('form[data-form=reply] input[type=file]', `${OUT}/notiz.txt`);
await a.click('form[data-form=reply] button.primary');
await a.waitForSelector(".thread .msg");
await a.selectOption('select[data-patch=status]', "pruefen");
await a.waitForSelector(".thread .ev");
await a.waitForTimeout(400);
await a.screenshot({ path: `${OUT}/14-antwort-status.png` });
// interne Aufgabe
await a.click('[data-act=close-drawer]');
await a.click('[data-act=new-task]');
await a.fill('dialog input[name=title]', "Logo-Datei beim Kunden anfragen");
await a.click('dialog button.primary');
await a.waitForTimeout(500);
await a.screenshot({ path: `${OUT}/15-board-mit-aufgabe.png` });

// 6) Kunde sieht Antwort im Widget und nimmt ab
await app.evaluate(() => { location.hash = "#start"; });
await app.reload();
await app.waitForSelector("dvx-review", { state: "attached" });
await app.waitForTimeout(800);
await sh(".launcher").click();
await app.waitForTimeout(400);
await app.screenshot({ path: `${OUT}/16-kunde-widget-ungelesen.png` });
await sh('.list .row:has(.pinno:text-is("1"))').click();
await sh("[data-act=approve]").waitFor();
await app.waitForTimeout(400);
await app.screenshot({ path: `${OUT}/17-kunde-pruefen.png` });
await sh("[data-act=approve]").click();
await app.waitForTimeout(600);
log("Status nach Abnahme:", await sh(".chips .chip").first().textContent());

// Kunde darf interne Aufgabe nicht sehen
const vis = await c.evaluate(async () => (await (await fetch("/api/projects/geoauftrag/items")).json()).items.map((i) => i.title));
log("Kunde sieht Einträge:", vis);

// 7) Handy-Ansicht
const phone = await browser.newContext({ ...devices["iPhone 13"] });
const m = await phone.newPage(); watch(m, "handy");
await m.goto(HUB + "/");
await m.fill('input[name=email]', "anna@muster-glasfaser.de");
await m.fill('input[name=password]', "Anna-Passwort-2026");
await m.click("button.primary");
await m.waitForSelector(".board, .empty");
await m.waitForTimeout(500);
await m.screenshot({ path: `${OUT}/18-handy-board.png` });
const [mapp] = await Promise.all([phone.waitForEvent("page"), m.click('[data-act=open-app]')]);
watch(mapp, "handy-app");
await mapp.waitForSelector("dvx-review", { state: "attached", timeout: 10000 });
await mapp.waitForTimeout(800);
const ms = (sel) => mapp.locator(`dvx-review >> ${sel}`);
await ms(".launcher").click();
await mapp.waitForTimeout(300);
await mapp.screenshot({ path: `${OUT}/19-handy-panel.png` });
await ms("[data-act=place]").click();
await mapp.touchscreen.tap(200, 300);
await mapp.waitForTimeout(400);
await ms(".composer textarea").fill("Am Handy ist der Button zu nah am Rand.");
await mapp.screenshot({ path: `${OUT}/20-handy-kommentar.png` });
await ms(".composer button.primary").click();
await ms(".panel .item").waitFor({ timeout: 20000 });
await mapp.waitForTimeout(500);
await mapp.screenshot({ path: `${OUT}/21-handy-gesendet.png` });
await ms("[data-act=close]").click();
await mapp.waitForTimeout(300);
await mapp.screenshot({ path: `${OUT}/22-handy-pins.png` });

// Zugriffsschutz: fremdes Projekt / ohne Token
const other = await (await fetch(HUB + "/api/projects/geoauftrag/items")).status;
log("Ohne Anmeldung:", other);

await a.goto(HUB + "/#/p/geoauftrag");
await a.waitForSelector(".board .card");
await a.waitForTimeout(800);
await a.screenshot({ path: `${OUT}/23-board-ende.png` });
await a.click('[data-act=view][data-view=list]');
await a.screenshot({ path: `${OUT}/24-liste.png` });

console.log("\nFehler:", errors.length ? errors : "keine");
await browser.close();
