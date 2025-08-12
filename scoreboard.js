import { loadLeaderboard, submitScore } from "./api.js";

function escapeHTML(str = "") {
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

async function renderBoard(limit = 100, offset = 0) {
  const tbody = document.getElementById('records');
  const table = document.getElementById('recordsTable');
  const empty = document.getElementById('empty');
  const loading = document.getElementById('loading');
  try {
    loading.style.display = 'block';
    table.style.display = 'none';
    empty.style.display = 'none';
    const { items } = await loadLeaderboard(limit, offset);
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
        scoreTd.textContent = item.score;
        tr.append(pos, nameTd, scoreTd);
        tbody.appendChild(tr);
      });
      table.style.display = 'table';
    } else {
      empty.style.display = 'block';
    }
  } catch (e) {
    empty.textContent = 'Не удалось загрузить рекорды';
    empty.style.display = 'block';
  } finally {
    loading.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const lastKnownScore = localStorage.getItem('lastKnownScore');
  submitScore(lastKnownScore ?? 0);
  renderBoard();
});
