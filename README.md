# cursach

Клиент-серверное CRM-приложение **CRM.go**: React Native (Expo) + ASP.NET Core + PostgreSQL.

## Запуск

```bash
docker compose up -d --build
cd frontend
npm install
npm start
```

API: http://localhost:5278

## Учётные записи по умолчанию

| Логин | Пароль | Роль |
|-------|--------|------|
| `admin` | `123456` | Администратор |
| `user` | `123456` | Пользователь |

Все пользователи в одной организации. Новая регистрация создаёт обычного пользователя.

Настройки (БД, JWT, seed) — в `appsettings*.json` и `frontend/scripts/seed.js`.

Подробнее — в `start/start.txt`.
