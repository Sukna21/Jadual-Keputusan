(() => {
  "use strict";

  const SPREADSHEET_ID = "1qiRF16JhUlDBV9ZvoO6YhA5JnCbjqFcs";
  const REFRESH_MS = 60000;
  const BUILD = "v6";

  // GIDs from the current official Google Sheet.
  const SHEETS = {
    general: {name:"JADUAL UMUM", gid:"1766800443"},
    sports: [
      {id:"bola-sepak", name:"BOLA SEPAK", gid:"1303193966"},
      {id:"bola-jaring", name:"BOLA JARING", gid:"903650058"},
      {id:"bola-tampar-lelaki", name:"BOLA TAMPAR LELAKI", gid:"979601248"},
      {id:"bola-tampar-wanita", name:"BOLA TAMPAR WANITA", gid:"1738590806"},
      {id:"futsal-lelaki", name:"FUTSAL LELAKI", gid:"1041379431"},
      {id:"futsal-wanita", name:"FUTSAL WANITA", gid:"897313832"},
      {id:"badminton-berpasukan", name:"BADMINTON BERPASUKAN", gid:"1105793258"},
      {id:"karom-berpasukan", name:"KAROM BERPASUKAN", gid:"91010045"},
      {id:"dart-berpasukan", name:"DART BERPASUKAN", gid:"1631672342"},
      {id:"sepak-takraw-regu", name:"SEPAK TAKRAW REGU", gid:"1526261777"},
      {id:"ping-pong-berpasukan", name:"PING PONG BERPASUKAN", gid:"251106998"},
      {id:"tarik-tali-680kg", name:"TARIK TALI (680KG)", gid:"303215215"},
      {id:"tarik-tali-freeweight", name:"TARIK TALI (FREEWEIGHT)", gid:"475871147"}
    ],
    medals: {name:"PINGAT"}
  };

  const fallback = JSON.parse(JSON.stringify(window.SUKNA_MATCH_DATA || {}));
  let loading = false;
  let lastFingerprint = "";

  const clean = v => String(v ?? "").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
  const norm = v => clean(v).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g," ").trim();

  function setStatus(text, ok=false, busy=false){
    const footer=document.getElementById("liveFooterStatus");
    if(footer) footer.textContent=text;
    const btn=document.getElementById("refreshLiveBtn");
    if(btn){
      btn.disabled=busy;
      btn.textContent=busy ? "↻ Menyambung…" : "↻ Kemaskini Data";
      btn.title=text;
    }
    document.documentElement.dataset.live=ok ? "1" : "0";
  }

  function gviz({gid,name}, timeout=12000){
    return new Promise((resolve,reject)=>{
      const cb="__sukna_"+Math.random().toString(36).slice(2);
      const script=document.createElement("script");
      const cleanup=()=>{ clearTimeout(timer); script.remove(); try{delete window[cb]}catch(_){} };
      const timer=setTimeout(()=>{cleanup();reject(new Error("timeout"))},timeout);

      window[cb]=(payload)=>{
        cleanup();
        if(!payload || payload.status==="error" || !payload.table){
          reject(new Error("sheet unavailable"));
          return;
        }
        resolve(payload.table);
      };

      script.onerror=()=>{cleanup();reject(new Error("network error"))};

      const tqx=encodeURIComponent(`out:json;responseHandler:${cb};reqId:${Date.now()}`);
      const selector=gid ? `gid=${encodeURIComponent(gid)}` : `sheet=${encodeURIComponent(name)}`;
      script.src=`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?${selector}&headers=0&tqx=${tqx}&tq=${encodeURIComponent("select *")}&_=${Date.now()}`;
      document.body.appendChild(script);
    });
  }

  function cellText(c){
    if(!c) return "";
    if(c.f!==undefined && c.f!==null && String(c.f).trim()!=="") return clean(c.f);
    if(c.v===undefined || c.v===null) return "";
    return clean(c.v);
  }

  function tableMatrix(table){
    const width=Math.max((table.cols||[]).length,...(table.rows||[]).map(r=>(r.c||[]).length),0);
    return (table.rows||[]).map(r=>{
      const cells=r.c||[];
      return Array.from({length:width},(_,i)=>cellText(cells[i]));
    });
  }

  function findMeta(matrix,label){
    const target=norm(label);
    for(const row of matrix){
      for(let i=0;i<row.length;i++){
        if(norm(row[i])===target){
          for(let j=i+1;j<row.length;j++){
            const v=clean(row[j]);
            if(v) return v;
          }
        }
      }
    }
    return "";
  }

  function headerIndex(row, matcher){
    for(let i=0;i<row.length;i++) if(matcher(norm(row[i]))) return i;
    return -1;
  }

  function headerIndices(row, matcher){
    const out=[];
    row.forEach((v,i)=>{if(matcher(norm(v))) out.push(i)});
    return out;
  }

  function parseDateISO(v){
    const s=clean(v);
    if(!s) return "";
    let m=s.match(/Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)/i);
    if(m) return `${m[1]}-${String(Number(m[2])+1).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
    m=s.match(/\b(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?:\s*[\/.-]\s*(\d{2,4}))?\b/);
    if(m){
      let y=Number(m[3]||2026); if(y<100)y+=2000;
      return `${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
    }
    m=s.match(/\b(\d{1,2})\s*(?:sep|sept|september)\w*\s*(\d{4})?/i);
    if(m) return `${m[2]||2026}-09-${String(m[1]).padStart(2,"0")}`;
    return "";
  }

  function parseTime24(v){
    const s=clean(v).toLowerCase();
    if(!s) return "";
    let m=s.match(/\b(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?\b/i);
    if(!m) return "";
    let h=Number(m[1]), min=Number(m[2]);
    const ap=(m[3]||"").toLowerCase();
    if(ap==="pm" && h<12) h+=12;
    if(ap==="am" && h===12) h=0;
    return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
  }

  function dateLabelFromISOs(dates){
    const ds=[...new Set(dates.filter(Boolean))].sort();
    if(!ds.length) return "";
    const dayName={17:"KHAMIS",18:"JUMAAT",19:"SABTU",20:"AHAD"};
    const day=n=>Number(n.slice(-2));
    if(ds.length===1){
      const d=day(ds[0]);
      return `${d} SEPTEMBER 2026${dayName[d]?` (${dayName[d]})`:""}`;
    }
    return `${day(ds[0])}-${day(ds.at(-1))} SEPTEMBER 2026`;
  }

  function extractResult(row,resultCol,teamBCol=-1){
    // Source workbook layout is not a normal database table.
    // The reliable structure on every match row is:
    // TEAM B | score kiri | ":" | score kanan
    //
    // Example:
    // Bola Sepak: H=TEAM B, I=score, J=":", K=score
    // Bola Tampar: I=TEAM B, J=score, K=":", L=score

    const valueAt=i => (i>=0 && i<row.length) ? clean(row[i]) : "";
    const isEmpty=v => !v || v==="-" || v==="–" || v==="—" || /^vs$/i.test(v);

    // 1) Most reliable: find ":" shortly after Team B.
    const scanStart = teamBCol>=0 ? teamBCol+1 : Math.max(0,resultCol);
    const scanEnd = Math.min(row.length-1, scanStart+8);

    for(let c=scanStart;c<=scanEnd;c++){
      if(/^\s*:\s*$/.test(valueAt(c))){
        const left=valueAt(c-1);
        const right=valueAt(c+1);
        if(!isEmpty(left) && !isEmpty(right)){
          return `${left} : ${right}`;
        }
      }
    }

    // 2) If urus setia types complete score into one cell.
    for(let c=scanStart;c<=scanEnd;c++){
      const v=valueAt(c);
      const m=v.match(/^\s*(\d+)\s*[:\-–—]\s*(\d+)\s*$/);
      if(m) return `${m[1]} : ${m[2]}`;
    }

    // 3) Header-based fallback around KEPUTUSAN.
    if(resultCol>=0){
      const block=[];
      for(let c=resultCol;c<=Math.min(row.length-1,resultCol+5);c++){
        const v=valueAt(c);
        if(v && v!==":" && !isEmpty(v)) block.push(v);
      }
      const nums=block.filter(v=>/^-?\d+(?:\.\d+)?$/.test(v));
      if(nums.length>=2) return `${nums[0]} : ${nums[1]}`;
      if(block.length===1 && !/^\d+(?:\.\d+)?$/.test(block[0])) return block[0];
    }

    return "";
  }

  function roundMarker(row,current){
    const blob=norm(row.join(" "));
    if(blob.includes("separuh akhir")) return "Separuh Akhir";
    if(blob.includes("grand final")) return "Grand Final";
    if(/\bakhir\b/.test(blob) || /\bfinal\b/.test(blob)) return "Akhir";
    return current;
  }

  function parseSport(matrix, base){
    const sport=JSON.parse(JSON.stringify(base));
    const metaName=findMeta(matrix,"acara") || sport.name;
    const metaDate=findMeta(matrix,"tarikh") || sport.dateLabel;
    const metaVenue=findMeta(matrix,"tempat") || sport.venue;

    let headerRow=-1;
    for(let r=0;r<matrix.length;r++){
      const row=matrix[r];
      const noIdx=headerIndex(row,v=>v.startsWith("no per") || v==="bil" || v==="bilangan perlawanan");
      const teams=headerIndices(row,v=>v==="pasukan");
      if(noIdx>=0 && teams.length>=2){headerRow=r;break}
    }
    if(headerRow<0){
      sport.name=metaName; sport.dateLabel=metaDate; sport.venue=metaVenue;
      return sport;
    }

    const h=matrix[headerRow];
    const idxNo=headerIndex(h,v=>v.startsWith("no per") || v==="bil" || v==="bilangan perlawanan");
    const idxDate=headerIndex(h,v=>v==="tarikh");
    const idxTime=headerIndex(h,v=>v==="masa" || v==="waktu" || v==="jam");
    const idxCourt=headerIndex(h,v=>v==="glg" || v==="gelanggang" || v==="court");
    const idxRef=headerIndex(h,v=>v==="kump" || v==="kumpulan" || v==="rujukan");
    const teamCols=headerIndices(h,v=>v==="pasukan");
    const idxTeamA=teamCols[0] ?? -1;
    const idxTeamB=teamCols[1] ?? -1;
    const idxResult=headerIndex(h,v=>v==="keputusan" || v==="result");

    let currentDate="", currentTime="", currentRound="Liga Kumpulan";
    const matches=[];

    for(let r=headerRow+1;r<matrix.length;r++){
      const row=matrix[r];
      currentRound=roundMarker(row,currentRound);

      const noRaw=idxNo>=0 ? clean(row[idxNo]) : "";
      if(!/^\d+(?:\.0+)?$/.test(noRaw)) continue;

      const rowDate=idxDate>=0 ? parseDateISO(row[idxDate]) : "";
      const rowTime=idxTime>=0 ? parseTime24(row[idxTime]) : "";
      if(rowDate) currentDate=rowDate;
      if(rowTime) currentTime=rowTime;

      matches.push({
        no:Number(noRaw),
        date:currentDate,
        dateDisplay:"",
        time:currentTime,
        court:idxCourt>=0 ? clean(row[idxCourt]).replace(/\.0$/,"") : "",
        round:currentRound,
        reference:idxRef>=0 ? clean(row[idxRef]) : "",
        teamA:idxTeamA>=0 ? clean(row[idxTeamA]) : "",
        teamB:idxTeamB>=0 ? clean(row[idxTeamB]) : "",
        result:extractResult(row,idxResult,idxTeamB)
      });
    }

    sport.name=metaName || sport.name;
    sport.dateLabel=metaDate || dateLabelFromISOs(matches.map(m=>m.date)) || sport.dateLabel;
    sport.venue=metaVenue || sport.venue;
    if(matches.length) sport.matches=matches;
    return sport;
  }

  function parseGeneral(matrix, baseGeneral, liveSports){
    let dateHeaderRow=-1;
    for(let r=0;r<matrix.length;r++){
      if(matrix[r].some(v=>norm(v)==="tarikh") && matrix[r].some(v=>/\b\d{1,2}\/\d{1,2}\b/.test(clean(v)))){
        dateHeaderRow=r; break;
      }
    }
    if(dateHeaderRow<0) return baseGeneral;

    const dateByCol={};
    let current="";
    for(let c=0;c<matrix[dateHeaderRow].length;c++){
      const iso=parseDateISO(matrix[dateHeaderRow][c]);
      if(iso) current=iso;
      if(current) dateByCol[c]=current;
    }

    const baseMap=new Map(baseGeneral.map(x=>[norm(x.event),x]));
    const sportVenueMap=new Map();
    liveSports.forEach(s=>{
      sportVenueMap.set(norm(s.name),s.venue);
      // friendly aliases
      if(norm(s.name).includes("karom")) sportVenueMap.set("karom campuran",s.venue);
      if(norm(s.name).includes("tarik tali kategori lelaki")) sportVenueMap.set("tarik tali lelaki",s.venue);
      if(norm(s.name).includes("sepak takraw")) sportVenueMap.set("sepak takraw lelaki",s.venue);
      if(norm(s.name).includes("dart")) sportVenueMap.set("dart",s.venue);
    });

    const out=[];
    for(let r=dateHeaderRow+1;r<matrix.length;r++){
      const no=clean(matrix[r][0]), event=clean(matrix[r][1]);
      if(!/^\d+(?:\.0+)?$/.test(no) || !event) continue;

      const dates=[];
      let gold=0;
      for(let c=2;c<matrix[r].length;c++){
        const v=clean(matrix[r][c]);
        if(!v || norm(v)==="tm") continue;
        if(dateByCol[c]) dates.push(dateByCol[c]);
        if(/^\d+(?:\.0+)?$/.test(v)) gold+=Number(v);
      }

      const old=baseMap.get(norm(event)) || {};
      out.push({
        no,
        event,
        venue:sportVenueMap.get(norm(event)) || old.venue || "",
        gold:gold || old.gold || 0,
        days:[...new Set(dates)].length || old.days || 0,
        dateLabel:dateLabelFromISOs(dates) || old.dateLabel || ""
      });
    }
    return out.length ? out : baseGeneral;
  }

  function parseMedals(matrix, fallbackMedals){
    let header=-1, idxCont=-1, idxGold=-1, idxSilver=-1, idxBronze=-1;
    for(let r=0;r<matrix.length;r++){
      const row=matrix[r].map(norm);
      const find=(terms)=>row.findIndex(v=>terms.includes(v));
      const c=find(["kontinjen","zon","pasukan"]);
      const g=find(["emas","gold"]);
      const s=find(["perak","silver"]);
      const b=find(["gangsa","bronze"]);
      if(c>=0 && g>=0 && s>=0 && b>=0){
        header=r;idxCont=c;idxGold=g;idxSilver=s;idxBronze=b;break;
      }
    }
    if(header<0) return fallbackMedals;

    const rows=[];
    for(let r=header+1;r<matrix.length;r++){
      const contingent=clean(matrix[r][idxCont]);
      if(!contingent) continue;
      const num=v=>{
        const s=clean(v);
        if(s==="") return null;
        const n=Number(s); return Number.isFinite(n)?n:null;
      };
      rows.push({
        contingent,
        gold:num(matrix[r][idxGold]),
        silver:num(matrix[r][idxSilver]),
        bronze:num(matrix[r][idxBronze])
      });
    }
    return rows.length ? rows : fallbackMedals;
  }

  async function buildLiveData(){
    const next=JSON.parse(JSON.stringify(fallback));
    next.meta={
      ...(next.meta||{}),
      source:"Google Sheet Rasmi Urus Setia",
      updated:new Date().toLocaleString("ms-MY")
    };

    let loadedSports=0;

    // Setiap tab cuba load sendiri supaya satu tab rosak tidak blank-kan portal.
    const sportResults=await Promise.allSettled(SHEETS.sports.map(async cfg=>{
      const base=next.sports.find(s=>s.id===cfg.id);
      if(!base) return null;
      const table=await gviz(cfg);
      return parseSport(tableMatrix(table),base);
    }));

    sportResults.forEach((res,i)=>{
      if(res.status==="fulfilled" && res.value){
        const idx=next.sports.findIndex(s=>s.id===SHEETS.sports[i].id);
        if(idx>=0){
          next.sports[idx]=res.value;
          loadedSports++;
        }
      }
    });

    // Kalau semua tab gagal, jangan label fallback snapshot sebagai LIVE.
    if(loadedSports===0){
      throw new Error("Google Sheet tidak boleh dibaca. Semak General access: Anyone with the link → Viewer.");
    }

    // General schedule
    try{
      const table=await gviz(SHEETS.general);
      next.general=parseGeneral(tableMatrix(table),next.general,next.sports);
    }catch(_){}

    // Medal table: optional until urus setia creates a tab called PINGAT.
    try{
      const table=await gviz(SHEETS.medals,7000);
      next.medals=parseMedals(tableMatrix(table),next.medals);
    }catch(_){}

    return {
      data: next,
      loadedSports,
      totalSports: SHEETS.sports.length
    };
  }

  async function refresh({manual=false}={}){
    if(loading) return;
    loading=true;
    setStatus("Sedang membaca Google Sheet rasmi…",false,true);
    try{
      const liveResult=await buildLiveData();
      const data=liveResult.data;
      const fingerprint=JSON.stringify(data);
      const changed=fingerprint!==lastFingerprint;
      lastFingerprint=fingerprint;
      if(changed){
        window.SUKNA_MATCH_DATA=data;
        window.dispatchEvent(new CustomEvent("sukna:data-updated",{detail:data}));
      }
      const time=new Date().toLocaleTimeString("ms-MY",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
      setStatus(`LIVE ${liveResult.loadedSports}/${liveResult.totalSports} tab · ${BUILD} · dikemas kini ${time}`,true,false);
    }catch(err){
      console.error("SUKNA live data:",err);
      setStatus(`TIDAK LIVE · ${BUILD} · Google Sheet gagal dibaca · sedang guna snapshot terakhir`,false,false);
    }finally{
      loading=false;
    }
  }

  document.getElementById("refreshLiveBtn")?.addEventListener("click",()=>refresh({manual:true}));
  setTimeout(()=>refresh(),150);
  setInterval(()=>refresh(),REFRESH_MS);

  window.SUKNA_REFRESH_LIVE=refresh;
})();