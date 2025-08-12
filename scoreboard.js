import { API_BASE } from "./config.js";
import { submitScore, toast } from "./api.js";

function escapeHTML(str = "") {
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

const tbody = document.getElementById('records');
const table = document.getElementById('recordsTable');
const empty = document.getElementById('empty');
const loading = document.getElementById('loading');

function renderTable(items, offset = 0) {
  tbody.innerHTML = '';
  if (Array.isArray(items) && items.length > 0) {
    items.forEach((item, i) => {
      const tr = document.createElement('tr');
      const pos = document.createElement('td');
      pos.className = 'pos';
      pos.textContent = i + 1 + offset;
      const nameTd = document.createElement('td');
      nameTd.className = 'name';
      const name = item.display_name || item.username || 'Player';
      if (item.username) {
        const a = document.createElement('a');
        a.href = `https://t.me/${item.username}`;
        a.target = '_blank';
        a.rel = 'noopener';
        a.innerHTML = escapeHTML(name);
        nameTd.appendChild(a);
      } else {
        nameTd.innerHTML = escapeHTML(name);
      }
      const scoreTd = document.createElement('td');
      scoreTd.className = 'score';
      scoreTd.textContent = item.best_score;
      tr.append(pos, nameTd, scoreTd);
      tbody.appendChild(tr);
    });
    table.style.display = 'table';
    empty.style.display = 'none';
  } else {
    table.style.display = 'none';
    empty.style.display = 'block';
  }
}

export async function loadLeaderboard(limit = 100, offset = 0) {
  loading.style.display = 'block';
  table.style.display = 'none';
  empty.style.display = 'none';
  try {
    const res = await fetch(`${API_BASE}/leaderboard?limit=${limit}&offset=${offset}&_=${Date.now()}`, { mode: 'cors' });
    const data = await res.json();
    const items = (data && data.items) || [];
    renderTable(items, offset);
  } catch (e) {
    toast('Не удалось загрузить рекорды');
    renderTable([], offset);
  } finally {
    loading.style.display = 'none';
  }
}

let submitted = false;
function ensurePlayer() {
  if (submitted) return;
  submitted = true;
  const lastKnownScore = localStorage.getItem('lastKnownScore');
  submitScore(lastKnownScore ?? 0);
}

document.addEventListener('DOMContentLoaded', () => {
  ensurePlayer();
  loadLeaderboard();
});

