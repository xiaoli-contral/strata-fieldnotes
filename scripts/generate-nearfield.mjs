import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

const base='https://openapi.tripo3d.ai/v3';
const directory=path.resolve('outputs/nearfield');
const statePath=path.join(directory,'tasks.json');
const items={
  house:{image:'house-reference-v1.png',faces:80000},
  ground:{image:'ground-texture-v1.png',faces:20000},
  grass:{image:'grass-dark-reference-v1.png',faces:30000},
  grassLight:{image:'grass-light-reference-v1.png',faces:30000},
  houseV2:{image:'../lifestyle/house-semidug-reference-v1.png',faces:80000},
  potV2:{image:'../lifestyle/pot-cylindrical-reference-v2.png',faces:40000},
  branches:{image:'../lifestyle/branches-reference-v1.png',faces:40000},
  boneTools:{image:'../lifestyle/bone-needle-awl-reference-v1.png',faces:20000},
  refuse:{image:'../lifestyle/refuse-reference-v1.png',faces:30000},
  seatedGuide:{image:'../lifestyle/guide-seated-reference-v1.png',faces:80000},
  standingGuide:{image:'../lifestyle/guide-standing-front-rig-reference-v1.png',faces:80000}
};
const [action,name]=process.argv.slice(2);
if(!['start','poll','status'].includes(action)||!items[name])throw new Error(`用法：node scripts/generate-nearfield.mjs start|poll|status ${Object.keys(items).join('|')}`);
if(!process.env.TRIPO_API_KEY)throw new Error('TRIPO_API_KEY 未配置');
await mkdir(directory,{recursive:true});
let state;
try{state=JSON.parse(await readFile(statePath,'utf8'));}catch{state={schemaVersion:1,site:'left',phase:'I-late',items:{}};}
async function save(){await writeFile(statePath,JSON.stringify(state,null,2),{mode:0o600});}
async function api(url,options={}){const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${process.env.TRIPO_API_KEY}`,...options.headers},signal:AbortSignal.timeout(60000)});const body=await response.json();if(!response.ok||body.code!==0)throw new Error(`Tripo 请求失败：HTTP ${response.status} / code ${body.code??'未知'}`);return body.data;}
async function download(url,filename,max=100e6){if(!url||new URL(url).protocol!=='https:')throw new Error('Tripo 资源地址无效');const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error(`下载失败：HTTP ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>max)throw new Error('资源超过大小限制');await writeFile(path.join(directory,filename),bytes,{mode:0o600});return bytes.length;}
if(action==='status'){console.log(JSON.stringify(state.items[name]||{status:'not_started'},null,2));process.exit(0);}
if(action==='start'){
  if(state.items[name]?.taskId){console.log(JSON.stringify({status:'already_submitted',item:name,taskId:state.items[name].taskId}));process.exit(0);}
  const image=await readFile(path.join(directory,items[name].image));
  const form=new FormData();form.set('file',new Blob([image],{type:'image/png'}),items[name].image);
  const uploaded=await api(`${base}/files`,{method:'POST',body:form});
  if(!uploaded.file_token)throw new Error('没有取得上传令牌');
  const request={input:uploaded.file_token,model:'v3.1-20260211',texture:true,pbr:true,texture_quality:'standard',orientation:'align_image',face_limit:items[name].faces};
  const task=await api(`${base}/generation/image-to-model`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  if(!task.task_id)throw new Error('Tripo 没有返回任务 ID');
  state.items[name]={status:'running',taskId:task.task_id,inputImage:items[name].image,modelVersion:request.model,estimatedCredits:30,submittedAt:new Date().toISOString()};
  await save();console.log(JSON.stringify({status:'running',item:name,taskId:task.task_id,estimatedCredits:30}));
}
if(action==='poll'){
  const item=state.items[name];if(!item?.taskId)throw new Error('此组件还没有提交任务');
  if(item.status==='ready'){console.log(JSON.stringify(item,null,2));process.exit(0);}
  const task=await api(`${base}/tasks/${encodeURIComponent(item.taskId)}`);
  item.progress=task.progress??0;
  if(['failed','cancelled','banned'].includes(task.status)){item.status='failed';item.error=task.error_message||task.status;}
  else if(task.status==='success'){
    const modelName=`${name}-v1.glb`,previewName=`${name}-preview-v1.png`;
    item.modelBytes=await download(task.output?.model_url,modelName);
    if(task.output?.rendered_image_url)item.previewBytes=await download(task.output.rendered_image_url,previewName,20e6);
    item.modelUrl=`/generated/nearfield/${modelName}`;item.preview=task.output?.rendered_image_url?`/generated/nearfield/${previewName}`:null;
    item.status='ready';item.creditsConsumed=task.credits_consumed??null;item.completedAt=new Date().toISOString();
  }
  await save();console.log(JSON.stringify({item:name,status:item.status,progress:item.progress,creditsConsumed:item.creditsConsumed??null,error:item.error??null}));
}
