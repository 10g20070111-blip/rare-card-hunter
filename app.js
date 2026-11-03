const DB_NAME='rare-card-hunter',DB_VERSION=1;let db,cards=[],settings={message:'わたしたちはレアカードハンター！',bubble:true,characterSize:120,tone:'dawasa',character:null,background:null};let draft=null,lastOfficialReader='',editedImage=null,activeCollectionTab='registered',selectedCardId=null,sortKey='added',sortDirection='desc',searchQuery='';
const $=id=>document.getElementById(id);const req=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
function openDB(){return new Promise((ok,no)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('cards'))d.createObjectStore('cards',{keyPath:'id'});if(!d.objectStoreNames.contains('settings'))d.createObjectStore('settings',{keyPath:'key'})};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}function st(n,m='readonly'){return db.transaction(n,m).objectStore(n)}
async function load(){cards=await req(st('cards').getAll());const s=await req(st('settings').getAll());s.forEach(x=>settings[x.key]=x.value);settings.message??='わたしたちはレアカードハンター！';settings.bubble??=true;settings.characterSize??=120;settings.tone??='dawasa';paintHome();paintSettings()}
async function saveSetting(k,v){settings[k]=v;await req(st('settings','readwrite').put({key:k,value:v}))}async function saveCard(c){await req(st('cards','readwrite').put(c));await load()}
function show(id){document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id===id))}document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>show('home'));$('goRegister').onclick=()=>{show('register');resetRegister()};$('goWishlist').onclick=()=>{show('wishlist');activeCollectionTab='registered';searchQuery='';$('collectionSearch').value='';paintCollection()};$('goSettings').onclick=()=>{show('settings');paintSettings()};$('collectionGoRegister').onclick=()=>{show('register');resetRegister();$('officialSearchInput').value='';$('officialSearchResults').innerHTML='';$('officialSearchStatus').textContent=''};
function paintHome(){document.body.style.backgroundImage=settings.background?`linear-gradient(#171526aa,#171526dd),url('${settings.background}')`:'';document.body.style.backgroundSize='cover';document.body.style.backgroundAttachment='fixed';$('mainMessage').textContent=settings.message||'わたしたちはレアカードハンター！';$('cardCount').textContent=`登録カード ${cards.length}枚`;$('wishSummary').textContent=`購入予定 ${cards.filter(c=>c.wanted).length}種類`;const displaySize=Math.min(140,Math.max(70,Number(settings.characterSize)||120));$('character').style.width=displaySize+'px';$('character').style.height=Math.round(displaySize*1.15)+'px';$('character').innerHTML=settings.character?`<img src="${settings.character}" alt="ナビゲーター">`:'🐰';$('character').classList.toggle('has-image',!!settings.character);$('bubble').classList.toggle('hidden',!settings.bubble);$('bubble').textContent=phrase('ホームへようこそ！')}
function phrase(s){if(settings.tone==='ojou')return 'ごきげんよう！カード探しのお手伝いをいたしますわ。';if(settings.tone==='polite')return s.replace(/だわさ/g,'です').replace(/！/g,'。');if(settings.tone==='simple')return 'カードを登録してみよう！';return s.endsWith('だわさ')?s:s+'だわさ'}
function paintSettings(){$('settingMessage').value=settings.message||'';$('bubbleToggle').checked=!!settings.bubble;$('characterSize').value=settings.characterSize||120;$('sizeValue').textContent=(settings.characterSize||120)+'px';$('navigatorTone').value=settings.tone||'dawasa'}$('characterSize').oninput=e=>$('sizeValue').textContent=e.target.value+'px';
$('saveSettings').onclick=async()=>{await saveSetting('message',$('settingMessage').value.trim()||'わたしたちはレアカードハンター！');await saveSetting('bubble',$('bubbleToggle').checked);await saveSetting('characterSize',+$('characterSize').value);await saveSetting('tone',$('navigatorTone').value);paintHome();alert('設定を保存しました。')};
function resetRegister(){$('sourceUrl').value='';$('fetchStatus').textContent='';lastOfficialReader='';$('readerDiagnostics').hidden=true;$('previewPanel').hidden=true;$('editPanel').hidden=true;$('urlEntry').hidden=false;draft=null;editedImage=null;$('previewWanted').checked=false}
function validUrl(raw){try{const u=new URL(raw);const h=u.hostname.toLowerCase();if(u.protocol!=='https:')return null;if(h==='dm.takaratomy.co.jp'||h.endsWith('.dm.takaratomy.co.jp')||h==='dmwiki.net'||h.endsWith('.dmwiki.net'))return u;return null}catch{return null}}
function absUrl(src,base){try{return new URL(src,base).href}catch{return ''}}
function cleanText(s=''){return String(s).replace(/\\\\n/g,'\n').replace(/\r/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/<br\s*\/?>/gi,'\n').replace(/[\t ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').replace(/^[|\s]+|[|\s]+$/gm,'').trim()}
// Keep only the printed card rules, never the shop/product listings appended by the reader.
function cleanCardRules(raw=''){
 let s=String(raw||'').replace(/\r/g,'').replace(/\\n/g,'\n');
 s=s.split(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\s*)?(?:商品情報|同名カードが含まれる商品|関連カード|収録情報|カードのFAQ|よくある質問|FAQ|カード検索|トップページ)(?:\s|$)/m)[0];
 s=s.replace(/(?:^|\n)\s*\*\s*(?:&count=|https?:\/\/)/m,'');
 s=removeFlavorLabel(s);
 s=s.split('\n').map(x=>x.trim()).filter(x=>x&&!/^[-_]{3,}$/.test(x)&&!/^\*\s*(?:&count=|商品情報)/.test(x)).map(x=>x.replace(/^(?:\*|※)\s*(?=[^\s])/,'■ ').replace(/^(?:[-+]\s+)(?=.{2})/,'■ ')).join('\n');
 return cleanText(s);
}
// Preserve official ability bullets, including lines that lost their marker in HTML/Markdown conversion.
function normalizeRules(raw=''){
 let t=cleanCardRules(raw).replace(/\r/g,'');
 t=t.replace(/(?:^|\n)\s*(?:\*|※|■)\s*(?=\S)/g,'\n■ ')
  .replace(/(^|\n)\s*(?:\*|※|■|●|◆|▪|•)\s*/g,'$1■ ')
  .replace(/(^|\n)\s*[-+]\s+(?=\S)/g,'$1■ ');
 const ability=/^(?:ブロッカー|スピードアタッカー|スレイヤー|ガードマン|マッハファイター|ジャストダイバー|ワールド[・･]ブレイカー|[TWQ]?[・･]?ブレイカー|パワード[・･]ブレイカー|シールド[・･]トリガー(?:[・･]プラス)?|S[・･]トリガー(?:[・･]プラス)?|ニンジャ[・･]ストライク|革命チェンジ|侵略|超次元|EXライフ|G[・･]ストライク|チャージャー|セイバー|エスケープ|ハイパー化|メガ[・･]ラスト[・･]バースト|スマッシュ[・･]バースト|フシギバース|ムゲンクライム|アビスラッシュ|キリフダッシュ|マナドライブ|ファイナル革命|ラスト[・･]バースト)(?=\s|[（(：:]|$)/i;
 const lines=t.split('\n').map(x=>x.trim()).filter(Boolean);
 const out=[];
 for(const line of lines){
  if(/^■/.test(line)){out.push(line.replace(/^■\s*/,'■ '));continue;}
  if(ability.test(line)){out.push('■ '+line);continue;}
  // Do not invent bullets on continuation lines: only an explicit bullet or
  // an independently recognised keyword indicates a new printed ability.
  else out.push(line);
 }
 return removeFlavorLabel(out.join('\n').trim());
}
// A sentence-ending Japanese full stop is NOT an ability boundary.
// Keep the official list-item/paragraph boundaries and explicit printed bullets.
function decorateAbilitySymbols(raw=''){
 const text=normalizeRules(raw).replace(/\r/g,'');
 const chunks=text.split(/\n(?=\s*■\s*)/).map(x=>x.trim()).filter(Boolean);
 return chunks.map(chunk=>{
  let t=chunk.replace(/^\s*(?:■\s*)+/,'').replace(/^(?:🛡️?|⚡|☠️?|💨|⚔️?|🌊|✊)\s*/u,'');
  // Preserve internal line breaks, including multi-sentence explanations.
  if(/^ブロッカー(?=\s|[（(：:]|$)/.test(t))t='🔵 '+t;
  return '■ '+t;
 }).join('\n\n');
}
// Official reader data is split by its labelled sections, not guessed from ability words.
// Parse only the actual card body. Navigation has its own 商品情報 link; it is not a card product.
function cardBodyLines(raw=''){
 const lines=String(raw||'').replace(/\r/g,'').split('\n');
 const start=lines.findIndex(x=>/^\s*特殊能力\s*$/.test(x));
 return start<0?[]:lines.slice(start);
}
function isProductBoundary(line){
 const t=String(line||'').trim();
 return /商品情報|このカードのよくある質問|同名カードが含まれる商品|よくある質問|収録情報|関連カード|Twitter|Facebook|LINEで送る|シェア/.test(t)
  || /^(?:\s*[-*+]\s*)?\[?DM(?:\d{2}|RP|BD|EX|ART)[-\w ]/.test(t)
  || /^\s*\[!?Image\b/.test(t)
  || /^\s*#{1,6}\s/.test(t);
}
function officialSections(raw=''){
 const lines=cardBodyLines(raw);
 const flavorIndex=lines.findIndex(x=>/^\s*フレーバー(?:テキスト)?\s*$/.test(x));
 const ruleEnd=flavorIndex<0?lines.length:flavorIndex;
 const rules=[];
 for(let i=1;i<ruleEnd;i++){
  const t=lines[i].trim();if(isProductBoundary(t))break;
  if(!t||/^[-_*─]{3,}$/.test(t))continue;
  rules.push(t.replace(/^\*\s+/,'■ '));
 }
 const flavor=[];
 if(flavorIndex>=0)for(let i=flavorIndex+1;i<lines.length;i++){
  const t=lines[i].trim();
  // A bullet, even without a label, begins the page's product/navigation block.
  // Printed flavor is plain text, never Markdown list items or link markup.
  if(isProductBoundary(t)||/^\s*[-*+]\s+/.test(t)||/^\s*\[/.test(t))break;
  if(!t||/^[-_*─]{3,}$/.test(t))continue;
  flavor.push(t);
  if(flavor.join('').length>500)break;
 }
 return {rules:cleanText(rules.join('\n')),flavor:cleanText(flavor.join('\n'))};
}
// Collect products only after the card-specific 商品情報 section, never from global navigation.
function officialProductLinks(raw=''){
 const lines=String(raw||'').replace(/\r/g,'').split('\n');
 const start=lines.findIndex(x=>/^\s*(?:#{1,5}\s*)?(?:商品情報|同名カードが含まれる商品|収録商品)\s*$/.test(x));
 if(start<0)return [];
 const products=[],seen=new Set();
 const push=(name,url='')=>{
  name=cleanText(name).replace(/^[-*•]\s*/,'').trim();
  const code=normalizeProductCode(name);
  if(!name||!code)return;
  const key=code+'|'+name.replace(/\s+/g,'');
  if(seen.has(key))return;seen.add(key);products.push({name,url,image:''});
 };
 for(const line of lines.slice(start+1, start+90)){
  const t=line.trim();
  if(/^(?:#{1,5}\s*)?(?:よくある質問|関連カード|カードのFAQ|Twitter|Facebook|©|お問い合わせ)/.test(t))break;
  const links=[...line.matchAll(/\[([^\]]+)\]\((https:\/\/dm\.takaratomy\.co\.jp\/product\/[^)\s]+)\)/gi)];
  for(const m of links)push(m[1],m[2].split('#')[0]);
  // Plain-text product names are valid even when no product page exists.
  const plain=t.replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/^[-*•]\s*/,'');
  if(/^(?:DM(?:\d{1,2}|\d{2}[- ]?(?:RP|EX|SD|BD|SP)\d+|(?:EX|RP|BD|SD|ART|X)\s*[- ]?\d+)|DMART\s*[- ]?\d+|プロモ(?:限定)?カード)/i.test(plain))push(plain,links[0]?.[2]||'');
 }
 return products.slice(0,60);
}
// Resolve a product's main image through the official Worker; keep reader as fallback.
const productImageCache=new Map();
async function productImageFromOfficial(product){
 const key=product.url;
 if(!key)return '';
 if(productImageCache.has(key))return productImageCache.get(key);
 const task=(async()=>{
  try{
   const endpoint=new URL(getSearchApi());endpoint.searchParams.set('product',product.url);endpoint.searchParams.set('v','23121');
   const response=await fetch(endpoint.href,{signal:AbortSignal.timeout(12000)});
   if(response.ok){const data=await response.json();if(data.image&&data.selection!=='metadata'&&data.verifiedPackage)return data.image;}
  }catch{}
  return '';
 })();productImageCache.set(key,task);return task;
}
async function enrichProducts(card){
 const products=Array.isArray(card.products)?card.products:[];
 if(!products.length)return card;
 const unique=[...new Map(products.filter(p=>p?.name).map(p=>[(p.url||p.name).split('#')[0],p])).values()].slice(0,30);
 const result={...card,products:unique.map(p=>({...p,image:p.image||''}))};
 const queue=unique.map((p,i)=>({p,i})).filter(({p})=>p.url&&!p.legacyFallback&&!isPromotion(card.number,p)&&!p.image);
 let index=0;async function worker(){while(index<queue.length){const {p,i}=queue[index++];result.products[i].image=await productImageFromOfficial(p);if(typeof result.onProductImage==='function')result.onProductImage(result.products);}}
 await Promise.all(Array.from({length:Math.min(4,queue.length)},worker));return result;
}
function extractFlavor(raw=''){return officialSections(raw).flavor;}
function splitOfficialSections(raw=''){return officialSections(raw);}
function collectorFromOfficial(raw,url){
 const md=String(raw||'').replace(/\r/g,'');
 const lines=md.split('\n');
 const id=new URL(url).searchParams.get('id')||'';
 const set=(id.match(/^dm((?:\d{2}(?:ex|rp|bd|sd)\d+)|(?:art\d+)|(?:ex\d+))/i)||[])[1]?.toUpperCase()||'';
 const seg='(?:超|秘|PR|SP|SR|S|P|U|C|R|VR)?\\d+';
 const serial=new RegExp('('+seg+')\\s*[/／]\\s*('+seg+')','i');
 const full=new RegExp('(?:DM)?([A-Z]{0,5}\\d{2}(?:EX|RP|BD|SD)\\d+|ART\\d+|EX\\d+)\\s*[-:： ]*('+seg+'\\s*[/／]\\s*'+seg+')','i');
 const normalize=x=>String(x).replace(/／/g,'/').replace(/\s*\/\s*/g,'/').trim().toUpperCase();
 // Prioritize actual official card title; avoid accidental other card numbers from product lists.
 const headings=lines.filter(x=>/^(?:Title:|#{1,4}\s+|.*(?:コレクター番号|カード番号|収録番号))/.test(x)).slice(0,35);
 for(const line of headings){
  const m=line.match(full);if(m)return m[1].toUpperCase()+'  '+normalize(m[2]);
 }
 for(const line of lines.slice(0,90)){
  const m=line.match(full);if(m)return m[1].toUpperCase()+'  '+normalize(m[2]);
 }
 if(set)for(const line of headings){
  const m=line.match(serial);if(m)return set+'  '+normalize(m[0]);
 }
 return '';
}
function removeFlavorLabel(raw=''){
 return String(raw||'').split('\n').filter(x=>!/^\s*(?:#{1,5}\s*)?フレーバー(?:テキスト)?\s*$/.test(x.trim())).join('\n').replace(/(?:\n|^)\s*フレーバー\s*$/,'').trim();
}
function extractTextFromDom(doc){
 const labelRe=/(カードテキスト|テキスト|能力|カードの能力|効果)/;
 for(const el of [...doc.querySelectorAll('th,dt,strong,b,h2,h3,h4')]){
  if(!labelRe.test((el.textContent||'').trim()))continue;
  const candidates=[el.nextElementSibling,el.parentElement?.nextElementSibling,el.parentElement];
  for(const c of candidates){if(!c)continue;const t=cleanText(c.innerText||c.textContent||'');if(t&&t.length>8&&!labelRe.test(t.slice(0,20)))return t}
 }
 const rows=[...doc.querySelectorAll('tr')];
 for(const tr of rows){const cells=[...tr.querySelectorAll('th,td')];if(cells.length>=2&&labelRe.test(cells[0].textContent||'')){const t=cleanText(cells.slice(1).map(x=>x.innerText||x.textContent).join('\n'));if(t)return t}}
 return '';
}
function pageData(doc,url){
 const meta=(s)=>doc.querySelector(s)?.content||'';
 const title=doc.querySelector('h1')?.textContent?.trim()||meta('meta[property="og:title"]')||doc.title||'';
 const rows=[...doc.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('th,td')].map(x=>x.textContent.trim()).filter(Boolean)).filter(x=>x.length>1);
 const find=keys=>{for(const r of rows){for(let i=0;i<r.length-1;i++){if(keys.some(k=>r[i].replace(/[：: ]/g,'')===k))return r[i+1];}}return '';};
 let name=find(['カード名','名称'])||title.replace(/\s*[（(].*?[）)]\s*$/,'').replace(/\s*[|｜-].*$/,'').trim();
 let cost=find(['コスト'])||'';cost=(cost.match(/[0-9]+/)||[])[0]||cost;
 let number=find(['コレクター番号','カード番号','収録番号','No.']);
 let text=find(['カードテキスト','テキスト','能力'])||extractTextFromDom(doc);
 if(!text){const d=meta('meta[property="og:description"]')||meta('meta[name="description"]');if(d&&!/デュエル・マスターズのカードを集める/.test(d))text=cleanText(d)}
 let image=meta('meta[property="og:image"]')||meta('meta[name="twitter:image"]');
 if(!image){const im=[...doc.images].find(i=>/card|cards|cardimg|カード/i.test((i.getAttribute('src')||'')+' '+(i.getAttribute('alt')||'')));if(im)image=im.getAttribute('src')||im.src}
 const extras={type:find(['カードタイプ','種類']),civilization:find(['文明']),rarity:find(['レアリティ']),power:(()=>{const v=find(['パワー']);return /^(?:[0-9０-９]{3,6}[+＋]?|\*|∞|0)$/.test(v)?v:''})(),race:find(['種族'])};
 return{name,cost,number,text:cleanCardRules(text),image:absUrl(image,url),url,...extras};
}
function markdownData(md,url){
 const raw=String(md||'').replace(/\r/g,'');
 const lines=raw.split('\n').map(x=>x.trim());
 const joined=lines.join('\n');
 const labelNorm=s=>cleanText(s).replace(/^#+\s*/,'').replace(/[|]/g,'').trim();
 const labels={name:['カード名','名称','カード'],cost:['コスト'],number:['コレクター番号','カード番号','収録番号','カードNo.','No.'],text:['カードテキスト','テキスト','能力','カードの能力','効果']};
 const get=(keys)=>{
  for(let i=0;i<lines.length;i++){
   const line=lines[i].replace(/^\|\s*/,'').replace(/\s*\|$/,'').trim();
   const cells=line.split('|').map(x=>cleanText(x)).filter(Boolean);
   if(cells.length>=2&&keys.some(k=>labelNorm(cells[0]).includes(k)))return cleanText(cells.slice(1).join('\n'));
   const normalized=labelNorm(line);
   for(const k of keys){
    if(normalized===k||normalized===k+'：'){
     const block=[];
     for(let j=i+1;j<lines.length;j++){
      const x=lines[j].trim();if(!x) {if(block.length)break;continue;}
      if(/^#{1,4}\s/.test(x)||/^\|?\s*(カード名|コスト|文明|レアリティ|パワー|種族|収録情報|関連カード|画像|フレーバー|illus\.)\s*[：:|]/i.test(x))break;
      if(/^[-*_]{3,}$/.test(x))break;
      block.push(x.replace(/^[-*+]\s*/,''));
     }
     if(block.length)return cleanText(block.join('\n'));
    }
    const m=normalized.match(new RegExp('^'+k+'\\s*[：:]\\s*(.+)$'));
    if(m)return cleanText(m[1]);
   }
  }
  return '';
 };
 let title=get(['Title']);if(!title){const t=joined.match(/^#\s+(.+)$/m);title=t?.[1]||''}
 const name=get(labels.name)||title.replace(/^.*?:\s*/,'').replace(/\s*[（(].*?[）)].*$/,'').trim();
 let cost=get(labels.cost);cost=(cost.match(/[0-9]+/)||[])[0]||cost;
 const number=get(labels.number);
 let text=get(labels.text);
 // Jina Reader may render the official card text as a blockquote or a list without a field label.
 if(!text){
  const candidates=[];
  for(let i=0;i<lines.length;i++){
   const x=lines[i];
   if(/^\s*(?:>|[-*+]\s*)/.test(x)&&/(ブロッカー|マッハファイター|Ｔ?[・ ]?ブレイカー|このクリーチャー|召喚コスト|進化|攻撃する時|出た時|自分はゲームに勝つ)/.test(x))candidates.push(x.replace(/^\s*(?:>|[-*+]\s*)+/,'').trim());
  }
  if(candidates.length)text=cleanText(candidates.join('\n'));
 }
 // Last-resort description is accepted only when it looks like rules text, not the app/site description.
 if(!text){const d=get(['Description']);if(d&&!/デュエル・マスターズのカードを集める|カード詳細/.test(d))text=d}
 const imgs=[...joined.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g)].map(m=>({alt:m[1],url:m[2]}));
 const image=(imgs.find(x=>/card|カード|gorg|ゴルギ/i.test(x.alt+' '+x.url))||imgs.find(x=>!/logo|banner|icon/i.test(x.alt+' '+x.url))||{}).url||'';
 const collector=number||((title+' '+joined.slice(0,1500)).match(/(?:DM\d{2}[A-Z0-9-]*\s*)?(?:[0-9]{1,3}\/[0-9]{1,3}|S[0-9]+\/S[0-9]+)/i)||[])[0]||'';
 return {name,cost,number:collector,text:cleanCardRules(text),image,url};
}
const readerCache=new Map();
async function fetchReader(url){
 if(readerCache.has(url))return readerCache.get(url);
 const job=(async()=>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),6500);
  try{
   const response=await fetch('https://r.jina.ai/'+url,{method:'GET',mode:'cors',credentials:'omit',headers:{'Accept':'text/plain'},signal:controller.signal});
   if(!response.ok)throw Error('Reader HTTP '+response.status);
   return await response.text();
  }finally{clearTimeout(timeout);}
 })();
 readerCache.set(url,job);
 try{
  const result=await job;
  if(readerCache.size>180)readerCache.delete(readerCache.keys().next().value);
  return result;
 }catch(e){readerCache.delete(url);throw e;}
}

function officialCardImage(url){
 try{
  const u=new URL(url); if(u.hostname!=='dm.takaratomy.co.jp')return '';
  const id=u.searchParams.get('id'); if(!id || !/^[a-z0-9-]+$/i.test(id))return '';
  return `https://dm.takaratomy.co.jp/wp-content/card/cardimage/${encodeURIComponent(id)}.jpg`;
 }catch{return ''}
}
function legacyOfficialProducts(text,cardUrl){
 const source=String(text||'');
 const pos=source.lastIndexOf('同名カードが含まれる商品を表示');
 if(pos<0)return [];
 const block=source.slice(pos+('同名カードが含まれる商品を表示').length, pos+2000);
 const products=[],seen=new Set();
 for(const line of block.split(/\n/).slice(0,35)){
  const match=line.match(/(?:^|\s|\*)\s*(DM\s*[- ]?\s*(?:\d{1,2}|(?:EX|X|D|BD|RP|SD)\s*[- ]?\d{1,3}))\s+([^\n]{3,140})/i);
  if(!match)continue;
  const code=normalizeProductCode(match[1]);if(!code||seen.has(code))continue;
  seen.add(code);
  const name=(match[1]+' '+match[2]).replace(/\s*\[[^\]]+\]\([^)]*\)\s*/g,'').trim();
  // The official card page is a verifiable fallback when old products have no linked product page.
  products.push({name,url:'',image:'',legacyFallback:true});
 }
 return products;
}
function extractOfficialMarkdown(md,url){
 const lines=String(md||'').replace(/\r/g,'').split('\n');
 const heading=lines.find(x=>/^#{1,4}\s+/.test(x)&&/\((?:DM[A-Z0-9-]+\s+)?[^()]*\d+\/[^()]*\d+\)/i.test(x))
  ||lines.find(x=>/^Title:\s*/.test(x)&&/\(DM[A-Z0-9-]+/i.test(x))
  ||lines.find(x=>/^#{1,4}\s+/.test(x)&&/\(DM[A-Z0-9-]+/i.test(x))||'';
 const title=(heading.replace(/^(?:Title:|#{1,4})\s*/,'').split(/[（(]/)[0]||'').replace(/\s*[|｜]\s*デュエル・マスターズ.*$/,'').trim();
 const all=lines.join('\n');
 // Reader may put two metadata labels on one row: "カードの種類 | 呪文 | 文明 | ゼロ".
 const cells=lines.filter(x=>/\|/.test(x)).flatMap(x=>x.split('|').map(t=>t.trim()));
 const get=label=>{
  for(let i=0;i<cells.length-1;i++)if(cells[i]===label)return cells[i+1];
  const match=all.match(new RegExp('(?:^|\\n)\\s*'+label+'\\s*[：:]\\s*([^\\n]+)'));return match?.[1]?.trim()||'';
 };
 let sections=officialSections(md);
 if(!sections.rules){
  const m=String(md).match(/(?:^|\n)[^\n]{0,24}特殊能力[^\n]*\n([\s\S]*?)(?=\n[^\n]{0,12}フレーバー|\n[^\n]{0,12}商品情報|\n[^\n]{0,30}同名カードが含まれる商品|$)/);
  if(m){const rules=m[1].split('\n').filter(x=>x.trim()&&!/^[-_*─]{3,}$/.test(x.trim())).join('\n');sections={...sections,rules};}
 }

 const officialPowerRaw=get('パワー');
 const officialPower=/^(?:[0-9０-９]{3,6}(?:\+|＋)?|\*|∞|0)$/.test(officialPowerRaw.trim())?officialPowerRaw.trim():'';
 const number=collectorFromOfficial(md,url)||((heading.match(/[（(]\s*(DM[^)）]+)[)）]/i)||[])[1]||'').trim();
 return {name:title,cost:(get('コスト').match(/\d+/)||[])[0]||'',number,
 text:normalizeRules(sections.rules),flavor:sections.flavor||'',products:(()=>{const links=officialProductLinks(md),old=legacyOfficialProducts(md,url);const merged=new Map();for(const x of [...links,...old]){const k=normalizeProductCode(x.name)||x.name;if(!merged.has(k)||(!merged.get(k).url&&x.url))merged.set(k,x)}return [...merged.values()]})(),
 image:officialCardImage(url),url,type:get('カードの種類'),civilization:get('文明'),
 rarity:get('レアリティ'),power:officialPower,race:get('種族')};
}
function extractWikiOnlyCardText(md){
 const lines=String(md||'').replace(/\r/g,'').split('\n');
 const stop=/^(解説|評価|環境|関連カード|収録|フレーバー|備考|余談|デッキ|プレイング|元ネタ|参考|外部リンク|FAQ)/;
 // Prefer a clearly labelled card text/effect section and stop before strategy or commentary sections.
 let start=lines.findIndex(x=>/^(?:#{1,5}\s*)?(カードテキスト|能力|効果|テキスト)\s*[:：]?\s*$/.test(x.trim()));
 if(start<0){
  start=lines.findIndex(x=>/^(?:#{1,5}\s*)?(カードの効果|能力欄)\s*[:：]?\s*$/.test(x.trim()));
 }
 if(start<0)return '';
 const out=[];
 for(let i=start+1;i<lines.length;i++){
  const x=lines[i].trim();
  if(stop.test(x.replace(/^#+\s*/,'')))break;
  if(/^#{1,5}\s/.test(x) && out.length)break;
  if(!x || /^[-*_]{3,}$/.test(x))continue;
  if(/(このカード|このクリーチャー|ブロッカー|スピードアタッカー|マッハファイター|シールド|コスト)/.test(x)){
   out.push(x.replace(/^>\s*/,'').replace(/^[-*+]\s*/,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').trim());
  }
 }
 return cleanText(out.join('\n'));
}

// Official card details are fetched through our Worker, avoiding dependence on Jina Reader.
async function fetchOfficialDetailHtml(url){
 const id=new URL(url).searchParams.get('id');
 if(!id||!/^[\w-]+$/.test(id))throw Error('公式カードIDが不正です');
 const endpoint=new URL(getSearchApi());endpoint.searchParams.set('detail',id);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
 try{const response=await fetch(endpoint,{signal:controller.signal,cache:'no-store'});
  if(!response.ok)throw Error('公式詳細取得 HTTP '+response.status);
  const result=await response.json();if(!result.html)throw Error(result.error||'公式詳細ページが空です');
  return result.html;
 }finally{clearTimeout(timer)}
}
// v2.31.16: Read flavor from the actual labelled card fields, including both
// faces of a twinpact. Never infer flavor from ordinary ability paragraphs.
function officialFlavorFromHtml(doc){
 const labels=/^フレーバー(?:[・\s　]*テキスト)?\s*[：:]?\s*$/;
 const stop=/^(?:特殊能力|カード情報|商品情報|収録情報|関連カード|よくある質問|このカードのよくある質問|同名カードが含まれる商品|カード名|カードタイプ|文明|種族|コスト|パワー|レアリティ|イラスト|illus\.?|フレーバー(?:[・\s　]*テキスト)?)\s*[：:]?/i;
 const tidy=s=>String(s||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n').trim();
 const results=[];
 const push=s=>{s=tidy(s).replace(/^[-─―ー\s]+$/,'').trim();if(s&&s.length<=650&&!results.includes(s))results.push(s)};
 // DOM field values are more trustworthy than page-wide regex matches.
 const labelsFound=[...doc.querySelectorAll('dt,th,strong,b,h2,h3,h4,span,p,div')]
  .filter(n=>n.children.length===0&&labels.test(tidy(n.textContent)));
 for(const label of labelsFound){
  let value='';
  if(label.matches('dt,th'))value=label.nextElementSibling?.textContent||'';
  if(!value&&label.parentElement){
   const parent=label.parentElement;
   if(parent.children.length<=5){
    const clone=parent.cloneNode(true);
    const counterpart=[...clone.querySelectorAll('*')].find(x=>x.children.length===0&&labels.test(tidy(x.textContent)));
    counterpart?.remove();
    value=clone.textContent||'';
   }
  }
  if(!value){let next=label.nextElementSibling; if(next&&!stop.test(tidy(next.textContent).slice(0,40)))value=next.textContent||'';}
  value=tidy(value);
  if(value&&!stop.test(value.slice(0,40)))push(value);
 }
 // The HTML can put the label and text in one node, or use line breaks.
 const root=doc.querySelector('main')||doc.body;
 if(root){
  const clone=root.cloneNode(true);
  clone.querySelectorAll('script,style,nav,header,footer').forEach(n=>n.remove());
  clone.querySelectorAll('br').forEach(n=>n.replaceWith('\n'));
  clone.querySelectorAll('p,li,dt,dd,th,td,h2,h3,h4').forEach(n=>n.append('\n'));
  const lines=(clone.textContent||'').split(/\n/).map(tidy).filter(Boolean);
  for(let i=0;i<lines.length;i++){
   const line=lines[i];
   const inline=line.match(/^フレーバー(?:[・\s　]*テキスト)?\s*[：:]\s*(.+)$/);
   if(inline){push(inline[1]);continue;}
   if(!labels.test(line))continue;
   const parts=[];
   for(let j=i+1;j<lines.length&&j<=i+8;j++){
    const next=lines[j];
    if(stop.test(next)||/^(?:DM\d{2}|DMRP|DMEX|DMBD|DMART)[-\s]/i.test(next))break;
    if(/^[―─ー\-\s]+$/.test(next))continue;
    parts.push(next);
    if(parts.join('').length>650)break;
   }
   if(parts.length)push(parts.join('\n'));
  }
 }
 return results.join('\n\n').slice(0,1200);
}
function officialHtmlDetails(html,url){
 const doc=new DOMParser().parseFromString(html,'text/html');
 doc.querySelectorAll('script,style,svg,noscript,header,footer,nav').forEach(n=>n.remove());
 // Prefer the smallest card-detail container that holds both the abilities and flavor label.
 const nodes=[...doc.querySelectorAll('main,article,section,div')].filter(n=>/特殊能力/.test(n.textContent||'')&&/フレーバー/.test(n.textContent||''));
 const root=nodes.sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length)[0]||doc.body;
 const copy=root.cloneNode(true);
 copy.querySelectorAll('br').forEach(n=>n.replaceWith(doc.createTextNode('\n')));
 copy.querySelectorAll('li,p,h1,h2,h3,h4,dt,dd,tr').forEach(n=>n.appendChild(doc.createTextNode('\n')));
 const text=(copy.textContent||'').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n[ \t]*/g,'\n');
 const part=text.match(/フレーバー(?:テキスト)?\s*\n?\s*(?:[-─]{2,}\s*)?([\s\S]*?)(?=\s*(?:商品情報|このカードのよくある質問|同名カードが含まれる商品|関連カード|よくある質問|$))/);
 const flavor=officialFlavorFromHtml(doc)||(part?.[1]||'').split('\n').map(x=>x.trim()).filter(Boolean).filter(x=>!/^[-─]{2,}$/.test(x)).join(' ').trim();
 // Only official product URLs; these can include same-name reprint products.
 const products=[],seen=new Set();
 for(const a of doc.querySelectorAll('a[href]')){
  const href=new URL(a.getAttribute('href'),url);
  if(href.hostname!=='dm.takaratomy.co.jp'||!/^\/product\//.test(href.pathname))continue;
  const name=(a.textContent||'').replace(/\s+/g,' ').trim();
  if(!name||name==='商品情報'||!/^DM(?:[- ]?\d{1,2}|[A-Z]{1,4}[- ]?\d{1,3})/i.test(name)||seen.has(href.href))continue;
  seen.add(href.href);products.push({name,url:href.href,image:''});
 }
 const fallback=legacyOfficialProducts(doc.body?.textContent||'',url);
 const productSection=(doc.body?.textContent||'').split('同名カードが含まれる商品を表示').pop()||'';
 for(const line of productSection.split(/\n/).slice(0,75)){const name=line.replace(/\s+/g,' ').trim();if(/^(?:DM(?:R|EX|BD|ART|\d{2})[- ]?\d*|プロモ限定カード)/i.test(name)&&name.length<180)fallback.push({name,url:'',image:'',legacyFallback:true});}
 const merged=new Map();for(const p of [...products,...fallback]){const k=normalizeProductCode(p.name)||p.name;if(!merged.has(k)||(!merged.get(k).url&&p.url))merged.set(k,p);}
 return {flavor:flavor.length<=1200?flavor:'',products:[...merged.values()].slice(0,60)};
}
$('fetchPage').onclick=async()=>{
 const url=validUrl($('sourceUrl').value.trim());
 if(!url){$('fetchStatus').textContent='公式サイトまたはdmwiki.netのHTTPSカード詳細URLを入力してください。';return}
 $('fetchPage').disabled=true;$('fetchStatus').textContent='外部読み取りサービス経由でカードページを解析しています…';
 try{
  const isOfficialSource=url.hostname==='dm.takaratomy.co.jp';let body;let officialExtra=null;
  if(isOfficialSource){
   const [reader,official]=await Promise.allSettled([fetchReader(url.href),fetchOfficialDetailHtml(url.href)]);
   if(reader.status==='fulfilled')body=reader.value;
   else if(official.status==='fulfilled')body=official.value;
   else throw Error('公式ページを取得できませんでした');
   if(official.status==='fulfilled')officialExtra=officialHtmlDetails(official.value,url.href);
  }else{body=await fetchReader(url.href);}
  lastOfficialReader=body;$('readerDiagnostics').hidden=false;
  let parsed;
  const isOfficial=url.hostname==='dm.takaratomy.co.jp';
  if(/<html[\s>]/i.test(body)){const doc=new DOMParser().parseFromString(body,'text/html');parsed=pageData(doc,url.href);if(isOfficial){const specific=extractOfficialMarkdown(doc.body?.innerText||doc.body?.textContent||'',url.href);parsed={...parsed,...Object.fromEntries(Object.entries(specific).filter(([k,v])=>v)),text:specific.text||parsed.text||'',flavor:specific.flavor||''};}}
  else {parsed=markdownData(body,url.href);if(isOfficial){const specific=extractOfficialMarkdown(body,url.href);parsed={...parsed,...Object.fromEntries(Object.entries(specific).filter(([k,v])=>v)),text:specific.text||parsed.text||'',flavor:specific.flavor||''};}else{const wikiText=extractWikiOnlyCardText(body);if(wikiText)parsed.text=wikiText;}}
  if(isOfficial&&officialExtra){if(officialExtra.flavor)parsed.flavor=officialExtra.flavor;if(officialExtra.products.length){const all=[...(parsed.products||[]),...officialExtra.products];const merged=new Map();for(const x of all){const k=normalizeProductCode(x.name)||x.name;if(!merged.has(k)||(!merged.get(k).url&&x.url))merged.set(k,x);}parsed.products=[...merged.values()];}}
  if(isOfficial){
   // Some official titles carry a set/serial identifier not recognized by the older parser.
   const titleNumber=(String(body).match(/(?:^|\n)\s*(?:Title:|#{1,4}\s*)?[^\n]{1,120}?[（(]\s*(DM[A-Z0-9-]+\s+[^)（）]{1,35})\s*[)）]/i)||[])[1]||'';
   if(!parsed.number&&titleNumber)parsed.number=titleNumber.trim();
  }

  if(isOfficial){const exactImage=officialCardImage(url.href);if(exactImage)parsed.image=exactImage;}
  if(!parsed.name&&!parsed.text&&!parsed.image&&!parsed.cost&&!parsed.number)throw Error('ページからカード情報を抽出できませんでした');
  draft={...parsed,text:normalizeRules(parsed.text),flavor:isOfficial?(parsed.flavor||''):(parsed.flavor||extractFlavor(body)),url:url.href};renderPreview();if(isOfficial&&draft.products?.length){enrichProducts(draft).then(updated=>{if(draft?.url===updated.url){draft.products=updated.products;renderProductInfo('previewProducts',draft.products,draft.number,draft.url)}}).catch(()=>{});}requestAnimationFrame(()=>$('previewPanel').scrollIntoView({behavior:'smooth',block:'start'}));
  const missing=[];if(!draft.name)missing.push('カード名');if(!draft.cost)missing.push('コスト');if(!draft.number)missing.push('コレクター番号');if(!draft.text)missing.push('テキスト');if(!draft.image)missing.push('画像');
  $('fetchStatus').textContent=missing.length?'一部の情報を取得できませんでした（'+missing.join('・')+'）。「編集する」から補完できます。':'カード情報を取得しました。内容を確認してください。';
 }catch(e){$('fetchStatus').textContent='自動取得に失敗しました。通信制限、外部読み取りサービスの応答、またはページ形式が原因の可能性があります。時間をおいて再試行するか、「編集する」から入力してください。';}
 finally{$('fetchPage').disabled=false}
};
$('readerDiagnostics').onclick=()=>{if(!lastOfficialReader)return;const blob=new Blob([lastOfficialReader],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rare-card-hunter-reader-diagnostics.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)};
function raceMarkup(value=''){return escapeHtml(value).replace(/\s*\/\s*/g,'<wbr>/') }
function displayNameWithoutNumber(name='',number=''){
 let n=String(name||'').trim();const v=String(number||'').trim();
 if(!v)return n;
 // Remove only the exact collector-number suffix if it was stored in the card name.
 for(const pair of [['（','）'],['(',')']]){
  const suffix=pair[0]+v+pair[1];if(n.endsWith(suffix))return n.slice(0,-suffix.length).trim();
 }
 return n;
}
function normalizeProductCode(value=''){
 const v=String(value||'').normalize('NFKC').toUpperCase().replace(/[‐‑‒–—−ー－]/g,'-');
 // Modern: DM26-RP3, DM26SD1, DM24-EX1, DMEX-19.
 let m=v.match(/DM\s*[- ]?\s*(\d{2})\s*[- ]?\s*(RP|EX|SD|BD|SP|ART|P|R)\s*[- ]?\s*(\d{1,4})/);
 if(m)return 'DM'+m[1]+m[2]+String(Number(m[3]));
 m=v.match(/DM\s*[- ]?\s*(RP|EX|SD|BD|SP|ART|X|D|P)\s*[- ]?\s*(\d{1,4})/);
 if(m)return 'DM'+m[1]+String(Number(m[2]));
 m=v.match(/DMART\s*[- ]?\s*(\d{1,3})/);if(m)return 'DMART'+Number(m[1]);
 m=v.match(/DMART\s*[- ]?\s*(\d{1,3})/);if(m)return 'DMART'+Number(m[1]);
 // Legacy DMR-21 / DMR21 series (distinct from DM-21).
 m=v.match(/DMR\s*[- ]?\s*(\d{1,3})(?!\d)/);if(m)return 'DMR'+Number(m[1]);
 // Original DM-01 to DM-39 and later legacy sets.
 m=v.match(/DM\s*[- ]?\s*(\d{1,2})(?!\d|[A-Z])/);
 if(m)return 'DM'+String(Number(m[1]));
 return '';
}
function codeFromCollector(number=''){return normalizeProductCode(number)}
function codeFromProduct(product){
 const fromName=normalizeProductCode(product.name||'');
 if(fromName)return fromName;
 try{const u=new URL(product.url);return normalizeProductCode(decodeURIComponent(u.pathname))}catch{return ''}
}
function isPromoVersion(number=''){
 const n=String(number||'').normalize('NFKC').toUpperCase().replace(/\s+/g,'');
 return /(?:^|[- ])(?:PROMO|PR|P\d{1,4}[A-Z]?\/|PROMOY?\d{2})/.test(n)||/^PROMO/.test(n);
}
function productCategory(product={}){
 const n=String(product.name||'')+' '+String(product.url||'');
 if(/神アート|kamiart|DMART/i.test(n))return 'art';
 if(/プロモ|プロモーション|参加賞|配布|限定特典|付録|景品|PRカード/i.test(n))return 'promo';
 return 'pack';
}
function isPromotion(number='',product={}){return productCategory(product)==='promo';}
function versionMatchesProduct(number='',product={}){
 const c=codeFromCollector(number),p=codeFromProduct(product);
 return !!(c&&p&&c===p);
}
function renderProductInfo(target,products,collectorNumber='',cardUrl=''){
 const el=$(target);if(!el)return;
 const data=Array.isArray(products)?products.filter(p=>p&&p.name):[];
 const source=cardUrl||data.find(p=>p.url)?.url||'';
 const groups={pack:[],art:[],promo:[]};
 const code=codeFromCollector(collectorNumber),promo=isPromoVersion(collectorNumber);
 const hasExact=data.some(p=>versionMatchesProduct(collectorNumber,p));
 function tile(p,cat,match=false){
  const url=/^https:\/\/dm\.takaratomy\.co\.jp\//.test(p.url||'')?p.url:'';
  const tag=url?'a':'div';const attrs=url?` href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer"`:'';
  const picture=cat==='promo'?'<div class="pack-image-placeholder pack-promo-placeholder">プロモーションカード</div>':p.image?`<img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'pack-image-placeholder',textContent:'商品画像を取得できません'}))">`:`<div class="pack-image-placeholder">${cat==='art'?'神アート':p.legacyFallback?'旧商品・画像未登録':'商品画像なし'}</div>`;
  return `<${tag} class="pack-item${match?' pack-item-matched':''}"${attrs}>${match?'<strong class="pack-match-label">このバージョンの収録商品</strong>':''}${picture}<span>${escapeHtml(p.name)}</span></${tag}>`;
 }
 for(const p of data){const cat=productCategory(p);groups[cat].push(tile(p,cat,versionMatchesProduct(collectorNumber,p)));}
 if(!hasExact&&code){
  const cat=/DMART/.test(code)?'art':'pack';
  groups[cat].unshift(tile({name:`${code}（コレクター番号と一致・商品名未確認）`,url:'',legacyFallback:true},cat,true));
 }
 if(promo&&!data.some(p=>productCategory(p)==='promo')){
  groups.promo.unshift(tile({name:`プロモーション版（${collectorNumber||'番号不明'}）・配布元未確認`,url:source},'promo',true));
 }
 if(!data.length&&!code&&!promo){el.innerHTML='<p class="hint">公式ページから収録商品を確認できませんでした。</p>';return;}
 el.innerHTML=[['pack','収録商品・拡張パック'],['art','神アート'],['promo','プロモーション']].filter(([key])=>groups[key].length).map(([key,title])=>`<section class="product-category"><h3>${title}</h3><div class="pack-grid">${groups[key].join('')}</div></section>`).join('');
}
function renderPreview(){$('urlEntry').hidden=true;$('previewPanel').hidden=false;$('editPanel').hidden=true;$('previewName').innerHTML=escapeHtml(displayNameWithoutNumber(draft.name,draft.number)||'カード名を取得できません')+(draft.number?' <small class="name-number">('+escapeHtml(draft.number)+')</small>':'');$('previewCost').textContent=draft.cost||'—';$('previewNumber').textContent=draft.number||'—';$('previewText').textContent=decorateAbilitySymbols(draft.text)||'—';$('previewFlavor').textContent=draft.flavor||'—';renderProductInfo('previewProducts',draft.products,draft.number,draft.url);$('previewImage').innerHTML=draft.image?`<img src="${escapeAttr(draft.image)}" alt="カード画像" onerror="this.parentElement.textContent='画像を表示できません'">`:'画像なし';const extras=[['カードタイプ',draft.type],['文明',draft.civilization],['レアリティ',draft.rarity],['パワー',draft.power||'—'],['種族',draft.race]].filter(x=>x[1]);$('previewExtra').innerHTML=extras.map(([k,v])=>`<div class="${k==='種族'?'race-wide':''}"><dt>${k}</dt><dd>${k==='種族'?raceMarkup(v):escapeHtml(v)}</dd></div>`).join('');$('sourceNotice').textContent='取得元：'+draft.url}
function escapeAttr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
$('editPreview').onclick=()=>{$('editPanel').hidden=false;$('previewPanel').hidden=true;$('editName').value=draft.name;$('editCost').value=draft.cost;$('editNumber').value=draft.number;$('editType').value=draft.type||'';$('editCivilization').value=draft.civilization||'';$('editRarity').value=draft.rarity||'';$('editPower').value=draft.power||'';$('editRace').value=draft.race||'';$('editText').value=draft.text;$('editFlavor').value=draft.flavor||'';$('editImageUrl').value=draft.image;$('editImagePreview').innerHTML=draft.image?`<img src="${escapeAttr(draft.image)}">`:''};$('backToPreview').onclick=renderPreview;
$('editImageFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;editedImage=await imageData(f);$('editImagePreview').innerHTML=`<img src="${editedImage}">`};$('applyEdit').onclick=()=>{draft.name=$('editName').value.trim();draft.cost=$('editCost').value.trim();draft.number=$('editNumber').value.trim();draft.type=$('editType').value.trim();draft.civilization=$('editCivilization').value.trim();draft.rarity=$('editRarity').value.trim();draft.power=$('editPower').value.trim();draft.race=$('editRace').value.trim();draft.text=normalizeRules($('editText').value);draft.flavor=$('editFlavor').value.trim();draft.image=$('editImageUrl').value.trim();if(editedImage)draft.image=editedImage;renderPreview()};
$('cancelPreview').onclick=()=>{if(confirm('取得した内容を破棄しますか？'))resetRegister()};$('confirmSave').onclick=async()=>{if(!draft?.name){alert('カード名がありません。「編集する」からカード名を入力してください。');return}const c={id:crypto.randomUUID(),name:draft.name,cost:draft.cost,number:draft.number,text:normalizeRules(draft.text),flavor:draft.flavor||'',image:draft.image||null,url:draft.url,type:draft.type||'',civilization:draft.civilization||'',rarity:draft.rarity||'',power:draft.power||'',race:draft.race||'',products:draft.products||[],owned:0,wanted:$('previewWanted').checked,wantQty:1,createdAt:new Date().toISOString()};await saveCard(c);alert('カードを登録しました！');show('home');resetRegister()};
function imageData(file){return new Promise((ok,no)=>{if(!file.type.startsWith('image/'))return no(Error('画像ファイルを選択してください'));const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const cv=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(im.width,im.height));cv.width=im.width*scale;cv.height=im.height*scale;cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);ok(cv.toDataURL('image/jpeg',.82))};im.onerror=no;im.src=r.result};r.onerror=no;r.readAsDataURL(file)})}
$('backgroundFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{await saveSetting('background',await imageData(f));paintHome();alert('背景画像を設定しました。')}catch(err){alert(err.message)}};$('clearBackground').onclick=async()=>{await saveSetting('background',null);paintHome();alert('背景画像を解除しました。')};
$('characterFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{await saveSetting('character',await imageData(f));paintHome()}catch(err){alert(err.message)}};
function civilizationRanks(value=''){
 const order=['火','水','闇','光','自然','無色'];
 const found=order.filter(x=>String(value).includes(x));
 return found.length?found.map(x=>order.indexOf(x)):[5];
}
function compareCivilization(a,b){
 const aa=civilizationRanks(a.civilization),bb=civilizationRanks(b.civilization);
 for(let i=0;i<Math.max(aa.length,bb.length);i++){const av=aa[i]??-1,bv=bb[i]??-1;if(av!==bv)return av-bv;}
 return 0;
}
function sortedCards(list){
 const arr=[...list];
 if(sortKey==='civilization')return arr.sort(compareCivilization);
 const sign=sortDirection==='asc'?1:-1;
 return arr.sort((a,b)=>{
  let result=0;
  if(sortKey==='cost')result=(Number.parseInt(a.cost,10)||0)-(Number.parseInt(b.cost,10)||0);
  else if(sortKey==='name')result=String(a.name||'').localeCompare(String(b.name||''),'ja');
  else result=String(a.createdAt||'').localeCompare(String(b.createdAt||''));
  return result*sign;
 });
}
function paintCollection(){
 $('collectionItems').hidden=false;$('cardDetail').hidden=true;
 $('tabRegistered').classList.toggle('active',activeCollectionTab==='registered');$('tabWishlist').classList.toggle('active',activeCollectionTab==='wishlist');
 $('registeredCount').textContent=cards.length;$('wishlistCount').textContent=cards.filter(c=>c.wanted).length;
 const controls=$('collectionControls');controls.hidden=activeCollectionTab!=='registered';
 const query=searchQuery.trim().toLocaleLowerCase();
 let list=activeCollectionTab==='wishlist'?cards.filter(c=>c.wanted):cards;
 if(query)list=list.filter(c=>[c.name,c.cost,c.number,c.text,c.type,c.civilization,c.rarity,c.power,c.race].some(v=>String(v||'').toLocaleLowerCase().includes(query)));
 if(activeCollectionTab==='registered')list=sortedCards(list);
 $('sortOrder').value=sortKey;$('sortAsc').classList.toggle('selected',sortDirection==='asc');$('sortDesc').classList.toggle('selected',sortDirection==='desc');
 $('sortAsc').disabled=sortKey==='civilization';$('sortDesc').disabled=sortKey==='civilization';
 $('collectionItems').innerHTML=list.length?list.map(c=>`<button class="collection-card" data-open-card="${escapeAttr(c.id)}"><span class="collection-thumb">${c.image?`<img src="${escapeAttr(c.image)}" alt="">`:'画像なし'}</span><span class="collection-info"><b>${escapeHtml(c.name)}</b><small>コスト：${escapeHtml(c.cost||'—')}　／　番号：${escapeHtml(c.number||'—')}</small><small>${c.wanted?'♡ 購入予定':'登録済み'}</small></span><span class="chevron">›</span></button>`).join(''):'<div class="empty">'+(query?'該当するカードはありません。検索語を変えてみてください。':(activeCollectionTab==='wishlist'?'購入予定のカードはありません。登録したカードの詳細から追加できます。':'登録したカードはまだありません。カードを登録してみましょう。'))+'</div>';
 document.querySelectorAll('[data-open-card]').forEach(b=>b.onclick=()=>openCardDetail(b.dataset.openCard));
}
$('collectionSearch').oninput=e=>{searchQuery=e.target.value;paintCollection()};
$('sortOrder').onchange=e=>{sortKey=e.target.value;paintCollection()};
$('sortAsc').onclick=()=>{if(sortKey==='civilization')return;sortDirection='asc';paintCollection()};
$('sortDesc').onclick=()=>{if(sortKey==='civilization')return;sortDirection='desc';paintCollection()};
$('tabRegistered').onclick=()=>{activeCollectionTab='registered';paintCollection()};$('tabWishlist').onclick=()=>{activeCollectionTab='wishlist';paintCollection()};
$('backToCollection').onclick=()=>{selectedCardId=null;paintCollection()};
function openCardDetail(id){const c=cards.find(x=>x.id===id);if(!c)return;selectedCardId=id;$('collectionItems').hidden=true;$('cardDetail').hidden=false;
 const rows=[['コスト',c.cost],['コレクター番号',c.number],['カードタイプ',c.type],['文明',c.civilization],['レアリティ',c.rarity],['パワー',c.power||'—'],['種族',c.race]];
 $('detailContent').innerHTML=`<h2>${escapeHtml(displayNameWithoutNumber(c.name,c.number))}${c.number?` <small class="name-number">(${escapeHtml(c.number)})</small>`:''}</h2><div class="detail-layout"><div class="detail-image">${c.image?`<img src="${escapeAttr(c.image)}" alt="${escapeAttr(c.name)}">`:'画像なし'}</div><dl class="detail-data">${rows.map(([k,v])=>v?`<div class="${k==='種族'?'race-wide':''}"><dt>${k}</dt><dd>${k==='種族'?raceMarkup(v):escapeHtml(v)}</dd></div>`:'').join('')}</dl></div><section class="detail-text"><b>カードテキスト</b><p>${escapeHtml(decorateAbilitySymbols(c.text)||'—')}</p></section>${c.flavor?`<section class="detail-text"><b>フレーバー</b><p>${escapeHtml(c.flavor)}</p></section>`:''}<section class="detail-text"><b>商品情報</b><div id="detailProducts" class="pack-grid"></div></section><p class="hint">取得元：${escapeHtml(c.url||'')}</p><button id="deleteCard" class="action danger full">このカードを削除</button>`;renderProductInfo('detailProducts',c.products,c.number,c.url);
 $('toggleWanted').textContent=c.wanted?'購入予定から外す':'購入予定に追加';$('deleteCard').onclick=async()=>{if(!confirm('このカードを登録一覧から削除しますか？購入予定からも削除されます。'))return;await req(st('cards','readwrite').delete(c.id));selectedCardId=null;await load();paintCollection()};
}
$('toggleWanted').onclick=async()=>{const c=cards.find(x=>x.id===selectedCardId);if(!c)return;c.wanted=!c.wanted;await saveCard(c);openCardDetail(c.id);$('registeredCount').textContent=cards.length;$('wishlistCount').textContent=cards.filter(x=>x.wanted).length;};
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
// The official search URL is not reliably respected by the text gateway.
// Collect candidate IDs from multiple independent search pages and verify
// each candidate against the requested card name before displaying it.
const normalizeCardSearch=x=>String(x||'').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[\s　・･「」『』（）()【】!！?？]/g,'');
function officialDetailLinks(md){
 const found=new Set();
 const patterns=[
  /https?:\/\/(?:dm\.takaratomy\.co\.jp)\/card\/detail\/?\?id=([a-z0-9-]+)/gi,
  /\/card\/detail\/?\?id=([a-z0-9-]+)/gi,
  /dm\.takaratomy\.co\.jp\/card\/detail\/?\?id=([a-z0-9-]+)/gi
 ];
 for(const re of patterns){let m;while((m=re.exec(md))&&found.size<80)found.add('https://dm.takaratomy.co.jp/card/detail/?id='+m[1]);}
 return [...found];
}
// Search directly against the official card-search page through a user-deployed
// same-origin/CORS-enabled Worker. No bundled card catalog is required.
const SEARCH_API_KEY='rch-search-api-v2';
const DEFAULT_SEARCH_API='https://rare-card-hunter-search.10g20070111.workers.dev/';
function getSearchApi(){try{return localStorage.getItem(SEARCH_API_KEY)||DEFAULT_SEARCH_API}catch{return DEFAULT_SEARCH_API}}
async function searchOfficialCards(q,page=1,onPartial=()=>{}){
 const base=getSearchApi();
 if(!base)throw Error('検索サーバーが未設定です。検索欄の下にWorkerのURLを設定してください。');
 const url=new URL(base);
 url.searchParams.set('q',q);url.searchParams.set('page',String(page));
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),18000);
 try{
  const response=await fetch(url.toString(),{signal:controller.signal,cache:'no-store'});
  if(!response.ok)throw Error('検索サーバーからHTTP '+response.status+'が返りました。');
  const data=await response.json();
  if(!Array.isArray(data.results))throw Error('検索サーバーの応答形式が正しくありません。');
  if(data.error)throw Error(data.error);
  officialSearchHasNext=Boolean(data.hasNext);
  const query=normalizeCardSearch(q);
  return data.results.filter(x=>x.url&&x.name&&normalizeCardSearch(x.name).includes(query))
   .map(x=>({name:x.name,number:x.number||'',url:x.url,image:x.image||officialCardImage(x.url)}));
 }finally{clearTimeout(timeout)}
}
let officialSearchHasNext=false;
// Random discovery from official listing; present cards, not diagnostic metrics.
async function randomOfficialCards(){
 const page=1+Math.floor(Math.random()*120);
 const payload={keyword:'',keyword_type:['card_name'],pagenum:String(page),samename:'show',sort:'release_new'};
 const url='https://dm.takaratomy.co.jp/card/?v='+encodeURIComponent(JSON.stringify(payload));
 let links=[];
 try{links=officialDetailLinks(await fetchReader(url));}catch(e){throw Error('公式カード一覧を取得できませんでした: '+e.message);}
 if(!links.length)throw Error('公式カード一覧から詳細URLを取得できませんでした。ランダム抽出を実行できません。');
 // Random order, and require the detail itself to be accessible.
 const sample=links.sort(()=>Math.random()-.5).slice(0,12);
 const data=await Promise.all(sample.map(async link=>{
  try{
   const md=await fetchReader(link);
   const card=extractOfficialMarkdown(md,link);
   if(!card.name)return null;
   return {name:card.name,number:card.number||'',url:link,image:officialCardImage(link)};
  }catch{return null;}
 }));
 return data.filter(Boolean);
}
let randomSearchRequest=0;
$('randomSearchButton').onclick=async()=>{
 const request=++randomSearchRequest;
 $('randomSearchButton').disabled=true;
 $('officialSearchStatus').textContent='カードを探しています…';
 $('officialSearchResults').innerHTML='';
 try{
  const cards=await randomOfficialCards();
  if(request!==randomSearchRequest)return;
  $('officialSearchStatus').textContent=cards.length?`ランダムに選んだカード ${cards.length} 件`:'カードを表示できませんでした。もう一度お試しください。';
  $('officialSearchResults').innerHTML=cards.length?cards.map((r,i)=>`<div class="official-result"><div class="official-result-main">${r.image?`<img class="official-result-thumb" src="${escapeAttr(r.image)}" alt="" loading="lazy">`:''}<div class="official-result-title"><b>${escapeHtml(r.name)}</b><small>${escapeHtml(r.number||'')}</small></div></div><div class="button-row"><button class="action primary" data-random-register="${i}">このカードを登録</button></div></div>`).join(''):'候補を取得できませんでした。もう一度お試しください。';
  document.querySelectorAll('[data-random-register]').forEach(b=>b.onclick=()=>{$('sourceUrl').value=cards[+b.dataset.randomRegister].url;$('fetchPage').click();});
 }catch(e){if(request===randomSearchRequest)$('officialSearchStatus').textContent=e.message;}
 finally{if(request===randomSearchRequest)$('randomSearchButton').disabled=false;}
};
let officialSearchPage=1,officialSearchTerm='',officialSearchRequest=0;
function renderOfficialSearchResults(results,q,page,loading=false){
  officialSearchPage=page;officialSearchTerm=q;
  $('officialSearchStatus').textContent=loading?'カードを追加検索中…':results.length?`${page}ページ目：${results.length}件の候補（検索できた範囲）`:'一致するカードを取得できませんでした。外部検索サービスが利用できない可能性があります。公式URLが分かる場合は下のURL欄から登録できます。';
  const html=results.map((r,i)=>`<div class="official-result"><div class="official-result-main">${r.image?`<img class="official-result-thumb" src="${escapeAttr(r.image)}" alt="" loading="lazy">`:''}<div class="official-result-title"><b>${escapeHtml(r.name)}</b><small>${escapeHtml(r.number||'コレクター番号不明')}</small></div></div><small class="official-result-url">${escapeHtml(r.url)}</small><div class="button-row"><button class="action secondary" data-copy-search="${i}">URLをコピー</button><button class="action primary" data-register-search="${i}">このカードを登録</button></div></div>`).join('');
  $('officialSearchResults').innerHTML=`<details class="search-collapse" open><summary>検索結果を表示・折りたたむ（${page}ページ・${results.length}件）</summary>${html}<nav class="search-pagination"><button class="action secondary" id="searchPrevious" ${page<=1?'disabled':''}>前</button><span>${page} ページ</span><button class="action primary" id="searchNext" ${loading||!officialSearchHasNext?'disabled':''}>次</button></nav></details>`;
  $('searchPrevious').onclick=()=>runOfficialSearch(q,page-1);
  $('searchNext').onclick=()=>runOfficialSearch(q,page+1);
  document.querySelectorAll('[data-copy-search]').forEach(b=>b.onclick=async()=>{const r=results[+b.dataset.copySearch];try{await navigator.clipboard.writeText(r.url);b.textContent='コピーしました';}catch{$('sourceUrl').value=r.url;b.textContent='URL欄に入力しました';}});
  document.querySelectorAll('[data-register-search]').forEach(b=>b.onclick=()=>{const r=results[+b.dataset.registerSearch];$('sourceUrl').value=r.url;$('fetchPage').click();});
  if(page>1)$('officialSearchResults').scrollIntoView({behavior:'smooth',block:'start'});
}
async function runOfficialSearch(q,page=1){
 const requestId=++officialSearchRequest;
 $('officialSearchButton').disabled=true;
 $('officialSearchStatus').textContent='公式カードを検索中…';
 $('officialSearchResults').innerHTML='';
 try{
  const results=await searchOfficialCards(q,page,partial=>{if(requestId===officialSearchRequest)renderOfficialSearchResults(partial,q,page,true);});
  if(requestId!==officialSearchRequest)return;
  renderOfficialSearchResults(results,q,page,false);
 }catch(e){if(requestId===officialSearchRequest)$('officialSearchStatus').textContent='検索に失敗しました：'+e.message;}
 finally{if(requestId===officialSearchRequest)$('officialSearchButton').disabled=false;}
}
$('officialSearchButton').onclick=()=>{
 const q=$('officialSearchInput').value.trim();
 if(q.length<2){$('officialSearchStatus').textContent='カード名を2文字以上入力してください。';return;}
 runOfficialSearch(q,1);
};
$('officialSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('officialSearchButton').click()});
$('searchApiUrl').value=getSearchApi();
$('searchApiStatus').textContent='検索サーバーURLは設定済みです。通常は変更不要です。';
$('saveSearchApi').onclick=()=>{
 const raw=$('searchApiUrl').value.trim();
 try{
  if(raw&&new URL(raw).protocol!=='https:')throw Error('HTTPS URLを入力してください。');
  localStorage.setItem(SEARCH_API_KEY,raw||DEFAULT_SEARCH_API);
  $('searchApiUrl').value=raw||DEFAULT_SEARCH_API;
  $('searchApiStatus').textContent=raw?'検索サーバーURLを保存しました。':'検索サーバーURLを解除しました。';
 }catch(e){$('searchApiStatus').textContent='URLが正しくありません。';}
};

$('exportData').onclick=async()=>{const payload={app:'RARE CARD HUNTER',version:2,cards,settings};const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rare-card-hunter-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('importData').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data.cards)||!data.settings)throw Error('バックアップ形式が違います');if(!confirm('現在の登録データを上書きして復元しますか？'))return;const tx=db.transaction(['cards','settings'],'readwrite');tx.objectStore('cards').clear();data.cards.forEach(c=>{if(c.id&&c.name)tx.objectStore('cards').put(c)});tx.objectStore('settings').clear();Object.entries(data.settings).forEach(([key,value])=>tx.objectStore('settings').put({key,value}));tx.oncomplete=async()=>{await load();alert('復元しました')};}catch(err){alert('復元できません：'+err.message)}e.target.value=''};
$('eraseData').onclick=async()=>{if(!confirm('カード情報・画像・設定をすべて削除します。先にバックアップしましたか？'))return;const tx=db.transaction(['cards','settings'],'readwrite');tx.objectStore('cards').clear();tx.objectStore('settings').clear();tx.oncomplete=async()=>{settings={message:'わたしたちはレアカードハンター！',bubble:true,characterSize:120,tone:'dawasa',character:null,background:null};await load();alert('削除しました')}};
async function init(){db=await openDB();await load();if('serviceWorker'in navigator&&location.protocol.startsWith('http')){let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading){reloading=true;location.reload()}});navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{})}}init().catch(e=>alert('起動エラー：'+e.message));
