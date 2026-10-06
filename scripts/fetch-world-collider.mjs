import {writeFile} from 'node:fs/promises';
import path from 'node:path';

const id=process.argv[2];
if(!/^[0-9a-f-]{36}$/i.test(id||''))throw new Error('需要已有 World Labs world ID');
if(!process.env.WORLDLABS_API_KEY)throw new Error('未配置 World Labs API key');
const response=await fetch(`https://api.worldlabs.ai/marble/v1/worlds/${id}`,{
  headers:{'WLT-Api-Key':process.env.WORLDLABS_API_KEY},signal:AbortSignal.timeout(30000)
});
if(!response.ok)throw new Error(`获取世界元数据失败：HTTP ${response.status}`);
const data=await response.json();
const assets=(data.world||data).assets;
const url=assets?.mesh?.collider_mesh_url;
const metadata=assets?.splats?.semantics_metadata||{};
if(!url||new URL(url).protocol!=='https:')throw new Error('现有世界没有安全的 collider_mesh_url');
const file=await fetch(url,{signal:AbortSignal.timeout(120000)});
if(!file.ok)throw new Error(`获取碰撞网格失败：HTTP ${file.status}`);
const bytes=Buffer.from(await file.arrayBuffer());
if(bytes.length>100e6)throw new Error('碰撞网格超过 100 MB 限制');
const output=path.resolve('outputs/left-world-plus-collider.glb');
await writeFile(output,bytes,{mode:0o600});
console.log(JSON.stringify({file:output,bytes:bytes.length,metricScaleFactor:metadata.metric_scale_factor??null,groundPlaneOffset:metadata.ground_plane_offset??null},null,2));
