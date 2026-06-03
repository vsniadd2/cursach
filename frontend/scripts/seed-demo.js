/* eslint-disable no-console */

/**
 * Заполнение БД демо-данными: 6 пользователей, клиенты, сделки (Lead/Negotiation/Closed), задачи.
 *
 * Использование:
 *   node scripts/seed-demo.js
 *   node scripts/seed-demo.js --force-crm   # пересоздать CRM-данные, если уже есть
 *
 * API: POST /seed/demo  (логин admin / 123456)
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5278';
const USERNAME = process.env.SEED_USERNAME || 'admin';
const PASSWORD = process.env.SEED_PASSWORD || '123456';

const TEAM = [
  { username: 'admin', password: '123456', fullName: 'Иван Петров', role: 'Admin' },
  { username: 'maria', password: '123456', fullName: 'Мария Козлова', role: 'Member' },
  { username: 'dmitry', password: '123456', fullName: 'Дмитрий Волков', role: 'Member' },
  { username: 'elena', password: '123456', fullName: 'Елена Морозова', role: 'Member' },
  { username: 'alexey', password: '123456', fullName: 'Алексей Новиков', role: 'Member' },
  { username: 'natalia', password: '123456', fullName: 'Наталья Сидорова', role: 'Member' },
];

async function postJson(path, body, accessToken) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : '{}',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Seed failed: ${path} -> HTTP ${res.status} ${text}`);
  }

  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? await res.json() : null;
}

async function main() {
  const forceCrm = process.argv.includes('--force-crm');
  const query = forceCrm ? '?forceCrm=true' : '';

  console.log(`API: ${API_BASE_URL}`);
  console.log(`Login: ${USERNAME}`);

  const login = await postJson('/auth/login', { username: USERNAME, password: PASSWORD });
  const accessToken = login?.accessToken;
  if (!accessToken) {
    throw new Error('Seed failed: no accessToken from /auth/login');
  }

  const result = await postJson(`/seed/demo${query}`, {}, accessToken);

  console.log('');
  if (result.crmSeeded) {
    console.log(`CRM seeded: ${result.clients} clients, ${result.deals} deals, ${result.tasks} tasks.`);
  } else if (result.crmSkipped) {
    console.log('CRM data already exists — skipped (use --force-crm to replace).');
  }
  console.log(`Team users ensured: ${result.usersUpserted}.`);
  console.log('');
  console.log('Accounts (password 123456 for all):');
  for (const u of TEAM) {
    console.log(`  ${u.username.padEnd(8)} — ${u.fullName} (${u.role})`);
  }
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exitCode = 1;
});
