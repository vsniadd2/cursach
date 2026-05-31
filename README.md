# cursach

Клиент-серверное CRM-приложение «Экспого»: React Native (Expo) + ASP.NET Core + PostgreSQL.

## Запуск

```bash
docker compose up -d --build
cd frontend
npm install
npm start
```

API: http://localhost:5278

Все настройки (БД, JWT, seed-пользователь) захардкожены в `appsettings*.json` и `frontend/scripts/seed.js`. Файлов `.env` в проекте нет.

Подробнее — в `start/start.txt`.
