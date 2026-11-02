// RARE CARD HUNTER 2.31 — live official search, no bundled card catalog.
const ORIGIN='https://dm.takaratomy.co.jp';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'public, max-age=120'};
const json=(obj,status=200)=>Response.json(obj,{status,headers:CORS});
const decode=s=>String(s||'').replace(/&#(x[\da-f]+|\d+);|&(amp|quot|apos|lt|gt|nbsp|#39);/gi,(a,num,named)=>num?String.fromCodePoint(parseInt(num[0].toLowerCase()==='x'?num.slice(1):num,num[0].toLowerCase()==='x'?16:10)):({'amp':'&','quot':'"','apos':"'",'lt':'<','gt':'>','nbsp':' ','#39':"'"}[named.toLowerCase()]||a));
const strip=s=>decode(String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')).trim();
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s　・･「」『』（）()【】!！?？]/g,'');
const getId=s=>{const t=decode(s);return (t.match(/(?:\/card\/)?detail\/?\?[^\s"'<>]*?\bid=([a-z\d_-]+)/i)||t.match(/cardimage\/([a-z\d_-]+)\.(?:jpg|png|webp)/i)||[])[1]||''};
function extract(html,q){
 const found=new Map();
 // Official cards can use absolute/relative href, data-href, JS window.open,
 // or image URLs. Locate IDs independently of HTML attribute order.
 const re=/(?:\/card\/detail\/|\bdetail\/?)\?[^\s"'<>]{0,200}?\bid=[a-z\d_-]+|(?:\/cardimage\/)[a-z\d_-]+\.(?:jpg|png|webp)/gi;
 let m;
 while((m=re.exec(html))&&found.size<250){
  const id=getId(m[0]);if(!id||found.has(id.toLowerCase()))continue;
  const before=html.slice(Math.max(0,m.index-1600),m.index),after=html.slice(m.index,Math.min(html.length,m.index+1800));
  const nearby=before+after;
  const imgTags=[...nearby.matchAll(/<img\b[^>]*>/gi)].map(x=>x[0]);
  const candidates=[];
  for(const tag of imgTags){const alt=tag.match(/\b(?:alt|title)\s*=\s*["']([^"']+)["']/i)?.[1];if(alt)candidates.push(strip(alt));}
  for(const x of nearby.matchAll(/(?:data-card-name|data-name|title|alt)\s*=\s*["']([^"']+)["']/gi))candidates.push(strip(x[1]));
  for(const x of nearby.matchAll(/<(?:h[2-6]|p|span|div)\b[^>]*class\s*=\s*["'][^"']*(?:card[_-]?name|card[_-]?title|name)[^"']*["'][^>]*>([\s\S]{0,250}?)<\//gi))candidates.push(strip(x[1]));
  // A card image's alt can be missing; use visible text adjacent to link.
  for(const x of after.slice(0,550).matchAll(/>([^<>]{2,90})</g))candidates.push(strip(x[1]));
  const name=candidates.find(x=>x.length>=2&&x.length<130&&norm(x).includes(norm(q)))||'';
  if(!name)continue;
  found.set(id.toLowerCase(),{name,number:'',url:ORIGIN+'/card/detail/?id='+encodeURIComponent(id),image:ORIGIN+'/wp-content/card/cardimage/'+encodeURIComponent(id)+'.jpg'});
 }
 return [...found.values()];
}
function searchUrl(q,page){const payload={suggest:'on',keyword:q,keyword_type:['card_name','card_ruby','card_text'],culture_cond:['単色','多色'],pagenum:String(page),samename:'show',sort:'release_new'};return ORIGIN+'/card/?v='+encodeURIComponent(JSON.stringify(payload));}
async function official(url){const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),12000);try{const res=await fetch(url,{headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0'},signal:ctrl.signal,redirect:'follow'});if(!res.ok)throw Error('公式サイト HTTP '+res.status);return await res.text()}finally{clearTimeout(timeout)}}
export default {async fetch(request){
 if(request.method==='OPTIONS')return new Response(null,{headers:CORS});
 if(request.method!=='GET')return json({error:'GET only'},405);
 const u=new URL(request.url),q=(u.searchParams.get('q')||'').trim(),page=Math.max(1,Math.min(9999,Number(u.searchParams.get('page'))||1));
 if(q.length<2)return json({results:[],hasNext:false,error:'カード名を2文字以上入力してください。'});
 try{
  const html=await official(searchUrl(q,page));const results=extract(html,q);
  // Never mistake a successful HTML response for a successful card extraction.
  const pageCount=(html.match(/(?:\/card\/detail\/|\bdetail\/?)\?[^\s"'<>]{0,200}?\bid=[a-z\d_-]+/gi)||[]).length;
  const hasNext=results.length>0&&(new RegExp('(?:pagenum|page)[^<>]{0,100}(?:'+(page+1)+')|次のページ|next page','i').test(html));
  const out={results,hasNext,page,source:'official-live',warning:!results.length?'公式ページは取得できましたが、カード情報を抽出できませんでした。':undefined};
  if(u.searchParams.get('debug')==='1')out.debug={htmlLength:html.length,detailLinks:pageCount,cardImages:(html.match(/cardimage\//gi)||[]).length,hasCardTitle:html.includes('カード検索'),sample:html.slice(Math.max(0,html.search(/cardimage\/|\/card\/detail\/|detail\/?\?id=/i)-300),Math.max(0,html.search(/cardimage\/|\/card\/detail\/|detail\/?\?id=/i)-300)+1100)};
  return json(out);
 }catch(e){return json({results:[],hasNext:false,error:'公式検索へのアクセスに失敗しました: '+String(e.message||e)},502)}
}};
