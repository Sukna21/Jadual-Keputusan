(() => {
  "use strict";

  const CFG = window.SUKNA_MATCH_CONFIG || {};
  const $ = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => [...c.querySelectorAll(s)];

  const els = {
    menuBtn: $("#menuBtn"), mainNav: $("#mainNav"), installBtn: $("#installBtn"),
    activeSheetName: $("#activeSheetName"), sheetLastUpdate: $("#sheetLastUpdate"),
    sheetTabs: $("#sheetTabs"), sheetTabsInfo: $("#sheetTabsInfo"),
    activeVenueBanner: $("#activeVenueBanner"), activeVenueName: $("#activeVenueName"),
    resultsSearch: $("#resultsSearch"), statusFilter: $("#statusFilter"),
    dateChipBar: $("#dateChipBar"), reloadSheetBtn: $("#reloadSheetBtn"),
    loading: $("#sheetLoadingPanel"), error: $("#sheetErrorPanel"),
    miniStats: $("#resultsMiniStats"), featured: $("#featuredMatchGrid"),
    wall: $("#resultsCardWall"), count: $("#resultsCountInfo"),
    empty: $("#resultsEmptyState"), sourceInfo: $("#sourceInfo")
  };

  let deferredPrompt = null;
  let activeSheet = null;
  let allRecords = [];
  let activeDate = "";

  const esc = (v="") => String(v).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
  const clean = v => String(v ?? "").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
  const norm = v => clean(v).toLowerCase()
    .replace(/&/g," and ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g," ").trim();
  const uniq = arr => [...new Set(arr.filter(Boolean))];

  function setLoading(on){
    els.loading.hidden = !on;
    if(on) els.error.hidden = true;
  }
  function setError(on){
    els.error.hidden = !on;
  }

  // Mobile navigation
  els.menuBtn?.addEventListener("click", () => {
    const open = els.mainNav.classList.toggle("open");
    els.menuBtn.setAttribute("aria-expanded", String(open));
  });
  $$("#mainNav a").forEach(a => a.addEventListener("click", () => {
    els.mainNav.classList.remove("open");
    els.menuBtn?.setAttribute("aria-expanded","false");
  }));

  // PWA
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferredPrompt = e; els.installBtn.hidden = false;
  });
  els.installBtn?.addEventListener("click", async () => {
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installBtn.hidden = true;
  });
  if("serviceWorker" in navigator){
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js", {updateViaCache:"none"}).then(r => r.update()).catch(()=>{}));
  }

  function gvizJsonp(gid){
    return new Promise((resolve,reject) => {
      const cb = "__sukna_gviz_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const cleanup = () => { script.remove(); try{ delete window[cb]; }catch{} };
      const timer = setTimeout(() => { cleanup(); reject(new Error("Google Sheet timeout")); }, 18000);
      window[cb] = payload => { clearTimeout(timer); cleanup(); resolve(payload); };
      script.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error("Google Sheet load error")); };
      const tqx = encodeURIComponent(`out:json;responseHandler:${cb};reqId:${Date.now()}`);
      script.src = `https://docs.google.com/spreadsheets/d/${CFG.spreadsheetId}/gviz/tq?gid=${encodeURIComponent(gid)}&headers=0&tqx=${tqx}`;
      document.body.appendChild(script);
    });
  }

  function cellText(c){
    if(!c) return "";
    if(c.f != null && String(c.f).trim() !== "") return clean(c.f);
    if(c.v == null) return "";
    if(c.v instanceof Date) return c.v.toLocaleString("ms-MY");
    return clean(c.v);
  }

  function tableMatrix(table){
    const width = Math.max(
      (table.cols || []).length,
      ...(table.rows || []).map(r => (r.c || []).length),
      0
    );
    return (table.rows || []).map(r => {
      const cells = r.c || [];
      return Array.from({length:width}, (_,i) => cellText(cells[i]));
    });
  }

  function findMeta(matrix, regex){
    for(const row of matrix){
      for(let i=0;i<row.length;i++){
        if(regex.test(norm(row[i]))){
          for(let j=i+1;j<row.length;j++){
            if(clean(row[j])) return clean(row[j]);
          }
        }
      }
    }
    return "";
  }

  function canonicalVenue(raw){
    const value = clean(raw);
    if(!value) return {name:"", query:""};
    const n = norm(value).replace(/\band\b/g," ");
    const aliases = CFG.venueAliases || [];
    for(const item of aliases){
      for(const key of item.keys || []){
        const k = norm(key).replace(/\band\b/g," ");
        if(n === k || n.includes(k) || k.includes(n)){
          return {name:item.name, query:item.query || item.name};
        }
      }
    }
    return {name:value, query:value};
  }

  function looksLikeVenue(v){
    const n = norm(v);
    if(!n) return false;
    return /(stadium|dewan|gelanggang|padang|lapang|arena|akademi|upm|bilik|ioi)/.test(n);
  }

  function resolveVenue(defaultVenue, court){
    const courtText = clean(court);
    const n = norm(courtText);
    if(n === "stadium" || n === "stadium upm") return canonicalVenue("Stadium UPM");
    if(courtText.length >= 7 && looksLikeVenue(courtText)) return canonicalVenue(courtText);
    return canonicalVenue(defaultVenue);
  }

  function findMatchHeader(matrix){
    for(let r=0;r<matrix.length;r++){
      const row = matrix[r].map(norm);
      const hasNumber = row.some(v => /^(no per|no perlawanan|bil|bilangan perlawanan)$/.test(v) || v.includes("no per"));
      const teams = row.filter(v => v === "pasukan" || v.includes("pasukan")).length;
      const hasVs = row.some(v => /^(lwn|lawan|vs)$/.test(v));
      if(hasNumber && teams >= 2 && hasVs) return r;
    }
    return -1;
  }

  function headerIndex(row, regex){
    for(let i=0;i<row.length;i++) if(regex.test(norm(row[i]))) return i;
    return -1;
  }

  function headerIndices(row, regex){
    const out=[];
    row.forEach((v,i) => { if(regex.test(norm(v))) out.push(i); });
    return out;
  }

  function scoreFromRow(row, teamBIdx){
    if(teamBIdx < 0) return "";
    const zone = row.slice(teamBIdx+1, teamBIdx+7).map(clean).filter(Boolean);
    for(const z of zone){
      const m = z.match(/^\s*(\d{1,3})\s*[-:]\s*(\d{1,3})\s*$/);
      if(m) return `${m[1]} - ${m[2]}`;
    }
    const nums = zone.filter(z => /^\d{1,3}$/.test(z));
    if(nums.length >= 2) return `${nums[0]} - ${nums[1]}`;
    return "";
  }

  function prettyStage(v){
    const n = norm(v);
    if(n.includes("grand final")) return "Grand Final";
    if(n.includes("separuh akhir")) return "Separuh Akhir";
    if(n === "akhir" || n.includes("final")) return "Akhir";
    return "";
  }

  function parseEventDate(value){
    const s = clean(value);
    if(!s) return null;
    let m = s.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);
    if(m){
      let y = Number(m[3] || 2026); if(y < 100) y += 2000;
      return new Date(y, Number(m[2])-1, Number(m[1]));
    }
    m = s.match(/\b(\d{1,2})\s*(?:sep|sept|september)\w*\s*(\d{4})?/i);
    if(m) return new Date(Number(m[2] || 2026),8,Number(m[1]));
    return null;
  }

  function parseTime(value){
    const s = clean(value).toLowerCase();
    if(!s) return null;
    let m = s.match(/\b(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?\b/i);
    if(!m) return null;
    let h=Number(m[1]), min=Number(m[2]);
    const ap=(m[3]||"").toLowerCase();
    if(ap==="pm" && h<12) h+=12;
    if(ap==="am" && h===12) h=0;
    return {h,min};
  }

  function statusFor(dateText,timeText,score){
    if(score) return {key:"done", label:"Selesai"};
    const d = parseEventDate(dateText);
    if(!d) return {key:"upcoming", label:"Akan Datang"};
    const t = parseTime(timeText);
    if(t){ d.setHours(t.h,t.min,0,0); } else { d.setHours(12,0,0,0); }
    const now = new Date();
    const diff = now - d;
    if(diff >= 0 && diff <= 2*60*60*1000) return {key:"live", label:"Sedang Berlangsung"};
    if(diff > 2*60*60*1000) return {key:"done", label:"Selesai / Semak Keputusan"};
    return {key:"upcoming", label:"Akan Datang"};
  }

  function mapUrl(query){
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
  }

  function parseCompetition(matrix, sheet){
    const sport = findMeta(matrix, /^(acara|acara sukan)$/) || sheet.title;
    const metaDate = findMeta(matrix, /^tarikh$/);
    const defaultVenueRaw = findMeta(matrix, /^(tempat|venue|lokasi)$/);
    const defaultVenue = canonicalVenue(defaultVenueRaw);
    const headerRow = findMatchHeader(matrix);
    if(headerRow < 0) return {records:[], venue:defaultVenue, sport, metaDate};

    const headers = matrix[headerRow];
    const idxNo = headerIndex(headers, /^(no per|no perlawanan|bil|bilangan)/);
    const idxDate = headerIndex(headers, /^tarikh$/);
    const idxTime = headerIndex(headers, /^(masa|waktu|jam)$/);
    const idxCourt = headerIndex(headers, /^(glg|gelanggang|court)$/);
    const idxGroup = headerIndex(headers, /^(kump|kumpulan|peringkat|pusingan)$/);
    const teamCols = headerIndices(headers, /^pasukan$/);
    const idxTeamA = teamCols[0] ?? -1;
    const idxTeamB = teamCols[1] ?? -1;

    let lastDate = "";
    let stage = "Liga / Kumpulan";
    const records = [];

    for(let r=headerRow+1;r<matrix.length;r++){
      const row = matrix[r];
      const firstMeaningful = row.find(v => clean(v));
      const stageName = prettyStage(firstMeaningful || "");
      if(stageName){ stage = stageName; continue; }

      const noText = idxNo >= 0 ? clean(row[idxNo]) : "";
      if(!/^\d+(?:\.0+)?$/.test(noText)) continue;

      const teamA = idxTeamA >= 0 ? clean(row[idxTeamA]) : "";
      const teamB = idxTeamB >= 0 ? clean(row[idxTeamB]) : "";
      if(!teamA && !teamB) continue;

      const date = (idxDate >= 0 ? clean(row[idxDate]) : "") || lastDate || metaDate;
      if(idxDate >= 0 && clean(row[idxDate])) lastDate = clean(row[idxDate]);
      const time = idxTime >= 0 ? clean(row[idxTime]) : "";
      const court = idxCourt >= 0 ? clean(row[idxCourt]) : "";
      const group = idxGroup >= 0 ? clean(row[idxGroup]) : "";
      const venue = resolveVenue(defaultVenueRaw, court);
      const score = scoreFromRow(row, idxTeamB);
      const status = statusFor(date,time,score);
      const matchNo = noText.replace(/\.0+$/,"");

      records.push({
        id:`${sheet.gid}-${r}`,
        sheetTitle:sheet.title,
        sport:clean(sport) || sheet.title,
        title:`${stage} · Perlawanan ${matchNo}`,
        stage,
        matchNo,
        group,
        date,
        time,
        court,
        teamA,
        teamB,
        score,
        venue:venue.name || defaultVenue.name,
        venueUrl:(venue.name || defaultVenue.name) ? mapUrl(venue.query || defaultVenue.query || venue.name || defaultVenue.name) : "",
        statusKey:status.key,
        statusLabel:status.label
      });
    }

    return {records, venue:defaultVenue, sport, metaDate};
  }

  function parseGeneral(matrix, sheet){
    // Special parser for JADUAL UMUM. It creates overview cards from the date/time grid.
    let dateRow=-1, timeRow=-1;
    for(let r=0;r<matrix.length;r++){
      if(matrix[r].some(v => /^\d{1,2}\/\d{1,2}$/.test(clean(v)))) { dateRow=r; break; }
    }
    if(dateRow >= 0) timeRow = dateRow + 2;
    if(dateRow < 0 || !matrix[dateRow]) return {records:[],venue:{name:"",query:""},sport:"Jadual Umum",metaDate:""};

    const dateByCol={};
    let currentDate="";
    for(let c=0;c<matrix[dateRow].length;c++){
      const v=clean(matrix[dateRow][c]);
      if(/^\d{1,2}\/\d{1,2}$/.test(v)) currentDate=v+"/2026";
      if(currentDate) dateByCol[c]=currentDate;
    }
    const records=[];
    for(let r=timeRow+1;r<matrix.length;r++){
      const event=clean(matrix[r][1] || "");
      if(!event || /^(tm|=)/i.test(event)) continue;
      for(let c=2;c<matrix[r].length;c++){
        const mark=clean(matrix[r][c]);
        if(!mark || mark==="TM") continue;
        const date=dateByCol[c] || "";
        const time=clean(matrix[timeRow]?.[c] || "");
        const status=statusFor(date,time,"");
        records.push({
          id:`${sheet.gid}-${r}-${c}`,sheetTitle:sheet.title,sport:event,
          title:event,stage:"Ringkasan",matchNo:"",group:"",date,time,court:"",
          teamA:"",teamB:"",score:"",venue:"",venueUrl:"",
          statusKey:status.key,statusLabel:status.label
        });
      }
    }
    return {records,venue:{name:"",query:""},sport:"Jadual Umum",metaDate:"17–20 September 2026"};
  }

  function renderTabs(){
    els.sheetTabs.innerHTML = (CFG.sheets || []).map(sheet => `
      <button class="sheet-tab ${activeSheet?.gid===sheet.gid?"active":""}" data-gid="${esc(sheet.gid)}">
        <span class="icon">${esc(sheet.icon || "●")}</span>
        <span><b>${esc(sheet.short || sheet.title)}</b><small>${esc(sheet.title)}</small></span>
      </button>`).join("");
    els.sheetTabsInfo.textContent = `${(CFG.sheets || []).length} tab dipautkan kepada helaian rasmi.`;
  }

  function renderDateChips(){
    const dates=uniq(allRecords.map(r=>r.date));
    els.dateChipBar.innerHTML = `
      <button class="date-chip ${activeDate===""?"active":""}" data-date="">Semua Tarikh</button>
      ${dates.map(d=>`<button class="date-chip ${activeDate===d?"active":""}" data-date="${esc(d)}">${esc(d)}</button>`).join("")}`;
    els.dateChipBar.hidden = dates.length <= 1;
  }

  function filteredRows(){
    const q=norm(els.resultsSearch.value);
    const status=els.statusFilter.value;
    return allRecords.filter(r => {
      const blob=norm([r.sheetTitle,r.sport,r.title,r.stage,r.group,r.date,r.time,r.court,r.teamA,r.teamB,r.score,r.venue].join(" "));
      return (!activeDate || r.date===activeDate) && (!status || r.statusKey===status) && (!q || blob.includes(q));
    });
  }

  function teamBlock(r){
    if(!r.teamA && !r.teamB) return `<div class="versus"><b>${esc(r.title)}</b><span class="score">•</span><b>${esc(r.date)}</b></div>`;
    return `<div class="versus"><b>${esc(r.teamA || "Pasukan A")}</b><span class="score">${esc(r.score || "VS")}</span><b>${esc(r.teamB || "Pasukan B")}</b></div>`;
  }

  function venueBlock(r){
    if(!r.venue) return "";
    return `<a class="venue-link" href="${esc(r.venueUrl)}" target="_blank" rel="noopener">📍 ${esc(r.venue)} ↗</a>
      ${r.court && !looksLikeVenue(r.court) ? `<div class="court-line">Gelanggang / Court: <b>${esc(r.court)}</b></div>` : ""}`;
  }

  function renderRows(){
    const rows=filteredRows();
    const counts={
      total:rows.length,
      live:rows.filter(r=>r.statusKey==="live").length,
      done:rows.filter(r=>r.statusKey==="done").length,
      upcoming:rows.filter(r=>r.statusKey==="upcoming").length
    };
    els.miniStats.innerHTML=`
      <article><small>Jumlah rekod</small><b>${counts.total}</b></article>
      <article><small>Berlangsung</small><b>${counts.live}</b></article>
      <article><small>Selesai</small><b>${counts.done}</b></article>
      <article><small>Akan datang</small><b>${counts.upcoming}</b></article>`;
    els.count.textContent=`${rows.length} rekod dipaparkan`;
    els.empty.hidden=rows.length!==0;

    const featured=[...rows].sort((a,b)=>{
      const order={live:0,upcoming:1,done:2};
      return (order[a.statusKey]??9)-(order[b.statusKey]??9);
    }).slice(0,4);

    els.featured.innerHTML=featured.map(r=>`
      <article class="featured-card">
        <div class="card-topline"><span class="status ${esc(r.statusKey)}">${esc(r.statusLabel)}</span><small>${esc(r.sheetTitle)}</small></div>
        <h3>${esc(r.title)}</h3>
        ${teamBlock(r)}
        <div class="match-meta"><span>🗓 ${esc([r.date,r.time].filter(Boolean).join(" · ") || "Rujuk helaian")}</span><span>${esc(r.group || r.sport)}</span></div>
        ${venueBlock(r)}
      </article>`).join("") || `<div class="empty-state">Tiada highlight untuk dipaparkan.</div>`;

    els.wall.innerHTML=rows.map(r=>`
      <article class="result-card">
        <div class="result-head">
          <div><small>${esc(r.sheetTitle)}</small><h3>${esc(r.title)}</h3></div>
          <span class="status ${esc(r.statusKey)}">${esc(r.statusLabel)}</span>
        </div>
        <div class="result-main">
          <span class="stage-pill">${esc(r.stage || "Pertandingan")}${r.group ? ` · ${esc(r.group)}` : ""}</span>
          ${teamBlock(r)}
        </div>
        <div class="result-info">
          <span>🗓 ${esc([r.date,r.time].filter(Boolean).join(" · ") || "Rujuk helaian rasmi")}</span>
          ${r.venue ? `<a href="${esc(r.venueUrl)}" target="_blank" rel="noopener">📍 ${esc(r.venue)} ↗</a>` : ""}
          ${r.court && !looksLikeVenue(r.court) ? `<span>🏟 Gelanggang / Court: <b>${esc(r.court)}</b></span>` : ""}
        </div>
      </article>`).join("");
  }

  async function loadSheet(sheet){
    activeSheet=sheet; activeDate=""; allRecords=[];
    renderTabs(); renderDateChips(); setLoading(true); setError(false);
    els.activeSheetName.textContent=sheet.title;
    els.activeVenueBanner.hidden=true;
    els.sourceInfo.textContent="Data rasmi urus setia.";

    try{
      const resp=await gvizJsonp(sheet.gid);
      if(!resp || resp.status==="error" || !resp.table) throw new Error("Respons Google Sheet tidak sah.");
      const matrix=tableMatrix(resp.table);
      const parsed=sheet.general ? parseGeneral(matrix,sheet) : parseCompetition(matrix,sheet);
      allRecords=parsed.records;

      if(parsed.venue?.name){
        els.activeVenueName.textContent=parsed.venue.name;
        els.activeVenueBanner.hidden=false;
        els.sourceInfo.textContent=`Venue default tab: ${parsed.venue.name}`;
      }
      renderDateChips(); renderRows();
      els.sheetLastUpdate.textContent="Dikemas kini " + new Date().toLocaleTimeString("ms-MY",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
      setLoading(false);
    }catch(err){
      console.error(err);
      setLoading(false); setError(true); allRecords=[]; renderDateChips(); renderRows();
      els.sheetLastUpdate.textContent="Gagal memuatkan data";
    }
  }

  els.sheetTabs?.addEventListener("click", e => {
    const btn=e.target.closest("[data-gid]"); if(!btn) return;
    const sheet=(CFG.sheets || []).find(s=>s.gid===btn.dataset.gid); if(sheet) loadSheet(sheet);
  });
  els.dateChipBar?.addEventListener("click", e => {
    const btn=e.target.closest("[data-date]"); if(!btn) return;
    activeDate=btn.dataset.date || ""; renderDateChips(); renderRows();
  });
  els.resultsSearch?.addEventListener("input",renderRows);
  els.statusFilter?.addEventListener("change",renderRows);
  els.reloadSheetBtn?.addEventListener("click",()=>activeSheet&&loadSheet(activeSheet));

  renderTabs();
  const first=(CFG.sheets || []).find(s=>!s.general) || (CFG.sheets || [])[0];
  if(first) loadSheet(first);
})();