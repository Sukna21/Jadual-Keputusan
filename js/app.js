(() => {
  const D = window.SUKNA_MATCH_DATA;
  const $ = (s,c=document) => c.querySelector(s);
  const $$ = (s,c=document) => [...c.querySelectorAll(s)];
  const icons = {
    'BOLA SEPAK':'⚽','BOLA JARING':'🥅','BOLA TAMPAR LELAKI':'🏐','BOLA TAMPAR WANITA':'🏐',
    'FUTSAL LELAKI':'⚽','FUTSAL WANITA':'⚽','BADMINTON BERPASUKAN':'🏸','KAROM BERPASUKAN':'♟️',
    'DART BERPASUKAN':'🎯','SEPAK TAKRAW BERPASUKAN LELAKI':'🏐','PING PONG BERPASUKAN':'🏓',
    'TARIK TALI (KATEGORI LELAKI 680KG)':'🪢','TARIK TALI (KATEGORI FREEWEIGHT)':'🪢'
  };
  const normalize = s => String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
  const malayDate = iso => {
    if(!/^2026-09-\d\d$/.test(iso||'')) return iso||'Tarikh ikut jadual rasmi';
    const d=Number(iso.slice(-2)); const day={17:'Khamis',18:'Jumaat',19:'Sabtu',20:'Ahad'}[d]||'';
    return `${d} September 2026${day?' · '+day:''}`;
  };
  const formatTime = t => {
    if(!t) return '—';
    const [h,m] = t.split(':').map(Number); if(Number.isNaN(h)) return t;
    const suffix=h<12?'pagi':h<19?'petang':'malam'; let hh=h%12||12;
    return `${hh}.${String(m).padStart(2,'0')} ${suffix}`;
  };
  const matchStatus = m => m.result ? 'Selesai' : 'Belum diisi';
  const totalMatches = D.sports.reduce((n,s)=>n+s.matches.length,0);
  const gold = D.general.reduce((n,g)=>n+(Number(g.gold)||0),0);
  const venues = new Set(D.general.map(g=>g.venue).filter(Boolean)).size;
  $('#summaryStats').innerHTML = [
    ['🏆',D.general.length,'Acara'],['⚔️',totalMatches,'Perlawanan'],['🥇',gold,'Pingat emas'],['📍',venues,'Venue pertandingan']
  ].map(x=>`<article class="stat-card"><i>${x[0]}</i><div><b>${x[1]}</b><small>${x[2]}</small></div></article>`).join('');

  // Overall medal standings.
  // No medal count is invented: null values render as em-dashes until official results are entered.
  function medalNumber(v){ return Number.isFinite(Number(v)) && v!==null && v!=='' ? Number(v) : null; }
  function medalTotal(row){
    const g=medalNumber(row.gold), s=medalNumber(row.silver), b=medalNumber(row.bronze);
    return [g,s,b].some(v=>v!==null) ? (g||0)+(s||0)+(b||0) : null;
  }
  function renderMedalStandings(){
    const source=(D.medals||[]).map((m,i)=>({...m,_index:i,total:medalTotal(m)}));
    const hasOfficial=source.some(m=>m.total!==null);
    const rows=[...source];

    if(hasOfficial){
      rows.sort((a,b)=>{
        const ag=medalNumber(a.gold)||0, bg=medalNumber(b.gold)||0;
        const as=medalNumber(a.silver)||0, bs=medalNumber(b.silver)||0;
        const ab=medalNumber(a.bronze)||0, bb=medalNumber(b.bronze)||0;
        const at=a.total||0, bt=b.total||0;
        return (bg-ag)||(bs-as)||(bb-ab)||(bt-at)||(a._index-b._index);
      });
    }

    let previousKey='', previousRank=0;
    $('#medalTableBody').innerHTML=rows.map((m,i)=>{
      const g=medalNumber(m.gold), s=medalNumber(m.silver), b=medalNumber(m.bronze);
      const key=`${g||0}|${s||0}|${b||0}|${m.total||0}`;
      let rank='—';
      if(hasOfficial){
        if(key!==previousKey) previousRank=i+1;
        rank=previousRank;
        previousKey=key;
      }
      const cls=hasOfficial && rank<=3 ? ` podium rank-${rank}` : '';
      return `<tr class="${cls.trim()}">
        <td class="rank-cell"><span>${rank}</span></td>
        <td class="contingent-cell"><b>${m.contingent}</b></td>
        <td class="medal-value gold-value">${g===null?'—':g}</td>
        <td class="medal-value silver-value">${s===null?'—':s}</td>
        <td class="medal-value bronze-value">${b===null?'—':b}</td>
        <td class="medal-value total-value">${m.total===null?'—':m.total}</td>
      </tr>`;
    }).join('');

    $('#medalEmptyNote').hidden=hasOfficial;
    const status=$('#medalStatus');
    if(status){
      status.classList.toggle('live',hasOfficial);
      status.querySelector('b').textContent=hasOfficial?'Keputusan rasmi dikemas kini':'Menunggu keputusan rasmi';
    }
  }
  renderMedalStandings();

  // menu
  $('#menuBtn').addEventListener('click',()=>$('#mainNav').classList.toggle('open'));
  $$('#mainNav a').forEach(a=>a.addEventListener('click',()=>$('#mainNav').classList.remove('open')));

  // General schedule date filter — based on date labels from detailed sport tabs when available.
  const days=['Semua','17 Sep','18 Sep','19 Sep','20 Sep']; let activeDay='Semua';
  $('#daySwitcher').innerHTML=days.map((d,i)=>`<button class="${i===0?'active':''}" data-day="${d}">${d}</button>`).join('');
  function generalDateMatch(g, day){ if(day==='Semua') return true; return normalize(g.dateLabel).includes(day.replace(' Sep',' september').toLowerCase()) || normalize(g.dateLabel).includes(day.toLowerCase()); }
  function renderGeneral(){
    const rows=D.general.filter(g=>generalDateMatch(g,activeDay));
    $('#generalGrid').innerHTML=rows.map(g=>`<article class="general-card">
      <div class="general-head"><h3>${g.event}</h3><span class="medal">${g.gold||'—'}</span></div>
      <p>📍 ${g.venue||'Venue tidak dinyatakan'}</p>
      <div class="general-meta"><span>${g.dateLabel||'Rujuk jadual umum'}</span><span>${g.days?g.days+' hari':'—'}</span><span>${g.gold?g.gold+' emas':'—'}</span></div>
    </article>`).join('') || '<div class="empty">Tiada acara untuk tapisan ini.</div>';
  }
  $('#daySwitcher').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;activeDay=b.dataset.day;$$('#daySwitcher button').forEach(x=>x.classList.toggle('active',x===b));renderGeneral();});
  renderGeneral();

  // Sports
  let activeSport=D.sports[0]; let activeRound='Semua'; let sportQuery=''; let matchQuery='';
  function sportIcon(s){ return icons[s.name] || icons[s.sheet] || '🏅'; }
  function renderSports(){
    const q=normalize(sportQuery);
    const rows=D.sports.filter(s=>!q||normalize(s.name+' '+s.venue).includes(q));
    $('#sportGrid').innerHTML=rows.map(s=>`<button class="sport-card ${s.id===activeSport.id?'active':''}" data-id="${s.id}">
      <span class="sport-icon">${sportIcon(s)}</span><h3>${s.name}</h3><small>${s.dateLabel}</small><span class="match-count">${s.matches.length} perlawanan</span>
    </button>`).join('');
  }
  $('#sportSearch').addEventListener('input',e=>{sportQuery=e.target.value;renderSports();});
  $('#sportGrid').addEventListener('click',e=>{const b=e.target.closest('.sport-card');if(!b)return;const s=D.sports.find(x=>x.id===b.dataset.id);if(s){activeSport=s;activeRound='Semua';matchQuery='';$('#matchSearch').value='';renderSports();renderSportDetail();document.querySelector('#match-centre').scrollIntoView({behavior:'smooth'});}});

  function renderGroups(){
    const groups=activeSport.groups||[];
    const cards=groups.map(g=>`<article class="group-card"><h3>${g.name}</h3>${g.teams.map((t,i)=>`<div class="group-team"><span class="rank-dot">${i+1}</span><b>${t}</b><small>Mata —</small></div>`).join('')}</article>`).join('');
    $('#groupsPanel').innerHTML=(cards||'')+`<article class="source-card"><h3>Status keputusan</h3><p>Dalam fail sumber, ruangan <strong>Keputusan</strong> dan <strong>Kedudukan</strong> masih perlu diisi secara manual. Portal ini tidak mereka skor atau kedudukan.</p></article>`;
  }

  function renderSportDetail(){
    $('#sportKicker').textContent='MATCH CENTRE · '+sportIcon(activeSport);
    $('#sportTitle').textContent=activeSport.name;
    $('#sportMeta').innerHTML=`<span>🗓 ${activeSport.dateLabel}</span><span>📍 ${activeSport.venue}</span><span>⚔ ${activeSport.matches.length} perlawanan</span>`;
    renderGroups();
    const rounds=['Semua',...new Set(activeSport.matches.map(m=>m.round))];
    $('#roundTabs').innerHTML=rounds.map(r=>`<button class="${r===activeRound?'active':''}" data-round="${r}">${r}</button>`).join('');
    renderMatches();
  }
  $('#roundTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;activeRound=b.dataset.round;renderSportDetail();});
  $('#matchSearch').addEventListener('input',e=>{matchQuery=e.target.value;renderMatches();});

  function renderMatches(){
    const q=normalize(matchQuery);
    let rows=activeSport.matches.filter(m=>(activeRound==='Semua'||m.round===activeRound) && (!q||normalize(`${m.teamA} ${m.teamB} ${m.reference} ${m.round}`).includes(q)));
    const byDate={}; rows.forEach(m=>(byDate[m.date||'']??=[]).push(m));
    $('#matchList').innerHTML=Object.entries(byDate).map(([date,ms])=>`<section class="date-block"><div class="date-heading">${malayDate(date)}</div><div class="match-list">${ms.map(matchCard).join('')}</div></section>`).join('') || '<div class="empty">Tiada perlawanan untuk tapisan ini.</div>';
  }
  function matchCard(m){
    const ref=m.reference && (!m.teamA.includes('ZON') || !m.teamB.includes('ZON')) ? `<div class="match-reference">Rujukan bracket asal: <b>${m.reference}</b></div>` : '';
    const rawCourt=String(m.court||'').trim();
    const cleanCourt=rawCourt.replace(/\.0$/,'');
    const court=/^stadium$/i.test(cleanCourt)
      ? 'Stadium UPM'
      : (cleanCourt ? `Glg ${cleanCourt}` : (activeSport.venue || 'Venue belum ditetapkan'));
    const score=m.result || '— : —';
    const pending=!m.result;
    return `<article class="match-card">
      <div class="match-time"><b>${formatTime(m.time)}</b><small>Per. ${m.no} · ${court}</small></div>
      <div class="team">${m.teamA||'TBD'}</div>
      <div class="score ${pending?'pending':''}">${score}</div>
      <div class="team right">${m.teamB||'TBD'}</div>
      <div class="match-side"><span class="round-badge">${m.round}</span><small>${matchStatus(m)}</small></div>
      ${ref}
    </article>`;
  }
  renderSports(); renderSportDetail();
})();
