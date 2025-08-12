import { API_BASE } from "./config.js";

function toast(message) {
  try {
    Telegram?.WebApp?.showPopup?.({ message: String(message) });
  } catch (_) {
    // fallback for non-Telegram environments
    console.log(message);
  }
}

let lastSubmitAt = 0;
let devVerified = false;

async function verifyInitData(initData) {
  if (!globalThis.window?.DEBUG || devVerified) return;
  devVerified = true;
  try {
    const res = await fetch(`${API_BASE}/debug/verify`, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData })
    });
    const data = await res.json();
    console.log("initData verify:", data);
  } catch (e) {
    console.warn("initData verify failed", e);
  }
}
export async function submitScore(score) {
  const initData = Telegram?.WebApp?.initData || "";
  if (!initData) {
    toast("Откройте игру внутри Telegram");
    return;
  }
  await verifyInitData(initData);
  const now = Date.now();
  if (now - lastSubmitAt < 2000) return;
  lastSubmitAt = now;
  try {
    const res = await fetch(`${API_BASE}/score`, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, score: Number(score) || 0 })
    });
    const data = await res.json();
    if (!res.ok || data?.ok === false) {
      const reason = data?.reason || data?.error || `HTTP ${res.status}`;
      toast(`Не удалось сохранить: ${reason}`);
      return;
    }
    // toast("Очки сохранены");
  } catch (e) {
    toast("Не удалось сохранить: сеть/сервер");
    console.error(e);
  }
}

export { toast };

