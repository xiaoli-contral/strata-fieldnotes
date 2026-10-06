import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'outputs');
const variant=process.argv.includes('--standard')?'standard':'plus';
const distant=process.argv.includes('--distant');
const clean=process.argv.includes('--clean');
const prefix=clean?'left-river-world':distant?'left-empty-world-distant':variant==='standard'?'left-empty-world-standard':'left-empty-world';
const record=path.join(out,`${prefix}.json`);
const image=path.join(out,clean?'left-river-environment-v1.png':distant?'left-phase1-empty-nearfield-v2.png':'left-phase1-empty-nearfield-v1.png');
const base='https://api.worldlabs.ai/marble/v1';
const key=process.env.WORLDLABS_API_KEY;
if(!key)throw new Error('WORLDLABS_API_KEY 未配置');
const headers={'WLT-Api-Key':key};
const mode=process.argv[2]||'status';
async function api(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(45000),redirect:'error'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`World Labs HTTP ${response.status}: ${JSON.stringify(data).slice(0,350)}`);return data;}
async function load(){try{return JSON.parse(await readFile(record,'utf8'));}catch{return {status:'not_started'};}}
async function save(value){await writeFile(record,JSON.stringify(value,null,2),{mode:0o600});return value;}
async function download(url,name,maxBytes){if(!url)return null;if(new URL(url).protocol!=='https:')throw new Error('资源协议不是 HTTPS');const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error(`资源下载 HTTP ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>maxBytes)throw new Error(`${name} 超过大小限制`);await writeFile(path.join(out,name),bytes,{mode:0o600});return `/generated/${name}`;}
if(mode==='start'){
  if(clean&&await load().then(value=>value.status!=='not_started'))throw new Error('纯河岸世界已尝试过；不会自动重复提交付费任务');
  const prior=await load();if(prior.status!=='failed'&&(prior.operationId||prior.worldId)){console.log(JSON.stringify(prior,null,2));process.exit(0);}
  const bytes=await readFile(image),fileName=path.basename(image);
  const prepared=await api(`${base}/media-assets:prepare_upload`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({file_name:fileName,kind:'image',extension:'png'})});
  const mediaAssetId=prepared.media_asset?.media_asset_id||prepared.media_asset?.id;
  const upload=prepared.upload_info;
  if(!mediaAssetId||upload?.upload_method!=='PUT'||!upload.upload_url||new URL(upload.upload_url).protocol!=='https:')throw new Error('上传预备结果不完整');
  const sent=await fetch(upload.upload_url,{method:'PUT',headers:upload.required_headers||{},body:bytes,signal:AbortSignal.timeout(120000),redirect:'error'});
  if(!sent.ok)throw new Error(`图片上传 HTTP ${sent.status}`);
  const prompt=clean?'Wide natural river terrace environment only, matching the uploaded image. Open compacted earth in the foreground for separately placed interactive 3D objects; low earthen bank to the left, river to the right, distant woodland, overcast daylight. No buildings, roofs, huts, pots, people, tools, paths or modern objects anywhere. Keep the near field free of obstacles. This is an educational landscape interpretation, not a claim of prehistoric appearance.':distant?'Interpretive river terrace environment for a Jilin Neolithic teaching scene. A walkable open sandy terrace in the near and middle ground, sparse mixed-height green and ochre grass, earthen bank left, river right, natural overcast light. A tiny hypothetical shelter silhouette may exist only far away on the horizon. The near field is open and reserved for separately placed interactive house and ceramic 3D models. Keep the input image composition and lighting. Educational visualization, not an archaeological photograph.':'Interpretive river terrace environment plate for a Jilin Neolithic archaeological teaching scene. Keep the near and middle ground as open, compacted sandy alluvial soil with sparse varied olive/yellow-green wild grass, a gently rising earthen bank to the left, river and reed-fringed bank to the right, natural overcast light. Preserve a broad empty walkable area near the camera for separately placed 3D objects. No buildings, roofs, huts, jars, pottery, people, baskets, tools, racks, firepits, paths or modern objects in the near or middle ground. Do not invent architectural remains. This is an educational visualization, not a claim of original appearance.';
  const body={display_name:clean?'左家山一期 · 纯河岸远景与独立近景':`左家山一期 · 空近景环境对照 B ${variant}`,model:variant==='standard'?'marble-1.1':'marble-1.1-plus',permission:{public:false},world_prompt:{type:'image',image_prompt:{source:'media_asset',media_asset_id:mediaAssetId},text_prompt:prompt}};
  const started=await api(`${base}/worlds:generate`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!started.operation_id)throw new Error('没有返回 operation_id');
  const attempts=[...(prior.attempts||[])];if(prior.status==='failed')attempts.push({operationId:prior.operationId,error:prior.error,startedAt:prior.startedAt});
  console.log(JSON.stringify(await save({status:'running',operationId:started.operation_id,mediaAssetId,model:body.model,prompt,sourceImage:'/generated/'+fileName,startedAt:new Date().toISOString(),estimatedCredits:variant==='standard'?1580:'1,580–3,080',attempts}),null,2));
}else if(mode==='poll'){
  const state=await load();if(state.status!=='running'){console.log(JSON.stringify(state,null,2));process.exit(0);}
  const operation=await api(`${base}/operations/${encodeURIComponent(state.operationId)}`,{headers});
  state.progress=operation.metadata?.progress?.description||operation.metadata?.progress?.status||null;
  if(operation.done){if(operation.error){state.status='failed';state.error=operation.error.message||'生成失败';}else{
    const id=operation.response?.world?.world_id||operation.response?.world?.id||operation.response?.world_id||operation.response?.id||operation.metadata?.world_id;
    if(!id)throw new Error('生成完成但未返回世界 ID');
    state.worldId=id;state.costCredits=operation.cost?.total_credits??null;
    const full=await api(`${base}/worlds/${encodeURIComponent(id)}`,{headers});const world=full.world||full,assets=world.assets||{};
    state.marbleUrl=world.world_marble_url||null;
    const semantic=assets.splats?.semantics_metadata||{};state.metricScaleFactor=semantic.metric_scale_factor??null;state.groundPlaneOffset=semantic.ground_plane_offset??null;
    state.thumbnail=await download(assets.thumbnail_url,`${prefix}-thumb.jpg`,15e6);
    state.pano=await download(assets.imagery?.pano_url,`${prefix}-pano.jpg`,45e6);
    state.splat=await download(assets.splats?.spz_urls?.['500k']||assets.splats?.spz_urls?.['100k'],`${prefix}-splat.spz`,100e6);
    state.collider=await download(assets.mesh?.collider_mesh_url,`${prefix}-collider.glb`,100e6);
    state.status=state.splat&&state.collider&&state.metricScaleFactor?'ready':'incomplete';state.completedAt=new Date().toISOString();
  }}
  console.log(JSON.stringify(await save(state),null,2));
}else if(mode==='status')console.log(JSON.stringify(await load(),null,2));
else throw new Error('用法：node scripts/generate-empty-world.mjs start|poll|status');
