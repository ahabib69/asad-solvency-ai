// One-command setup:  npm run setup
// Creates .env (if missing), asks for your OpenAI key, and verifies it works.
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const envPath = root + '.env';
const examplePath = root + '.env.example';

if (!fs.existsSync(envPath)) fs.copyFileSync(examplePath, envPath);
let env = fs.readFileSync(envPath, 'utf8');
const current = /^OPENAI_API_KEY=(.*)$/m.exec(env)?.[1]?.trim();

let key = process.argv[2] || '';
if (!key && !current) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  key = (await rl.question('\nPaste your OPENAI_API_KEY (sk-...): ')).trim();
  rl.close();
}
if (key) {
  env = /^OPENAI_API_KEY=.*$/m.test(env)
    ? env.replace(/^OPENAI_API_KEY=.*$/m, `OPENAI_API_KEY=${key}`)
    : env + `\nOPENAI_API_KEY=${key}\n`;
  fs.writeFileSync(envPath, env);
  console.log('✅ Saved key to .env');
}

const finalKey = key || current;
if (!finalKey) { console.log('⚠️  No key set. Run again: npm run setup'); process.exit(1); }

try {
  const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${finalKey}` } });
  console.log(r.ok ? '✅ Key works — OpenAI accepted it.' : `⚠️  OpenAI rejected the key (HTTP ${r.status}). Check it and run npm run setup again.`);
} catch (e) {
  console.log('⚠️  Could not reach OpenAI to verify:', e.message);
}
console.log('\nNext: npm run dev   →  http://localhost:5173\n');
