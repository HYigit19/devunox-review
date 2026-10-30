// Mehrere Pins hintereinander, Pin versetzen, Esc. Voraussetzung wie e2e.mjs (Kunde aus e2e.mjs muss existieren).
import pw from "playwright";
const { chromium } = pw;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
await p.goto("http://127.0.0.1:8788/index.html?feedback#start");
const sh = s => p.locator("dvx-review >> " + s);
await sh('input[name=email]').fill("anna@muster-glasfaser.de");
await sh('input[name=password]').fill("Anna-Passwort-2026");
await sh('form[data-form=login] button').click();
await sh(".tools [data-act=place]").waitFor();
await sh("[data-act=close]").click();
const pins = async () => await sh(".layer .pin").count();
const n0 = await pins(); console.log("Pins am Anfang:", n0);
await p.screenshot({ path: "test-out/q0-dock.png" });
for (let k = 1; k <= 3; k++) {
  await sh(".pinbtn").click();
  console.log(k, "im Setz-Modus sichtbare Pins:", await pins());
  await p.mouse.click(500 + k * 120, 420 + k * 40);
  await sh(".composer textarea").fill("Mehrfach-Test " + k);
  if (k === 2) {
    const before = await sh('.layer .pin[data-key=draft]').getAttribute("style");
    await p.mouse.click(300, 650);   // versetzen
    await p.waitForTimeout(200);
    const after = await sh('.layer .pin[data-key=draft]').getAttribute("style");
    console.log("Versetzt?", before !== after, "Text erhalten?", await sh(".composer textarea").inputValue());
    await p.screenshot({ path: "test-out/q2-versetzt.png" });
  }
  await sh(".composer button.primary").click();
  await sh(".panel .item").waitFor({ timeout: 30000 });
  await p.waitForTimeout(300);
}
await sh("[data-act=close]").click();
await p.waitForTimeout(500);
console.log("Pins am Ende:", await pins(), "(erwartet", n0 + 3, ")");
// Esc im Composer bricht ab und App reagiert nicht
await sh(".pinbtn").click(); await p.mouse.click(800, 300);
await sh(".composer textarea").press("Escape"); await p.waitForTimeout(200);
console.log("Composer nach Esc weg?", (await sh(".composer").count()) === 0);
await p.screenshot({ path: "test-out/q3-ende.png" });
console.log("Errors:", errs);
await b.close();
