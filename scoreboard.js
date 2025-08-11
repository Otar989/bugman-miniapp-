(function(){
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
