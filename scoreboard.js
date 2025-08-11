import { API_BASE } from "./config.js";

async function loadLeaderboard(limit = 100, offset = 0) {
  const tbody = document.getElementById('records');
  const table = document.getElementById('recordsTable');
  const empty = document.getElementById('empty');
  const loading = document.getElementById('loading');
  try {
    loading.style.display = 'block';
    table.style.display = 'none';
    empty.style.display = 'none';
    const res = await fetch(`${API_BASE}/leaderboard?limit=${limit}&offset=${offset}`);
    const { items } = await res.json();
    tbody.innerHTML = '';
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((r, i) => {
        const tr = document.createElement('tr');
        const pos = document.createElement('td');
        pos.className = 'pos';
        pos.textContent = i + 1 + offset;
        const nameTd = document.createElement('td');
        nameTd.className = 'name';
        const display = r.display_name || '';
        if (r.username) {
          const a = document.createElement('a');
          a.href = `https://t.me/${r.username}`;
          a.textContent = display;
          a.target = '_blank';
          nameTd.appendChild(a);
        } else {
          nameTd.textContent = display;
        }
        const scoreTd = document.createElement('td');
        scoreTd.className = 'score';
        scoreTd.textContent = r.score;
        tr.append(pos, nameTd, scoreTd);
        tbody.appendChild(tr);
      });
      table.style.display = 'table';
    } else {
      empty.style.display = 'block';
    }
  } catch (e) {
    console.error('loadLeaderboard error', e);
    empty.textContent = 'Не удалось загрузить рекорды';
    empty.style.display = 'block';
  } finally {
    loading.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('apiBase').textContent = API_BASE;
  loadLeaderboard();
});
