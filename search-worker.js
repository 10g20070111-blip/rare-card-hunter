// RARE CARD HUNTER — Cloudflare Worker v2.31.7
// Live official search with bounded requests and useful diagnostics.
const ORIGIN = 'https://dm.takaratomy.co.jp';
const HEADERS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'};
const reply = (data,status=200) => Response.json(data,{status,headers:HEADERS});
const decode = s => String(s||'').replace(/&#(x[0-9a-f]+|\d+);|&(amp|quot|apos|lt|gt|nbsp);/gi,(all,num,named)=>num?String.fromCodePoint(parseInt(num[0].toLowerCase()==='x'?num.slice(1):num,num[0].toLowerCase()==='x'?16:10)):({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[named.toLowerCase()]||all));
const plain = s => decode(String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')).trim();
const norm = s => String(s||'').normalize('NFKC').toLowerCase().replace(/[\s　・･「」『』（）()【】!！?？]/g,'');
const attr = (tag,key) => decode((tag.match(new RegExp('(?:^|\\s)'+key+'\\s*=\\s*["\\x27]([^"\\x27]*)["\\x27]','i'))||[])[1]||'');
const idFrom = s => (String(s||'').match(/[?&]id=([\w-]+)/i)||[])[1]||'';
const urlFor = id => ORIGIN+'/card/detail/?id='+encodeURIComponent(id);
const searchUrl = (q,page) => ORIGIN+'/card/?v='+encodeURIComponent(JSON.stringify({suggest:'on',keyword:q,keyword_type:['card_name','card_ruby','card_text'],culture_cond:['単色','多色'],pagenum:String(page),samename:'show',sort:'release_new'}));
async function fetchHtml(url,options={}){const r=await fetch(url,{...options,headers:{Accept:'text/html,application/xhtml+xml',...(options.headers||{})},redirect:'follow',cf:{cacheTtl:0}});return {status:r.status,url:r.url,html:await r.text()};}
function searchBody(q,page){const p=new URLSearchParams();p.append('suggest','on');p.append('keyword',q);for(const t of ['card_name','card_ruby','card_text'])p.append('keyword_type[]',t);for(const c of ['単色','多色'])p.append('culture_cond[]',c);p.append('pagenum',String(page));p.append('samename','show');p.append('sort','release_new');return p.toString();}
async function searchOfficial(q,page){return fetchHtml(ORIGIN+'/card/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Origin':ORIGIN,'Referer':ORIGIN+'/card/','X-Requested-With':'XMLHttpRequest'},body:searchBody(q,page)});}

function collect(html){
 const cards=new Map();
 // The official response uses <li><a data-href="/card/detail/?id=...">...</a></li>.
 const list=(html.match(/<div\b[^>]*id\s*=\s*["']cardlist["'][^>]*>([\s\S]*?)<div\b[^>]*class\s*=\s*["'][^"']*pagerList01/i)||[])[1]||html;
 for(const match of list.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)){
  const block=match[0];
  const link=(block.match(/<a\b[^>]*>/i)||[])[0]||'';
  const id=idFrom(attr(link,'data-href')||attr(link,'href'));
  if(!id||cards.has(id.toLowerCase()))continue;
  const img=(block.match(/<img\b[^>]*>/i)||[])[0]||'';
  const imagePath=attr(img,'src')||attr(img,'data-src');
  const alt=attr(img,'alt').trim();
  cards.set(id.toLowerCase(),{id,name:alt&&alt!==' '?alt:'',number:'',url:urlFor(id),image:imagePath?new URL(imagePath,ORIGIN).href:''});
 }
 return [...cards.values()];
}
function totalCount(html){const m=html.match(/id\s*=\s*["']total_count["'][^>]*>\s*(\d+)/i);return m?Number(m[1]):null;}
function detailTitle(html){
 // The first h1/h2 on this website can be a site heading; the <title> is card-specific.
 const title=plain((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'').replace(/\s*[|｜]\s*デュエル[\s\S]*$/,'').trim();
 const heading=plain((html.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i)||[])[1]||'');
 const chosen=/\b(?:DM|DMP|DMRP|DMEX|BD)\d/i.test(title)?title:(title||heading);
 const m=chosen.match(/^(.+?)\s*[（(]([^()（）]*)[)）]/);
 return {name:m?m[1].trim():chosen,number:m?m[2].trim():''};
}
async function enrich(card){
 try{const d=await fetchHtml(card.url);if(d.status!==200)return {...card,_status:d.status};
  const info=detailTitle(d.html);
  const img=(d.html.match(/<img\b[^>]*(?:cardimage|cardthumb)[^>]*>/i)||[])[0]||'';
  const src=attr(img,'data-src')||attr(img,'src');
  return {...card,name:info.name||card.name,number:info.number||card.number,image:card.image||(src?new URL(src,ORIGIN).href:''),_status:d.status,_title:plain((d.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'')};
 }catch(e){return {...card,_error:String(e.message||e)}}
}
export default {async fetch(request){
 if(request.method==='OPTIONS')return new Response(null,{headers:HEADERS});
 if(request.method!=='GET')return reply({error:'GET only'},405);
 const u=new URL(request.url);
 const detailId=u.searchParams.get('detail');
 if(detailId!==null){
  if(!/^[a-z0-9-]{1,100}$/i.test(detailId))return reply({error:'Invalid card id'},400);
  try{const d=await fetchHtml(urlFor(detailId));if(d.status!==200)return reply({error:'Official detail HTTP '+d.status},502);return reply({html:d.html,source:'official-detail'});}
  catch(e){return reply({error:'Official detail fetch failed: '+String(e.message||e)},502);}
 }
 const q=(u.searchParams.get('q')||'').trim(),page=Math.max(1,Math.min(9999,Number(u.searchParams.get('page'))||1)),debug=u.searchParams.get('debug')==='1';
 if(q.length<2)return reply({results:[],hasNext:false,error:'カード名を2文字以上入力してください。'});
 try{
  // Chrome DevTools confirms the official search submits POST form data.
  // A GET ?v= page may return the unfiltered latest 50 cards; never accept it as search results.
  const upstream=ORIGIN+'/card/';
  const method='POST';
  const d=await searchOfficial(q,page);
  if(d.status!==200)return reply({results:[],hasNext:false,error:'公式サイトがHTTP '+d.status+'を返しました。',debug:debug?{requestMethod:method,upstream,finalUrl:d.url}:undefined},502);
  const cards=collect(d.html),count=totalCount(d.html);
  const targets=cards.slice(0,24);
  const resolved=[];
  for(let i=0;i<targets.length;i+=4)resolved.push(...await Promise.all(targets.slice(i,i+4).map(enrich)));
  // Do not filter official results by name: the official query also searches card text.
  const results=resolved.map(({_status,_title,_error,...rest})=>rest);
  const out={results,hasNext:count!==null?page*50<count:/class\s*=\s*["'][^"']*next[^"']*["']/i.test(d.html),page,source:'official-live',total:count,warning:results.length?undefined:'検索結果を抽出できませんでした。検索条件またはHTML構造を診断してください。'};
  if(debug){
   const title=plain((d.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'');
   const keywordInput=(d.html.match(/<input\b[^>]*name\s*=\s*["']keyword["'][^>]*>/i)||[])[0]||'';
   out.debug={version:'2.31.6',requestedKeyword:q,upstreamUrl:upstream,requestMethod:method,requestBody:searchBody(q,page),finalUrl:d.url,upstreamStatus:d.status,htmlLength:d.html.length,htmlContainsKeyword:d.html.includes(q),pageTitle:title,keywordInput:keywordInput.slice(0,350),cardBlocks:(d.html.match(/class\s*=\s*["'][^"']*cardImage/gi)||[]).length,foundCards:cards.length,officialTotal:count,firstIds:cards.slice(0,5).map(c=>c.id),firstListNames:cards.slice(0,5).map(c=>c.name),detailChecks:resolved.slice(0,3).map(c=>({id:c.id,name:c.name,status:c._status||null,error:c._error||null,title:c._title||null})),matchedCards:results.length};
  }
  return reply(out);
 }catch(e){return reply({results:[],hasNext:false,error:'公式検索へのアクセスに失敗しました: '+String(e.message||e)},502)}
}};
