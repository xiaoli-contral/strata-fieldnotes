// 左家山当前版本的本机入口。只听 127.0.0.1。照片文字走本机 Vision。
// 世界和物件的付费调用在 generation.mjs，页面默认只读已经下好的 outputs。
// 问句在 data/guide-speech.mjs，声音在 scripts/edge-speech.mjs。换地方前读 docs/左家山当前版本.md。
import http from 'node:http';
import {readFile,writeFile,mkdir,unlink,chmod} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {sites,sources,candidates,nearby} from './data/catalog.mjs';
import * as generation from './generation.mjs';
import {guideLines,guideVoice,replyToVisitor} from './data/guide-speech.mjs';
import {synthesizeSpeech} from './scripts/edge-speech.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),run=promisify(execFile),port=Number(process.env.PORT||4317);
const runtime=path.join(root,'.runtime');await mkdir(runtime,{recursive:true,mode:0o700});
if(existsSync(path.join(root,'.env.local')))await chmod(path.join(root,'.env.local'),0o600);
const staticFiles={'/':'index.html','/app.js':'app.js','/viewer.bundle.js':'viewer.bundle.js','/style.css':'style.css','/generation.css':'generation.css','/landscape.svg':'landscape.svg'};
staticFiles['/map-walk-boot.js']='map-walk-boot.js';
staticFiles['/map-walk-host.js']='map-walk-host.js';
staticFiles['/map-scene-bridge.js']='map-scene-bridge.js';
staticFiles['/map-scene-bridge.css']='map-scene-bridge.css';
// Only public map assets listed in the captured upstream manifest are served.
const mapManifestPath=path.join(root,'vendor/map-v06b/manifest.json');
const mapFiles=new Set(existsSync(mapManifestPath)?JSON.parse(await readFile(mapManifestPath,'utf8')).files.map(item=>'/v06b/'+item.file):[]);
let ocrBusy=false;const guideAsks=[];
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req,limit=20*1024*1024){let chunks=[],n=0;for await(const chunk of req){n+=chunk.length;if(n>limit){let e=new Error('文件超过 20MB');e.status=413;throw e;}chunks.push(chunk);}return Buffer.concat(chunks);}
async function readJSON(req){return JSON.parse((await body(req,65536)).toString());}
async function recognizeFile(file){
 if(!existsSync(path.join(runtime,'ocr'))){let e=new Error('本机 OCR 尚未构建，请运行 npm run ocr:build；也可以手动填写展签文字');e.status=503;throw e;}
 try{let {stdout}=await run(path.join(runtime,'ocr'),[file],{timeout:60000,maxBuffer:1024*1024});return JSON.parse(stdout);}
 catch{let e=new Error('本机文字识别未完成。请确认图片可读，或手动填写展签文字');e.status=422;throw e;}
}
async function provider(name){let world=name==='worldlabs',key=process.env[world?'WORLDLABS_API_KEY':'TRIPO_API_KEY'];if(!key)return {name,status:'missing',message:'服务端尚未配置密钥'};let url=world?'https://api.worldlabs.ai/marble/v1/credits':'https://openapi.tripo3d.ai/v3/account/balance';try{let response=await fetch(url,{headers:world?{'WLT-Api-Key':key}:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(18000),redirect:'error'});let data=await response.json().catch(()=>({}));if(response.ok&&(world||data.code===0))return {name,status:'connected',message:'只读鉴权通过，未提交生成任务',checkedAt:new Date().toISOString()};return {name,status:'rejected',httpStatus:response.status,message:response.status===401||response.status===403?'服务拒绝密钥，请检查 API 平台和账户权限':'服务未通过验证；HTTP '+response.status+(data.code!==undefined?' / code '+data.code:'')};}catch{return {name,status:'unreachable',message:'连接超时或网络不可达，可稍后重试'};}}
export function allowLocalWrite(origin,host,listenPort,fetchSite){
 if(!origin||origin==='null'||fetchSite==='same-origin'||fetchSite==='none')return true;
 try{const url=new URL(origin);if(host&&url.host.toLowerCase()===String(host).toLowerCase())return true;return ['localhost','127.0.0.1','::1'].includes(url.hostname)&&url.port===String(listenPort);}catch{return false;}
}
export const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),p=url.pathname;
 const allowedHosts=[`127.0.0.1:${port}`,`localhost:${port}`,`[::1]:${port}`];
 if(!allowedHosts.includes(req.headers.host))return json(res,403,{error:'仅允许本机访问'});
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','SAMEORIGIN');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' blob: data:; media-src 'self'; style-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
 if(req.method!=='GET'&&!allowLocalWrite(req.headers.origin,req.headers.host,port,req.headers['sec-fetch-site']))return json(res,403,{error:'请求来源不允许'});
 if(p==='/api/catalog'&&req.method==='GET')return json(res,200,{sites,sources});
 if(p==='/api/nearby'&&req.method==='POST'){let b=await readJSON(req);return json(res,200,{matches:nearby(b.lat,b.lon,b.accuracy||0)});}
 if(p==='/api/match'&&req.method==='POST'){let b=await readJSON(req);return json(res,200,{candidates:candidates(String(b.text||''))});}
 if(p==='/api/providers'&&req.method==='GET')return json(res,200,{providers:['worldlabs','tripo'].map(name=>({name,status:process.env[name==='worldlabs'?'WORLDLABS_API_KEY':'TRIPO_API_KEY']?'configured':'missing',message:'服务端配置状态；尚未验证连接'}))});
 if(p==='/api/providers/check'&&req.method==='POST')return json(res,200,{providers:await Promise.all(['worldlabs','tripo'].map(provider))});
 if(p==='/api/generation/plan'&&req.method==='GET')return json(res,200,generation.plan());
 if(p==='/api/generation/status'&&req.method==='GET')return json(res,200,await generation.state());
 if(p==='/api/nearfield/status'&&req.method==='GET')return json(res,200,await generation.nearfieldState());
 if(p==='/api/river-world/status'&&req.method==='GET')return json(res,200,await generation.riverWorldState());
 if(p==='/api/compare/empty-world/status'&&req.method==='GET')return json(res,200,await generation.emptyWorldState());
 if(p==='/api/generation/world/start'&&req.method==='POST')return json(res,200,await generation.startWorld());
 if(p==='/api/generation/world/refresh'&&req.method==='POST')return json(res,200,await generation.refreshWorld());
 if(p==='/api/generation/world/image/start'&&req.method==='POST')return json(res,200,await generation.startImageWorld());
 if(p==='/api/generation/world/image/refresh'&&req.method==='POST')return json(res,200,await generation.refreshImageWorld());
 if(p==='/api/generation/world/plus/start'&&req.method==='POST')return json(res,200,await generation.startPlusWorld());
 if(p==='/api/generation/world/plus/refresh'&&req.method==='POST')return json(res,200,await generation.refreshPlusWorld());
 if(p==='/api/generation/object/start'&&req.method==='POST')return json(res,200,await generation.startObject());
 if(p==='/api/generation/object/refresh'&&req.method==='POST')return json(res,200,await generation.refreshObject());
 if(p==='/api/guide/lines'&&req.method==='GET')return json(res,200,{voice:guideVoice.label,lines:guideLines.map(line=>({id:line.id,ask:line.ask,text:line.text,audio:`/api/guide/audio/${line.id}`}))});
 if(p.startsWith('/api/guide/audio/')&&req.method==='GET'){const id=p.slice('/api/guide/audio/'.length);if(!/^[a-z0-9-]{1,48}$/.test(id))return json(res,400,{error:'没有这段声音'});const file=path.join(root,'outputs/speech',`${id}.mp3`);if(!existsSync(file))return json(res,404,{error:'这段声音还没准备好'});res.writeHead(200,{'Content-Type':'audio/mpeg','Cache-Control':'private, max-age=86400'});return res.end(await readFile(file));}
 if(p==='/api/guide/reply'&&req.method==='POST'){const now=Date.now();while(guideAsks.length&&now-guideAsks[0]>60000)guideAsks.shift();if(guideAsks.length>=8)return json(res,429,{error:'问得太密了，稍等一下'});guideAsks.push(now);const asked=await readJSON(req);const answer=await replyToVisitor(asked.question);let id=answer.id;if(!answer.cached){id=`live-${createHash('sha256').update(answer.text).digest('hex').slice(0,16)}`;const file=path.join(root,'outputs/speech',`${id}.mp3`);if(!existsSync(file))await writeFile(file,await synthesizeSpeech(answer.text,guideVoice));}return json(res,200,{text:answer.text,audio:`/api/guide/audio/${id}`});}
 if(p.startsWith('/generated/')&&req.method==='GET'){let item=await generation.asset(p.slice('/generated/'.length));if(!item)return json(res,404,{error:'资源尚未生成'});res.writeHead(200,{'Content-Type':item.mime,'Cache-Control':'private, max-age=3600'});return res.end(item.bytes);}
 if(p==='/api/source/refresh'&&req.method==='POST'){let {id}=await readJSON(req),source=sources.find(x=>x.id===id);if(!source?.url.startsWith('https://'))return json(res,400,{error:'此来源是本地照片，无需在线更新'});try{let upstream=await fetch(source.url,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!upstream.ok)throw Error();let html=await upstream.text();if(html.length>3000000)throw Error();let title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g,'').trim();return json(res,200,{id,status:'reachable',title:title?.slice(0,200)||source.title,checkedAt:new Date().toISOString(),note:'已核验页面可达；内容仍使用人工核对的资料卡，未自动改写历史结论。'});}catch{return json(res,502,{error:'来源暂不可达，保留已核对的资料摘要'});}}
 if(p==='/api/ocr'&&req.method==='POST'){
  if(ocrBusy)return json(res,429,{error:'上一张照片仍在识别，请稍后再试'});
  ocrBusy=true;let file=path.join(runtime,randomUUID()+'.image');
  try{await writeFile(file,await body(req),{mode:0o600});let data=await recognizeFile(file);return json(res,200,{...data,candidates:candidates(data.text)});}finally{ocrBusy=false;await unlink(file).catch(()=>{});}
 }
 if(p==='/api/sample/recognize'&&req.method==='POST'){let data=await recognizeFile(path.join(root,'work/quicklook/IMG_3043.HEIC.png'));return json(res,200,{...data,candidates:candidates(data.text)});}
 if(p==='/samples/left'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'image/png'});return res.end(await readFile(path.join(root,'work/quicklook/IMG_3043.HEIC.png')));}
 if(mapFiles.has(p)&&req.method==='GET'){const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});return res.end(await readFile(path.join(root,'public',p.slice(1))));}
 if(staticFiles[p]&&req.method==='GET'){let ext=path.extname(staticFiles[p]),mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':mime[ext],'Cache-Control':'no-store'});return res.end(await readFile(path.join(root,'public',staticFiles[p])));}
 return json(res,404,{error:'未找到资源'});
 }catch(e){if(res.headersSent)return;json(res,e.status||400,{error:e.message==='坐标无效'?'位置参数无效':e.status===413||e.status===422||e.status===503?e.message:'请求未完成，请检查输入或稍后重试'});}});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(port,'127.0.0.1',()=>console.log(`STRATA ready: http://127.0.0.1:${port}`));
