/* eslint-disable no-console */

/** Захардкожено для учебного проекта (см. SeedUser в backend/appsettings). */
const API_BASE_URL = 'http://localhost:5278';
const USERNAME = 'ivan';
const PASSWORD = '123456';

async function postJson(path, body, accessToken) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Seed failed: ${path} -> HTTP ${res.status} ${text}`);
  }

  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? await res.json() : null;
}

async function main() {
  const login = await postJson('/auth/login', { username: USERNAME, password: PASSWORD });
  const accessToken = login?.accessToken;
  if (!accessToken) {
    throw new Error('Seed failed: no accessToken from /auth/login');
  }

  const result = await postJson('/seed/run', {}, accessToken);
  const seeded = !!result?.seeded;
  console.log(seeded ? 'Seed: inserted demo data into DB.' : 'Seed: DB already has data, skipped.');
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exitCode = 1;
});
