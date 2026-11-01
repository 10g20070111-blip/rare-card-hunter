const DB_NAME='rare-card-hunter',DB_VERSION=1;let db,cards=[],settings={message:'わたしたちはレアカードハンター！',bubble:true,characterSize:120,tone:'dawasa',character:null};let draft=null,editedImage=null;
const $=id=>document.getElementById(id);const req=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
function openDB(){return new Promise((ok,no)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('cards'))d.createObjectStore('cards',{keyPath:'id'});if(!d.objectStoreNames.contains('settings'))d.createObjectStore('settings',{keyPath:'key'})};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}function st(n,m='readonly'){return db.transaction(n,m).objectStore(n)}
async function load(){cards=await req(st('cards').getAll());const s=await req(st('settings').getAll());s.forEach(x=>settings[x.key]=x.value);settings.message??='わたしたちはレアカードハンター！';settings.bubble??=true;settings.characterSize??=120;settings.tone??='dawasa';paintHome();paintSettings()}
async function saveSetting(k,v){settings[k]=v;await req(st('settings','readwrite').put({key:k,value:v}))}async function saveCard(c){await req(st('cards','readwrite').put(c));await load()}
function show(id){document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id===id))}document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>show('home'));$('goRegister').onclick=()=>{show('register');resetRegister()};$('goWishlist').onclick=()=>{show('wishlist');paintWishlist()};$('goSettings').onclick=()=>{show('settings');paintSettings()};
function paintHome(){$('mainMessage').textContent=settings.message||'わたしたちはレアカードハンター！';$('cardCount').textContent=`登録カード ${cards.length}枚`;$('wishSummary').textContent=`購入予定 ${cards.filter(c=>c.wanted).length}種類`;$('character').style.width=settings.characterSize+'px';$('character').style.height=Math.round(settings.characterSize*1.15)+'px';$('character').innerHTML=settings.character?`<img src="${settings.character}" alt="ナビゲーター">`:'🐰';$('bubble').classList.toggle('hidden',!settings.bubble);$('bubble').textContent=phrase('ホームへようこそ！')}
function phrase(s){if(settings.tone==='polite')return s.replace(/だわさ/g,'です').replace(/！/g,'。');if(settings.tone==='simple')return 'カードを登録してみよう！';return s.endsWith('だわさ')?s:s+'だわさ'}
function paintSettings(){$('settingMessage').value=settings.message||'';$('bubbleToggle').checked=!!settings.bubble;$('characterSize').value=settings.characterSize||120;$('sizeValue').textContent=(settings.characterSize||120)+'px';$('navigatorTone').value=settings.tone||'dawasa'}$('characterSize').oninput=e=>$('sizeValue').textContent=e.target.value+'px';
$('saveSettings').onclick=async()=>{await saveSetting('message',$('settingMessage').value.trim()||'わたしたちはレアカードハンター！');await saveSetting('bubble',$('bubbleToggle').checked);await saveSetting('characterSize',+$('characterSize').value);await saveSetting('tone',$('navigatorTone').value);paintHome();alert('設定を保存しました。')};
function resetRegister(){$('sourceUrl').value='';$('fetchStatus').textContent='';$('previewPanel').hidden=true;$('editPanel').hidden=true;$('urlEntry').hidden=false;draft=null;editedImage=null;$('previewWanted').checked=false}
function validUrl(raw){try{const u=new URL(raw);const h=u.hostname.toLowerCase();if(u.protocol!=='https:')return null;if(h==='dm.takaratomy.co.jp'||h.endsWith('.dm.takaratomy.co.jp')||h==='dmwiki.net'||h.endsWith('.dmwiki.net'))return u;return null}catch{return null}}
function absUrl(src,base){try{return new URL(src,base).href}catch{return ''}}
function cleanText(s=''){return String(s).replace(/\\\\n/g,'\n').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*_`#]/g,'').replace(/\s+/g,' ').trim()}
function pageData(doc,url){
 const meta=(s)=>doc.querySelector(s)?.content||'';
 const title=doc.querySelector('h1')?.textContent?.trim()||meta('meta[property="og:title"]')||doc.title||'';
 const rows=[...doc.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('th,td')].map(x=>x.textContent.trim()).filter(Boolean)).filter(x=>x.length>1);
 const find=keys=>{const row=rows.find(r=>keys.some(k=>r[0].replace(/[：: ]/g,'').includes(k)));return row?.slice(1).join(' / ')||''};
 let name=find(['カード名','名称'])||title.replace(/\s*[（(].*?[）)]\s*$/,'').replace(/\s*[|｜-].*$/,'').trim();
 let cost=find(['コスト'])||'';cost=(cost.match(/[0-9]+/)||[])[0]||cost;
 let number=find(['コレクター番号','カード番号','収録番号','No.']);
 let text=find(['カードテキスト','テキスト','能力']);
 if(!text)text=meta('meta[property="og:description"]')||meta('meta[name="description"]');
 let image=meta('meta[property="og:image"]')||meta('meta[name="twitter:image"]');
 if(!image){const im=[...doc.images].find(i=>/card|cards|cardimg/i.test((i.getAttribute('src')||'')+' '+(i.getAttribute('alt')||'')));if(im)image=im.getAttribute('src')||im.src}
 const extras={type:find(['カードタイプ','種類']),civilization:find(['文明']),rarity:find(['レアリティ']),power:find(['パワー']),race:find(['種族'])};
 return{name,cost,number,text,image:absUrl(image,url),url,...extras};
}
function markdownData(md,url){
 const lines=String(md||'').replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);
 const joined=lines.join('\n');
 const get=(labels)=>{for(let i=0;i<lines.length;i++){const raw=lines[i];const cells=raw.split('|').map(x=>cleanText(x)).filter(Boolean);if(cells.length>=2&&labels.some(k=>cells[0].replace(/[：: ]/g,'').includes(k)))return cells.slice(1).join(' / ');const line=cleanText(raw);for(const label of labels){const re=new RegExp('^'+label+'\\s*[：:]?\\s*(.*)$');const m=line.match(re);if(m&&m[1])return m[1];if(line===label||line===label+'：')return cleanText(lines[i+1]||'')}}return ''};
 let title=get(['Title'])||''; if(!title){const t=joined.match(/^#\s+(.+)$/m);title=t?.[1]||''}
 const name=get(['カード名','名称','カード']);
 let cost=get(['コスト']);cost=(cost.match(/[0-9]+/)||[])[0]||cost;
 const number=get(['コレクター番号','カード番号','収録番号','カードNo.','No.']);
 let text=get(['カードテキスト','テキスト','能力']);
 if(!text){let i=lines.findIndex(x=>/^(カードテキスト|テキスト|能力)[：:]?$/.test(cleanText(x)));if(i>=0)text=lines.slice(i+1,i+14).map(cleanText).filter(x=>x&&!/^(画像|関連カード|収録情報)/.test(x)).join('\n')}
 if(!text){const desc=get(['Description']);if(desc&&!/デュエル・マスターズのカードを集める/.test(desc))text=desc}
 const imgs=[...joined.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g)].map(m=>({alt:m[1],url:m[2]}));
 const image=(imgs.find(x=>/card|カード|gorg|ゴルギ/i.test(x.alt+' '+x.url))||imgs.find(x=>!/logo|banner|icon/i.test(x.alt+' '+x.url))||{}).url||'';
 const collector=number||((title+' '+joined.slice(0,1500)).match(/(?:DM\d{2}[A-Z0-9-]*\s*)?(?:[0-9]{1,3}\/[0-9]{1,3}|S[0-9]+\/S[0-9]+)/i)||[])[0]||'';
 const finalName=name||title.replace(/^.*?:\s*/,'').replace(/\s*[（(].*?[）)].*$/,'').trim();
 return {name:finalName,cost,number:collector,text,image,url};
}
async function fetchReader(url){
 const endpoint='https://r.jina.ai/'+url;
 const response=await fetch(endpoint,{method:'GET',mode:'cors',credentials:'omit',headers:{'Accept':'text/plain'}});
 if(!response.ok)throw Error('Reader HTTP '+response.status);
 return await response.text();
}
$('fetchPage').onclick=async()=>{
 const url=validUrl($('sourceUrl').value.trim());
 if(!url){$('fetchStatus').textContent='公式サイトまたはdmwiki.netのHTTPSカード詳細URLを入力してください。';return}
 $('fetchPage').disabled=true;$('fetchStatus').textContent='外部読み取りサービス経由でカードページを解析しています…';
 try{
  const body=await fetchReader(url.href);
  let parsed;
  if(/<html[\s>]/i.test(body)){const doc=new DOMParser().parseFromString(body,'text/html');parsed=pageData(doc,url.href)}else parsed=markdownData(body,url.href);
  if(!parsed.name&&!parsed.text&&!parsed.image&&!parsed.cost&&!parsed.number)throw Error('ページからカード情報を抽出できませんでした');
  draft={...parsed,url:url.href};renderPreview();
  const missing=[];if(!draft.name)missing.push('カード名');if(!draft.cost)missing.push('コスト');if(!draft.number)missing.push('コレクター番号');if(!draft.text)missing.push('テキスト');if(!draft.image)missing.push('画像');
  $('fetchStatus').textContent=missing.length?'一部の情報を取得できませんでした（'+missing.join('・')+'）。「編集する」から補完できます。':'カード情報を取得しました。内容を確認してください。';
 }catch(e){$('fetchStatus').textContent='自動取得に失敗しました。通信制限、外部読み取りサービスの応答、またはページ形式が原因の可能性があります。時間をおいて再試行するか、「編集する」から入力してください。';}
 finally{$('fetchPage').disabled=false}
};
function renderPreview(){$('urlEntry').hidden=true;$('previewPanel').hidden=false;$('editPanel').hidden=true;$('previewName').textContent=draft.name||'カード名を取得できません';$('previewCost').textContent=draft.cost||'—';$('previewNumber').textContent=draft.number||'—';$('previewText').textContent=draft.text||'—';$('previewImage').innerHTML=draft.image?`<img src="${escapeAttr(draft.image)}" alt="カード画像" onerror="this.parentElement.textContent='画像を表示できません'">`:'画像なし';$('sourceNotice').textContent='取得元：'+draft.url}
function escapeAttr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
$('editPreview').onclick=()=>{$('editPanel').hidden=false;$('previewPanel').hidden=true;$('editName').value=draft.name;$('editCost').value=draft.cost;$('editNumber').value=draft.number;$('editText').value=draft.text;$('editImageUrl').value=draft.image;$('editImagePreview').innerHTML=draft.image?`<img src="${escapeAttr(draft.image)}">`:''};$('backToPreview').onclick=renderPreview;
$('editImageFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;editedImage=await imageData(f);$('editImagePreview').innerHTML=`<img src="${editedImage}">`};$('applyEdit').onclick=()=>{draft.name=$('editName').value.trim();draft.cost=$('editCost').value.trim();draft.number=$('editNumber').value.trim();draft.text=$('editText').value;draft.image=$('editImageUrl').value.trim();if(editedImage)draft.image=editedImage;renderPreview()};
$('cancelPreview').onclick=()=>{if(confirm('取得した内容を破棄しますか？'))resetRegister()};$('confirmSave').onclick=async()=>{if(!draft?.name){alert('カード名がありません。「編集する」からカード名を入力してください。');return}const c={id:crypto.randomUUID(),name:draft.name,cost:draft.cost,number:draft.number,text:draft.text,image:draft.image||null,url:draft.url,owned:0,wanted:$('previewWanted').checked,wantQty:1,createdAt:new Date().toISOString()};await saveCard(c);alert('カードを登録しました！');show('home');resetRegister()};
function imageData(file){return new Promise((ok,no)=>{if(!file.type.startsWith('image/'))return no(Error('画像ファイルを選択してください'));const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const cv=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(im.width,im.height));cv.width=im.width*scale;cv.height=im.height*scale;cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);ok(cv.toDataURL('image/jpeg',.82))};im.onerror=no;im.src=r.result};r.onerror=no;r.readAsDataURL(file)})}
$('characterFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{await saveSetting('character',await imageData(f));paintHome()}catch(err){alert(err.message)}};
function paintWishlist(){const list=cards.filter(c=>c.wanted);$('wishlistItems').innerHTML=list.length?list.map(c=>`<article class="wish-card"><div class="wish-thumb">${c.image?`<img src="${escapeAttr(c.image)}">`:'画像なし'}</div><div><h3>${escapeHtml(c.name)}</h3><p>コスト：${escapeHtml(c.cost||'—')} ／ 番号：${escapeHtml(c.number||'—')}</p><div class="wish-actions"><button class="action secondary" data-remove="${c.id}">購入予定から外す</button></div></div></article>`).join(''):'<div class="empty">購入予定のカードはまだありません。カードを登録した後、登録データから購入予定に設定できます。</div>';document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{const c=cards.find(x=>x.id===b.dataset.remove);c.wanted=false;await saveCard(c);paintWishlist()})}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
$('exportData').onclick=async()=>{const payload={app:'RARE CARD HUNTER',version:2,cards,settings};const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rare-card-hunter-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('importData').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data.cards)||!data.settings)throw Error('バックアップ形式が違います');if(!confirm('現在の登録データを上書きして復元しますか？'))return;const tx=db.transaction(['cards','settings'],'readwrite');tx.objectStore('cards').clear();data.cards.forEach(c=>{if(c.id&&c.name)tx.objectStore('cards').put(c)});tx.objectStore('settings').clear();Object.entries(data.settings).forEach(([key,value])=>tx.objectStore('settings').put({key,value}));tx.oncomplete=async()=>{await load();alert('復元しました')};}catch(err){alert('復元できません：'+err.message)}e.target.value=''};
$('eraseData').onclick=async()=>{if(!confirm('カード情報・画像・設定をすべて削除します。先にバックアップしましたか？'))return;const tx=db.transaction(['cards','settings'],'readwrite');tx.objectStore('cards').clear();tx.objectStore('settings').clear();tx.oncomplete=async()=>{settings={message:'わたしたちはレアカードハンター！',bubble:true,characterSize:120,tone:'dawasa',character:null};await load();alert('削除しました')}};
async function init(){db=await openDB();await load();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./service-worker.js').catch(()=>{})}init().catch(e=>alert('起動エラー：'+e.message));
