(function(){
  try {
    Telegram?.WebApp?.ready?.();
    Telegram?.WebApp?.expand?.();
    Telegram?.WebApp?.disableVerticalSwipes?.();
  } catch(_){ }
  window.scrollTo(0,0);
  addEventListener('scroll', ()=>scrollTo(0,0), {passive:true});

  const tbody = document.getElementById('records');
  let records = [];
  try {
    records = JSON.parse(localStorage.getItem('records')) || [];
  } catch(_){ records = []; }
  records.sort((a,b)=>b.score-a.score);
  records.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="pos">${i+1}</td><td class="name">${r.username}</td><td class="score">${r.score}</td>`;
    tbody.appendChild(tr);
  });
})();
