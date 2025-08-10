# Bugman — Telegram Mini App (Static)

Файлы:
- `index.html` — страница
- `style.css` — стили
- `game.js` — логика игры (без внешних ассетов)

Деплой на GitHub Pages:
1) Создай репозиторий и залей эти три файла в корень ветки `main`.
2) Settings → Pages → Source: `Deploy from a branch`. Branch: `main` / `(root)`. Save.
3) Через ~1–2 минуты сайт будет по адресу:
   `https://<логин>.github.io/<имя-репозитория>/`

Подключение к Telegram Mini App:
- В `index.html` уже подключён Telegram WebApp SDK и базовая инициализация.
- В @BotFather добавь Web App и укажи URL с GitHub Pages.
