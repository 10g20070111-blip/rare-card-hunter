const CACHE='rare-card-hunter-v20';
const ASSETS=['./','./index.html','./style.css','./app.js','./manifest.json','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('rare-card-hunter-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==location.origin)return;
 const isPage=event.request.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname.endsWith('/');
 const isAppAsset=/\.(?:js|css|json|svg)$/.test(url.pathname);
 if(!isPage&&!isAppAsset)return;
 event.respondWith((async()=>{
  try{const response=await fetch(event.request,{cache:'no-cache'});if(response.ok){const cache=await caches.open(CACHE);cache.put(event.request,response.clone());}return response;}
  catch(error){const cached=await caches.match(event.request)||await caches.match('./index.html');if(cached)return cached;throw error;}
 })());
});
