const CACHE="sukna-match-centre-20260915-venuefix1";
const CORE=["./","./index.html","./css/style.css","./js/config.js","./js/results.js","./manifest.webmanifest","./assets/sukna-mark.svg","./assets/mascot-fallback.svg","./assets/partners-fallback.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(u.hostname.includes("docs.google.com")||u.hostname.includes("spreadsheets.google.com")) return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request)));
});
