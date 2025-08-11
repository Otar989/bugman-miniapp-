# Bugman — Telegram Mini App (Static)

Файлы:
- `index.html` — страница
- `style.css` — стили
- `game.js` — логика игры (без внешних ассетов)

## Конфиг API

Базовый адрес API задаётся в `config.js` (по умолчанию `https://bugman-bot.onrender.com`).
Для отладки можно переопределить глобальной переменной `API_BASE_OVERRIDE` перед подключением скриптов.

## Проверка работы API

1. Сыграйте партию — после завершения очки отправятся POST-запросом на `${API_BASE}/score`.
2. Откройте «Рекорды» — список загрузится с `${API_BASE}/leaderboard`.
3. Можно напрямую запросить `GET ${API_BASE}/leaderboard` и увидеть JSON со списком рекордов.

Деплой на GitHub Pages:
1) Создай репозиторий и залей эти три файла в корень ветки `main`.
2) Settings → Pages → Source: `Deploy from a branch`. Branch: `main` / `(root)`. Save.
3) Через ~1–2 минуты сайт будет по адресу:
   `https://<логин>.github.io/<имя-репозитория>/`

Подключение к Telegram Mini App:
- В `index.html` уже подключён Telegram WebApp SDK и базовая инициализация.
- В @BotFather добавь Web App и укажи URL с GitHub Pages.
