(async function(){
  const tbody = document.getElementById('records');
  let records = [];

  // сначала пытаемся получить данные с сервера (если он настроен)
  try {
    const resp = await fetch('api/records');
    if (resp.ok) {
      records = await resp.json();
    }
  } catch(_){ }

  // если сервер недоступен, используем локальное хранилище
  if (!Array.isArray(records) || records.length===0){
    try {
      records = JSON.parse(localStorage.getItem('records')) || [];
    } catch(_){ records = []; }
  }

  // сортируем по убыванию и берём только топ-20
  records.sort((a,b)=>b.score-a.score);
  records.slice(0,20).forEach((r,i)=>{
    const tr = document.createElement('tr');
    const name = r.username || r.name || r.first_name || r.player || '';
    tr.innerHTML = `<td class="pos">${i+1}</td><td class="name">${name}</td><td class="score">${r.score}</td>`;
    tbody.appendChild(tr);
  });
})();

