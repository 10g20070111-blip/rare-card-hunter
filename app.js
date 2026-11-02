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
function normalizeRules(raw=''){
 let t=cleanCardRules(raw);
 // Reader Markdown often collapses several bullet abilities into one paragraph.
 t=t.replace(/\s+(?:\*|※|■)\s*(?=[^\s])/g,'\n■ ')
   .replace(/\s*▶\s*/g,'\n  ▶ ')
   .replace(/(^|\n)\s*(?:\*|※|■)\s*/g,'$1■ ')
   .replace(/(^|\n)\s*(?:[-+]\s+)(?=\S)/g,'$1■ ');
 return removeFlavorLabel(t.trim());
}
// Official reader data is split by its labelled sections, not guessed from ability words.
function officialSections(raw=''){
 // Jina's Markdown and the official HTML-to-text output have different heading formats.
 // Extract the two official sections separately so an absent heading never erases the other.
 const lines=String(raw||'').replace(/\r/g,'').split('\n');
 const label=line=>String(line||'').trim().replace(/^#{1,6}\s*/,'')
   .replace(/^\*{1,2}\s*|\s*\*{1,2}$/g,'').replace(/[:：]\s*$/,'').trim();
 const ruleHead=x=>/^(特殊能力|カードテキスト|能力テキスト)$/.test(label(x));
 const flavorHead=x=>/^(フレーバー|フレーバーテキスト)$/.test(label(x));
 const stopHead=x=>/^(商品情報|このカードのよくある質問|よくある質問|同名カードが含まれる商品(?:を表示)?|収録情報|関連カード)$/.test(label(x));
 const noise=x=>/^(?:\s*[-_*─]{3,}\s*|\s*)$/.test(x);
 const stopLine=x=>stopHead(x)||/^\s*(?:[-*+]\s*){1,5}(?:商品情報|このカードのよくある質問|同名カードが含まれる商品)/.test(x)
   ||/^\s*(?:[-*+]\s*)?(?:\[[^\]]+\]\([^)]*\)\s*)?(?:DM\d{2}[- ]|DMRP|DMBD|DMEX|DMART|プロモ限定カード)/i.test(x)
   ||/^#{1,6}\s+(?!フレーバー|特殊能力)/.test(x);
 const read=(at,isFlavor)=>{
  if(at<0)return '';
  const out=[];
  for(let i=at+1;i<lines.length;i++){
   const line=lines[i].trim();
   if((isFlavor&&ruleHead(line))||(!isFlavor&&flavorHead(line))||stopLine(line))break;
   if(noise(line))continue;
   if(/^https?:\/\//.test(line))break;
   if(isFlavor)out.push(line.replace(/^\s*>\s*/,''));
   else out.push(line.replace(/^\s*[-*+]\s+(?=\S)/,'■ '));
  }
  return cleanText(out.join('\n'));
 };
 const r=lines.findIndex(ruleHead);
 const f=lines.findIndex(flavorHead);
 return {rules:read(r,false),flavor:read(f,true)};
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
 const find=keys=>{const row=rows.find(r=>keys.some(k=>r[0].replace(/[：: ]/g,'').includes(k)));return row?.slice(1).join(' / ')||''};
 let name=find(['カード名','名称'])||title.replace(/\s*[（(].*?[）)]\s*$/,'').replace(/\s*[|｜-].*$/,'').trim();
 let cost=find(['コスト'])||'';cost=(cost.match(/[0-9]+/)||[])[0]||cost;
 let number=find(['コレクター番号','カード番号','収録番号','No.']);
 let text=find(['カードテキスト','テキスト','能力'])||extractTextFromDom(doc);
 if(!text){const d=meta('meta[property="og:description"]')||meta('meta[name="description"]');if(d&&!/デュエル・マスターズのカードを集める/.test(d))text=cleanText(d)}
 let image=meta('meta[property="og:image"]')||meta('meta[name="twitter:image"]');
 if(!image){const im=[...doc.images].find(i=>/card|cards|cardimg|カード/i.test((i.getAttribute('src')||'')+' '+(i.getAttribute('alt')||'')));if(im)image=im.getAttribute('src')||im.src}
 const extras={type:find(['カードタイプ','種類']),civilization:find(['文明']),rarity:find(['レアリティ']),power:find(['パワー']),race:find(['種族'])};
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
  const timeout=setTimeout(()=>controller.abort(),9500);
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

 if(!sections.flavor){
  const m=String(md).match(/(?:^|\n)\s*(?:#{1,6}\s*)?フレーバー(?:テキスト)?\s*\n(?:\s*[-─_]{3,}\s*\n)?([^\n]+)/);
  if(m&&m[1]&&!/^(?:\*|[-+])\s*DM/i.test(m[1].trim()))sections.flavor=cleanText(m[1]);
 }
 if(!sections.flavor){
  const tail=String(md).split(/(?:^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?フレーバー(?:テキスト)?(?:\\*\\*)?\\s*(?:\\n|$)/).slice(1)[0]||'';
  if(tail){
   const lines=tail.split('\\n').map(x=>x.trim()).filter(x=>x&&!/^[-_*─]{3,}$/.test(x));
   const value=[];
   for(const line of lines){
    if(/^(?:[-*+]\\s*){1,5}(?:商品情報|このカードのよくある質問|同名カード)/.test(line)||/^#{1,6}\\s/.test(line)||/^(?:[-*+]\\s*)?DM\\d{2}[- ]/.test(line))break;
    value.push(line);if(value.length>=6)break;
   }
   sections.flavor=cleanText(value.join('\\n'));
  }
 }
 const number=collectorFromOfficial(md,url)||((heading.match(/\((DM[^)]+)\)/i)||[])[1]||'').replace(/^DM/i,'').replace(/\s+/, '  ');
 return {name:title,cost:(get('コスト').match(/\d+/)||[])[0]||'',number,
 text:normalizeRules(sections.rules),flavor:sections.flavor,
 image:officialCardImage(url),url,type:get('カードの種類'),civilization:get('文明'),
 rarity:get('レアリティ'),power:get('パワー'),race:get('種族')};
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

$('fetchPage').onclick=async()=>{
 const url=validUrl($('sourceUrl').value.trim());
 if(!url){$('fetchStatus').textContent='公式サイトまたはdmwiki.netのHTTPSカード詳細URLを入力してください。';return}
 $('fetchPage').disabled=true;$('fetchStatus').textContent='外部読み取りサービス経由でカードページを解析しています…';
 try{
  const body=await fetchReader(url.href);lastOfficialReader=body;$('readerDiagnostics').hidden=false;
  let parsed;
  const isOfficial=url.hostname==='dm.takaratomy.co.jp';
  if(/<html[\s>]/i.test(body)){const doc=new DOMParser().parseFromString(body,'text/html');parsed=pageData(doc,url.href);if(isOfficial){const specific=extractOfficialMarkdown(doc.body?.innerText||doc.body?.textContent||'',url.href);parsed={...parsed,...Object.fromEntries(Object.entries(specific).filter(([k,v])=>v)),text:specific.text||parsed.text||'',flavor:specific.flavor||parsed.flavor||''};}}
  else {parsed=markdownData(body,url.href);if(isOfficial){const specific=extractOfficialMarkdown(body,url.href);parsed={...parsed,...Object.fromEntries(Object.entries(specific).filter(([k,v])=>v)),text:specific.text||parsed.text||'',flavor:specific.flavor||parsed.flavor||''};}else{const wikiText=extractWikiOnlyCardText(body);if(wikiText)parsed.text=wikiText;}}
  if(isOfficial){const exactImage=officialCardImage(url.href);if(exactImage)parsed.image=exactImage;}
  if(!parsed.name&&!parsed.text&&!parsed.image&&!parsed.cost&&!parsed.number)throw Error('ページからカード情報を抽出できませんでした');
  draft={...parsed,text:normalizeRules(parsed.text),flavor:parsed.flavor||extractFlavor(body),url:url.href};renderPreview();requestAnimationFrame(()=>$('previewPanel').scrollIntoView({behavior:'smooth',block:'start'}));
  const missing=[];if(!draft.name)missing.push('カード名');if(!draft.cost)missing.push('コスト');if(!draft.number)missing.push('コレクター番号');if(!draft.text)missing.push('テキスト');if(!draft.image)missing.push('画像');
  $('fetchStatus').textContent=missing.length?'一部の情報を取得できませんでした（'+missing.join('・')+'）。「編集する」から補完できます。':'カード情報を取得しました。内容を確認してください。';
 }catch(e){$('fetchStatus').textContent='自動取得に失敗しました。通信制限、外部読み取りサービスの応答、またはページ形式が原因の可能性があります。時間をおいて再試行するか、「編集する」から入力してください。';}
 finally{$('fetchPage').disabled=false}
};
$('readerDiagnostics').onclick=()=>{if(!lastOfficialReader)return;const blob=new Blob([lastOfficialReader],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rare-card-hunter-reader-diagnostics.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)};
function raceMarkup(value=''){return escapeHtml(value).replace(/\s*\/\s*/g,'<wbr>/') }
function renderPreview(){$('urlEntry').hidden=true;$('previewPanel').hidden=false;$('editPanel').hidden=true;$('previewName').innerHTML=escapeHtml(draft.name||'カード名を取得できません')+(draft.number?' <small class="name-number">('+escapeHtml(draft.number)+')</small>':'');$('previewCost').textContent=draft.cost||'—';$('previewNumber').textContent=draft.number||'—';$('previewText').textContent=normalizeRules(draft.text)||'—';$('previewFlavor').textContent=draft.flavor||'—';$('previewImage').innerHTML=draft.image?`<img src="${escapeAttr(draft.image)}" alt="カード画像" onerror="this.parentElement.textContent='画像を表示できません'">`:'画像なし';const extras=[['カードタイプ',draft.type],['文明',draft.civilization],['レアリティ',draft.rarity],['パワー',draft.power],['種族',draft.race]].filter(x=>x[1]);$('previewExtra').innerHTML=extras.map(([k,v])=>`<div class="${k==='種族'?'race-wide':''}"><dt>${k}</dt><dd>${k==='種族'?raceMarkup(v):escapeHtml(v)}</dd></div>`).join('');$('sourceNotice').textContent='取得元：'+draft.url}
function escapeAttr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
$('editPreview').onclick=()=>{$('editPanel').hidden=false;$('previewPanel').hidden=true;$('editName').value=draft.name;$('editCost').value=draft.cost;$('editNumber').value=draft.number;$('editType').value=draft.type||'';$('editCivilization').value=draft.civilization||'';$('editRarity').value=draft.rarity||'';$('editPower').value=draft.power||'';$('editRace').value=draft.race||'';$('editText').value=draft.text;$('editFlavor').value=draft.flavor||'';$('editImageUrl').value=draft.image;$('editImagePreview').innerHTML=draft.image?`<img src="${escapeAttr(draft.image)}">`:''};$('backToPreview').onclick=renderPreview;
$('editImageFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;editedImage=await imageData(f);$('editImagePreview').innerHTML=`<img src="${editedImage}">`};$('applyEdit').onclick=()=>{draft.name=$('editName').value.trim();draft.cost=$('editCost').value.trim();draft.number=$('editNumber').value.trim();draft.type=$('editType').value.trim();draft.civilization=$('editCivilization').value.trim();draft.rarity=$('editRarity').value.trim();draft.power=$('editPower').value.trim();draft.race=$('editRace').value.trim();draft.text=normalizeRules($('editText').value);draft.flavor=$('editFlavor').value.trim();draft.image=$('editImageUrl').value.trim();if(editedImage)draft.image=editedImage;renderPreview()};
$('cancelPreview').onclick=()=>{if(confirm('取得した内容を破棄しますか？'))resetRegister()};$('confirmSave').onclick=async()=>{if(!draft?.name){alert('カード名がありません。「編集する」からカード名を入力してください。');return}const c={id:crypto.randomUUID(),name:draft.name,cost:draft.cost,number:draft.number,text:normalizeRules(draft.text),flavor:draft.flavor||'',image:draft.image||null,url:draft.url,type:draft.type||'',civilization:draft.civilization||'',rarity:draft.rarity||'',power:draft.power||'',race:draft.race||'',owned:0,wanted:$('previewWanted').checked,wantQty:1,createdAt:new Date().toISOString()};await saveCard(c);alert('カードを登録しました！');show('home');resetRegister()};
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
 const rows=[['コスト',c.cost],['コレクター番号',c.number],['カードタイプ',c.type],['文明',c.civilization],['レアリティ',c.rarity],['パワー',c.power],['種族',c.race]];
 $('detailContent').innerHTML=`<h2>${escapeHtml(c.name)}${c.number?` <small class="name-number">(${escapeHtml(c.number)})</small>`:''}</h2><div class="detail-layout"><div class="detail-image">${c.image?`<img src="${escapeAttr(c.image)}" alt="${escapeAttr(c.name)}">`:'画像なし'}</div><dl class="detail-data">${rows.map(([k,v])=>v?`<div class="${k==='種族'?'race-wide':''}"><dt>${k}</dt><dd>${k==='種族'?raceMarkup(v):escapeHtml(v)}</dd></div>`:'').join('')}</dl></div><section class="detail-text"><b>カードテキスト</b><p>${escapeHtml(normalizeRules(c.text)||'—')}</p></section>${c.flavor?`<section class="detail-text"><b>フレーバー</b><p>${escapeHtml(c.flavor)}</p></section>`:''}<p class="hint">取得元：${escapeHtml(c.url||'')}</p><button id="deleteCard" class="action danger full">このカードを削除</button>`;
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
// Verified official detail URLs bundled so essential searches work even when
// third-party search gateways return unrelated pages or block requests.
const VERIFIED_CARDS=[
 ['轟䡛合体 ゴルギーオージャー','dm25rp2-S07','25RP2  S7/S11'],
 ['轟䡛合体 ゴルギーオージャー','dm25ex3-rp2S07','25EX3  S7/S11'],
 ['蒼き団長 ドギラゴン剣','dmex06-dk3','EX06  DK3/DK6'],
 ['蒼き団長 ドギラゴン剣','dm24bd1-006','24BD1  6/21'],
 ['蒼き団長 ドギラゴン剣','dm26ex4-CHO004','26EX4  超4/超50'],
 ['蒼き団長 ドギラゴン剣','dm26sd1-c004','26SD1  4/14'],
 ['蒼き団長 ドギラゴン剣','dmex17-w18','EX17  W18/W20'],
 ['蒼き団長 ドギラゴン剣','dmr21-l02','R21  L2/L2'],
 ['蒼き団長 ドギラゴン剣','dmex15-a014','EX15  14/50'],
 ['蒼き団長 ドギラゴン剣','dmex01-071','EX01  71/80'],
 ['蒼き団長 ドギラゴン剣','dmbd15-003','BD15  3/18'],
 ['蒼き団長 ドギラゴン剣','dm24sp1-002','24SP1  2/16'],
 ['蒼き団長 ドギラゴン剣','dmart06-002','ART06  2/5'],
 ['蒼き団長 ドギラゴン剣','promoy25-003','PROMOY25  P3/Y25'],
 ['蒼き団長 ドギラゴン剣','promoy19-024','PROMOY19  P24/Y19']
].map(([name,id,number])=>({name,number,url:'https://dm.takaratomy.co.jp/card/detail/?id='+id,image:officialCardImage('https://dm.takaratomy.co.jp/card/detail/?id='+id)}));
async function searchOfficialCards(q,page=1){
 const payload={keyword:q,keyword_type:['card_name'],pagenum:String(page),samename:'show',sort:'release_new'};
 const official='https://dm.takaratomy.co.jp/card/?v='+encodeURIComponent(JSON.stringify(payload));
 const google='https://www.google.com/search?q='+encodeURIComponent('site:dm.takaratomy.co.jp/card/detail/ "'+q+'"')+'&num=60&start='+((page-1)*60);
 const bing='https://www.bing.com/search?q='+encodeURIComponent('site:dm.takaratomy.co.jp/card/detail/ "'+q+'"')+'&first='+((page-1)*50+1);
 const bundled=page===1?VERIFIED_CARDS.filter(x=>normalizeCardSearch(x.name).includes(normalizeCardSearch(q))):[];
 const results=await Promise.allSettled([fetchReader(official),fetchReader(google),fetchReader(bing)]);
 const urls=new Set(bundled.map(x=>x.url));
 for(const r of results)if(r.status==='fulfilled')for(const url of officialDetailLinks(r.value))urls.add(url);
 const unknown=[...urls].filter(url=>!bundled.some(x=>x.url===url)).slice(0,36);
 const found=await Promise.all(unknown.map(async url=>{
  try{
   const detail=await fetchReader(url);
   const card=extractOfficialMarkdown(detail,url);
   if(!card.name||!normalizeCardSearch(card.name).includes(normalizeCardSearch(q)))return null;
   return {name:card.name,number:card.number||collectorFromOfficial(detail,url)||'',url,image:officialCardImage(url)};
  }catch{return null;}
 }));
 return [...bundled,...found.filter(Boolean)].slice(0,24);
}

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
async function runOfficialSearch(q,page=1){
 const requestId=++officialSearchRequest;
 $('officialSearchButton').disabled=true;
 $('officialSearchStatus').textContent=`公式カードを検索中…（${page}ページ）`;
 try{
  const results=await searchOfficialCards(q,page);
  if(requestId!==officialSearchRequest)return;
  officialSearchPage=page;officialSearchTerm=q;
  $('officialSearchStatus').textContent=results.length?`${page}ページ目：${results.length}件の候補（検索できた範囲）`:'一致するカードを取得できませんでした。外部検索サービスが利用できない可能性があります。公式URLが分かる場合は下のURL欄から登録できます。';
  const html=results.map((r,i)=>`<div class="official-result"><div class="official-result-main">${r.image?`<img class="official-result-thumb" src="${escapeAttr(r.image)}" alt="" loading="lazy">`:''}<div class="official-result-title"><b>${escapeHtml(r.name)}</b><small>${escapeHtml(r.number||'コレクター番号不明')}</small></div></div><small class="official-result-url">${escapeHtml(r.url)}</small><div class="button-row"><button class="action secondary" data-copy-search="${i}">URLをコピー</button><button class="action primary" data-register-search="${i}">このカードを登録</button></div></div>`).join('');
  $('officialSearchResults').innerHTML=`<details class="search-collapse" open><summary>検索結果を表示・折りたたむ（${page}ページ・${results.length}件）</summary>${html}<nav class="search-pagination"><button class="action secondary" id="searchPrevious" ${page<=1?'disabled':''}>前</button><span>${page} ページ</span><button class="action primary" id="searchNext" ${results.length===0?'disabled':''}>次</button></nav></details>`;
  $('searchPrevious').onclick=()=>runOfficialSearch(q,page-1);
  $('searchNext').onclick=()=>runOfficialSearch(q,page+1);
  document.querySelectorAll('[data-copy-search]').forEach(b=>b.onclick=async()=>{const r=results[+b.dataset.copySearch];try{await navigator.clipboard.writeText(r.url);b.textContent='コピーしました';}catch{$('sourceUrl').value=r.url;b.textContent='URL欄に入力しました';}});
  document.querySelectorAll('[data-register-search]').forEach(b=>b.onclick=()=>{const r=results[+b.dataset.registerSearch];$('sourceUrl').value=r.url;$('fetchPage').click();});
  if(page>1)$('officialSearchResults').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){if(requestId!==officialSearchRequest)return;$('officialSearchStatus').textContent='検索に失敗しました。通信状態を確認して再試行してください。'}
 finally{if(requestId===officialSearchRequest)$('officialSearchButton').disabled=false;}
}
$('officialSearchButton').onclick=()=>{
 const q=$('officialSearchInput').value.trim();
 if(q.length<2){$('officialSearchStatus').textContent='カード名を2文字以上入力してください。';return;}
 runOfficialSearch(q,1);
};
$('officialSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('officialSearchButton').click()});
$('exportData').onclick=async()=>{const payload={app:'RARE CARD HUNTER',version:2,cards,settings};const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rare-card-hunter-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('importData').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data.cards)||!data.settings)throw Error('バックアップ形式が違います');if(!confirm('現在の登録データを上書きして復元しますか？'))return;const tx=db.transaction(['cards','settings'],'readwrite');tx.objectStore('cards').clear();data.cards.forEach(c=>{if(c.id&&c.name)tx.objectStore('cards').put(c)});tx.objectStore('settings').clear();Object.entries(data.settings).forEach(([key,value])=>tx.objectStore('settings').put({key,value}));tx.oncomplete=async()=>{await load();alert('復元しました')};}catch(err){alert('復元できません：'+err.message)}e.target.value=''};
$('eraseData').onclick=async()=>{if(!confirm('カード情報・画像・設定をすべて削除します。先にバックアップしましたか？'))return;const tx=db.transaction(['cards','settings'],'readwrite');tx.objectStore('cards').clear();tx.objectStore('settings').clear();tx.oncomplete=async()=>{settings={message:'わたしたちはレアカードハンター！',bubble:true,characterSize:120,tone:'dawasa',character:null,background:null};await load();alert('削除しました')}};
async function init(){db=await openDB();await load();if('serviceWorker'in navigator&&location.protocol.startsWith('http')){let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading){reloading=true;location.reload()}});navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{})}}init().catch(e=>alert('起動エラー：'+e.message));
