import { API_BASE } from "./config.js";

let lastSubmitAt = 0;
export async function submitScore(score) {
  const now = Date.now();
  if (now - lastSubmitAt < 2000) return;
  lastSubmitAt = now;

  const initData = Telegram?.WebApp?.initData || "";
  if (!initData) {
    Telegram?.WebApp?.showPopup?.({ message: "Открой игру внутри Telegram" });
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, score: Number(score) || 0 })
    });
    if (!res.ok) throw new Error("bad status" + res.status);
  } catch (e) {
    Telegram?.WebApp?.showPopup?.({ message: "Не удалось сохранить" });
  }
}

export async function loadLeaderboard(limit = 100, offset = 0) {
  const res = await fetch(`${API_BASE}/leaderboard?limit=${limit}&offset=${offset}&_=${Date.now()}`);
  if (!res.ok) throw new Error("bad status" + res.status);
  return res.json();
}
