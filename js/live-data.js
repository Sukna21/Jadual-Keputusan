(() => {
  "use strict";

  const BUILD = "portal-v7";
  const REFRESH_MS = 30000;
  const cfg = window.SUKNA_LIVE_CONFIG || {};
  const endpoint = String(cfg.appsScriptUrl || "").trim();
  const fallback = JSON.parse(JSON.stringify(window.SUKNA_MATCH_DATA || {}));

  let loading=false;
  let lastFingerprint="";

  function setStatus(text,ok=false,busy=false){
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

  function jsonp(url){
    return new Promise((resolve,reject)=>{
      const cb="__sukna_api_"+Math.random().toString(36).slice(2);
      const script=document.createElement("script");
      let timer;

      const cleanup=()=>{
        if(timer) clearTimeout(timer);
        script.remove();
        try{delete window[cb]}catch(_){}
      };

      window[cb]=(payload)=>{
        cleanup();
        resolve(payload);
      };

      script.onerror=()=>{
        cleanup();
        reject(new Error("Apps Script API gagal dimuat"));
      };

      timer=setTimeout(()=>{
        cleanup();
        reject(new Error("Apps Script API timeout"));
      },15000);

      const join=url.includes("?") ? "&" : "?";
      script.src=url+join+"callback="+encodeURIComponent(cb)+"&_="+Date.now();
      document.body.appendChild(script);
    });
  }

  function mergePayload(payload){
    const next=JSON.parse(JSON.stringify(fallback));

    if(Array.isArray(payload.sports)){
      payload.sports.forEach(liveSport=>{
        const idx=next.sports.findIndex(s=>s.id===liveSport.id);
        if(idx<0) return;

        // Groups/bracket metadata stay from snapshot.
        next.sports[idx]={
          ...next.sports[idx],
          ...liveSport,
          groups:next.sports[idx].groups || []
        };
      });
    }

    if(Array.isArray(payload.medals) && payload.medals.length){
      next.medals=payload.medals;
    }

    next.meta={
      ...(next.meta||{}),
      source:"Google Apps Script API",
      updated:payload.updated || new Date().toISOString()
    };

    return next;
  }

  async function refresh(){
    if(loading) return;

    if(!endpoint || endpoint.includes("PASTE_APPS_SCRIPT_EXEC_URL_HERE")){
      setStatus("API belum dikonfigurasi · masukkan URL Apps Script dalam js/live-config.js",false,false);
      return;
    }

    loading=true;
    setStatus("Sedang membaca API Google Sheet…",false,true);

    try{
      const payload=await jsonp(endpoint);

      if(!payload || payload.ok!==true){
        throw new Error(payload && payload.error ? payload.error : "Respons API tidak sah");
      }

      const data=mergePayload(payload);
      const fingerprint=JSON.stringify(data);

      if(fingerprint!==lastFingerprint){
        lastFingerprint=fingerprint;
        window.SUKNA_MATCH_DATA=data;
        window.dispatchEvent(new CustomEvent("sukna:data-updated",{detail:data}));
      }

      const count=(payload.sports||[]).length;
      const time=new Date().toLocaleTimeString("ms-MY",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
      setStatus(`API LIVE · ${payload.build || BUILD} · ${count} sukan · ${time}`,true,false);

    }catch(err){
      console.error("SUKNA Apps Script API:",err);
      setStatus(`TIDAK LIVE · ${BUILD} · ${err.message || err}`,false,false);
    }finally{
      loading=false;
    }
  }

  document.getElementById("refreshLiveBtn")?.addEventListener("click",refresh);

  setTimeout(refresh,150);
  setInterval(refresh,REFRESH_MS);

  window.SUKNA_REFRESH_LIVE=refresh;
})();