// prod-адрес API
let API_BASE = "https://bugman-bot.onrender.com";
// Для отладки разреши переопределение через глобал:
if (typeof window !== 'undefined' && window.API_BASE_OVERRIDE) {
  // например, window.API_BASE_OVERRIDE = "http://localhost:8080"
  // перед подключением скриптов
  API_BASE = window.API_BASE_OVERRIDE;
}
export { API_BASE };
