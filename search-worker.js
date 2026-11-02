// RARE CARD HUNTER — Cloudflare Worker v2.31.15
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
// Inspect actual image dimensions, so a portrait pack photo wins over a landscape banner.
// The first 64 KiB is enough for ordinary JPEG/PNG/WebP headers.
function imageSize(bytes,type){
 const b=new Uint8Array(bytes), dv=new DataView(bytes);
 if(b.length<24)return null;
 if(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)return {w:dv.getUint32(16),h:dv.getUint32(20)};
 if(b[0]===255&&b[1]===216){let i=2;while(i+9<b.length){if(b[i]!==255){i++;continue;}const marker=b[i+1];if(marker===255){i++;continue;}if(marker===216||marker===217){i+=2;continue;}const len=(b[i+2]<<8)|b[i+3];if(len<2||i+2+len>b.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {h:(b[i+5]<<8)|b[i+6],w:(b[i+7]<<8)|b[i+8]};i+=2+len;}}
 if(b.length>=30&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP'){
  const fmt=String.fromCharCode(...b.slice(12,16));
  if(fmt==='VP8X')return {w:1+b[24]+(b[25]<<8)+(b[26]<<16),h:1+b[27]+(b[28]<<8)+(b[29]<<16)};
  if(fmt==='VP8 '&&b.length>=30)return {w:((b[27]<<8)|b[26])&0x3fff,h:((b[29]<<8)|b[28])&0x3fff};
  if(fmt==='VP8L'&&b.length>=25)return {w:1+(((b[22]&0x3f)<<8)|b[21]),h:1+(((b[24]&15)<<10)|(b[23]<<2)|((b[22]&0xc0)>>6))};
 }
 return null;
}
async function probeImage(src){
 try{
  const r=await fetch(src,{headers:{Accept:'image/*',Range:'bytes=0-65535',Referer:ORIGIN+'/'},redirect:'follow',signal:AbortSignal.timeout(5500)});
  if(!r.ok||!/^image\//i.test(r.headers.get('content-type')||''))return null;
  // Some servers ignore Range; don't download giant images just to inspect dimensions.
  if(Number(r.headers.get('content-length')||0)>150000&&r.status!==206){await r.body?.cancel();return null;}
  const data=await r.arrayBuffer();return imageSize(data,r.headers.get('content-type')||'');
 }catch{return null}
}
export default {async fetch(request,env,ctx){
 if(request.method==='OPTIONS')return new Response(null,{headers:HEADERS});
 if(request.method!=='GET')return reply({error:'GET only'},405);
 const u=new URL(request.url);
 const imageUrl=u.searchParams.get('image');
 if(imageUrl!==null){
  let target;try{target=new URL(imageUrl)}catch{return reply({error:'Invalid image URL'},400)}
  // Only fetch images hosted on the official domain; prevent open proxy use.
  if(target.protocol!=='https:'||!(target.hostname==='dm.takaratomy.co.jp'||target.hostname.endsWith('.dm.takaratomy.co.jp'))||! /\.(?:png|jpe?g|webp)$/i.test(target.pathname))return reply({error:'Image URL not allowed'},400);
  try{
   const imageCache=typeof caches!=='undefined'?caches.default:null;
   if(imageCache){const hit=await imageCache.match(request);if(hit)return hit;}
   const response=await fetch(target.href,{headers:{Accept:'image/avif,image/webp,image/png,image/jpeg,image/*','Referer':ORIGIN+'/','User-Agent':'Mozilla/5.0'},redirect:'follow'});
   const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
   if(!response.ok||!['image/jpeg','image/png','image/webp','image/avif'].includes(type))return reply({error:'Official image unavailable',status:response.status,type},502);
   const out=new Response(response.body,{status:200,headers:{'Content-Type':type,'Cache-Control':'public, max-age=2592000, s-maxage=2592000','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'}});
   if(imageCache)ctx.waitUntil(imageCache.put(request,out.clone()));
   return out;
  }catch(e){return reply({error:'Image proxy failed: '+String(e.message||e)},502)}
 }
 const productUrl=u.searchParams.get('product');
 if(productUrl!==null){
  let target;
  try{target=new URL(productUrl)}catch{return reply({error:'Invalid product URL'},400)}
  if(target.protocol!=='https:'||target.hostname!=='dm.takaratomy.co.jp'||!target.pathname.startsWith('/product/'))return reply({error:'Product must be an official product page'},400);
  const cache=typeof caches!=='undefined'?caches.default:null;
  const cacheKey=new Request(new URL('/?product='+encodeURIComponent(target.href)+'&revision=23115',request.url).href);
  if(cache){const hit=await cache.match(cacheKey);if(hit)return hit;}
  try{
   const d=await fetchHtml(target.href);
   if(d.status!==200)return reply({error:'Official product HTTP '+d.status},502);
   const html=d.html;
   const slug=target.pathname.split('/').filter(Boolean).pop()||'';
   const imageCandidates=[];
   const add=(src,weight,source)=>{
    if(!src)return;
    let url;try{url=new URL(decode(src),d.url)}catch{return}
    if(url.protocol!=='https:'||!(url.hostname==='dm.takaratomy.co.jp'||url.hostname.endsWith('.dm.takaratomy.co.jp'))||!(/\.(png|jpe?g|webp)$/i.test(url.pathname)))return;
    if(/cardimage|cardthumb|\/card\/|\/cards\/|logo|icon|banner|bnr|noimage|placeholder|sprite/i.test(url.pathname))return;
    imageCandidates.push({url:url.href,weight,source});
   };
   // Product pages have a 商品内容 section with the actual package photograph.
   // Do not scan the card-list section: its images are individual trading cards.
   const contentAt=html.indexOf('商品内容');
   const listAt=html.search(/カードリスト|収録カード|class=["'][^"']*cardlist/i);
   if(contentAt>=0){
    const section=html.slice(contentAt, listAt>contentAt?Math.min(listAt,contentAt+14000):contentAt+14000);
    for(const m of section.matchAll(/<img\b[^>]*>/gi)){
     const tag=m[0], alt=attr(tag,'alt');
     const weight=alt.includes('DM')||alt.includes('デュエル')?150:115;
     for(const k of ['data-src','data-original','src'])add(attr(tag,k),weight,'product-content');
    }
   }
   // The product's hero image is usually before the explanatory/card-list images.
   const safeHtml=html.slice(0,listAt>0?listAt:Math.min(html.length,25000));
   for(const m of safeHtml.matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0], alt=attr(tag,'alt'), cls=attr(tag,'class');
    if(/カードをタップ|カード一覧|収録カード|クリーチャー/i.test(alt))continue;
    let weight=10;
    if(/DM\d{2}[- ]?(RP|EX|SD|BD|SP)/i.test(alt))weight+=75;
    if(/商品|パック|デッキ|pack|package/i.test(alt+' '+cls))weight+=55;
    if(m.index<18000)weight+=20;
    for(const k of ['data-src','data-original','src'])add(attr(tag,k),weight,'hero');
   }
   // The official product index supplies the exact cover image next to the
   // matching product link. This is safer than guessing from card images.
   const indexPages= /(?:SD|BD)/i.test(slug)?['/product/deck/','/product/']:['/product/expansion/','/product/'];
   const listings=await Promise.allSettled(indexPages.map(async path=>{
    const r=await fetch(ORIGIN+path,{headers:{Accept:'text/html'},cf:{cacheEverything:true,cacheTtl:3600},signal:AbortSignal.timeout(4500)});return r.ok?await r.text():'';
   }));
   for(const entry of listings){
    if(entry.status!=='fulfilled')continue;
    const listing=entry.value;
    const links=[...listing.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)];
    for(const m of links){
     let href;try{href=new URL(decode(m[1]),ORIGIN)}catch{continue}
     if(href.pathname.replace(/\/$/,'')!==target.pathname.replace(/\/$/,''))continue;
     const close=listing.indexOf('</a>',m.index);const near=listing.slice(m.index,close>m.index&&close-m.index<3500?close+4:Math.min(listing.length,m.index+650));
     // The image may be inside the anchor or in the same product tile.
     for(const im of near.matchAll(/<img\b[^>]*>/gi)){
      const tag=im[0],alt=attr(tag,'alt');
      if(/カードをタップ|カードリスト|収録カード/i.test(alt))continue;
      const weight=(alt.toLowerCase().includes(slug.toLowerCase())||attr(tag,'src').toLowerCase().includes(slug.toLowerCase()))?290:/パック|デッキ|商品|pack|package/i.test(alt)?230:170;
      for(const k of ['data-src','data-original','src'])add(attr(tag,k),weight,'product-index');
     }
    }
   }
   // Use metadata only if product-specific candidates do not exist.
   for(const m of html.matchAll(/<meta\b[^>]*>/gi)){
    const tag=m[0];if(/^(og:image|twitter:image)$/i.test(attr(tag,'property')||attr(tag,'name')))add(attr(tag,'content'),30,'metadata');
   }
   const unique=[...new Map(imageCandidates.map(x=>[x.url,x])).values()].sort((a,b)=>b.weight-a.weight);
   const best=unique[0];
   const originalImage=best?.url||'';
   const image=originalImage?new URL('/?image='+encodeURIComponent(originalImage),request.url).href:'';
   const result={image,originalImage,source:'official-product',url:d.url,candidates:unique.length,selection:best?.source||'missing',missing:!image};
   const response=reply(result);
   response.headers.set('Cache-Control',image?'public, max-age=86400, s-maxage=86400':'public, max-age=300, s-maxage=300');
   if(cache)ctx.waitUntil(cache.put(cacheKey,response.clone()));
   return response;
  }catch(e){return reply({error:'Product image lookup failed: '+String(e.message||e)},502)}
 }
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
   out.debug={version:'2.31.8',requestedKeyword:q,upstreamUrl:upstream,requestMethod:method,requestBody:searchBody(q,page),finalUrl:d.url,upstreamStatus:d.status,htmlLength:d.html.length,htmlContainsKeyword:d.html.includes(q),pageTitle:title,keywordInput:keywordInput.slice(0,350),cardBlocks:(d.html.match(/class\s*=\s*["'][^"']*cardImage/gi)||[]).length,foundCards:cards.length,officialTotal:count,firstIds:cards.slice(0,5).map(c=>c.id),firstListNames:cards.slice(0,5).map(c=>c.name),detailChecks:resolved.slice(0,3).map(c=>({id:c.id,name:c.name,status:c._status||null,error:c._error||null,title:c._title||null})),matchedCards:results.length};
  }
  return reply(out);
 }catch(e){return reply({results:[],hasNext:false,error:'公式検索へのアクセスに失敗しました: '+String(e.message||e)},502)}
}};
