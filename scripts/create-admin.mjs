// Erzeugt das SQL für ein devunox-Konto mit Einmalpasswort (muss beim ersten Login geändert werden).
// Aufruf: node scripts/create-admin.mjs "Name" mail@beispiel.de [Einmalpasswort]
import { pbkdf2Sync, randomBytes } from "node:crypto";
const [name, email, pw = randomBytes(9).toString("base64url")] = process.argv.slice(2);
if (!name || !email) { console.error('node scripts/create-admin.mjs "Name" mail@beispiel.de [Passwort]'); process.exit(1); }
const b64u = (b) => Buffer.from(b).toString("base64url");
const salt = randomBytes(16);
const hash = `pbkdf2-sha256$100000$${b64u(salt)}$${b64u(pbkdf2Sync(pw, salt, 100000, 32, "sha256"))}`;
const now = new Date().toISOString();
const exp = new Date(Date.now() + 7 * 86400000).toISOString();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
console.log(`-- Einmalpasswort: ${pw}`);
console.log(`INSERT INTO users (email, name, role, password_hash, must_change, temp_expires_at, lang, created_at) VALUES (${q(email)}, ${q(name)}, 'admin', ${q(hash)}, 1, ${q(exp)}, 'de', ${q(now)});`);
