import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

const base='https://api.tripo3d.ai/v2/openapi/task';
const outputDirectory=path.resolve('outputs/rigging');
const statePath=path.join(outputDirectory,'tasks.json');
const sourcePath=path.resolve('outputs/nearfield/tasks.json');
const [action,sourceName='seatedGuide']=process.argv.slice(2);
if(!['check','rig','poll'].includes(action))throw new Error('用法：node scripts/rig-character.mjs check|rig|poll [seatedGuide|standingGuide]');
if(!process.env.TRIPO_API_KEY)throw new Error('TRIPO_API_KEY 未配置');
await mkdir(outputDirectory,{recursive:true});
const sources=JSON.parse(await readFile(sourcePath,'utf8'));
const source=sources.items?.[sourceName];
if(source?.status!=='ready'||!source.taskId)throw new Error(`未找到已完成的人物原模型：${sourceName}`);
let state;
try{state=JSON.parse(await readFile(statePath,'utf8'));}catch{state={schemaVersion:1,items:{}};}
const item=state.items[sourceName]??={sourceTaskId:source.taskId,sourceModel:source.modelUrl,check:null,rig:null};
if(item.sourceTaskId!==source.taskId)throw new Error('原模型任务已变化，请先核对状态文件');
async function save(){await writeFile(statePath,JSON.stringify(state,null,2),{mode:0o600});}
async function api(url,options={}){
  const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${process.env.TRIPO_API_KEY}`,...options.headers},signal:AbortSignal.timeout(60000)});
  const body=await response.json();
  if(!response.ok||body.code!==0)throw new Error(`Tripo 请求失败：HTTP ${response.status} / code ${body.code??'未知'} / ${String(body.message??'').slice(0,160)}`);
  return body.data;
}
async function submit(type,fields){const result=await api(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,original_model_task_id:source.taskId,...fields})});if(!result.task_id)throw new Error('Tripo 未返回任务编号');return result.task_id;}
async function download(url,name){if(!url||new URL(url).protocol!=='https:')throw new Error('绑定结果缺少安全下载地址');const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error(`绑定资源下载失败：HTTP ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>100e6)throw new Error('绑定资源超过 100 MB');await writeFile(path.join(outputDirectory,name),bytes,{mode:0o600});return bytes.length;}
if(action==='check'){
  if(item.check?.taskId){console.log(JSON.stringify({status:'already_submitted',taskId:item.check.taskId}));process.exit(0);}
  item.check={taskId:await submit('animate_prerigcheck',{}),status:'running',submittedAt:new Date().toISOString()};
  await save();console.log(JSON.stringify({status:item.check.status,taskId:item.check.taskId}));
}
if(action==='rig'){
  if(item.check?.status!=='ready'||item.check.riggable!==true||item.check.rigType!=='biped')throw new Error('可绑定性检查未通过双足人物判定，停止付费绑定');
  if(item.rig?.taskId){console.log(JSON.stringify({status:'already_submitted',taskId:item.rig.taskId}));process.exit(0);}
  item.rig={taskId:await submit('animate_rig',{model_version:'v2.5-20260210',rig_type:'biped',spec:'tripo',out_format:'glb'}),status:'running',modelVersion:'v2.5-20260210',estimatedCredits:25,submittedAt:new Date().toISOString()};
  await save();console.log(JSON.stringify({status:item.rig.status,taskId:item.rig.taskId,estimatedCredits:25}));
}
if(action==='poll'){
  for(const [kind,task] of [['check',item.check],['rig',item.rig]]){
    if(!task?.taskId||['ready','failed'].includes(task.status))continue;
    const result=await api(`${base}/${encodeURIComponent(task.taskId)}`);
    task.progress=result.progress??0;
    if(['failed','banned','expired','cancelled','unknown'].includes(result.status)){task.status='failed';task.error=result.error_message||result.status;}
    else if(result.status==='success'){
      task.status='ready';task.completedAt=new Date().toISOString();task.creditsConsumed=result.consumed_credit??null;
      if(kind==='check'){
        task.riggable=result.output?.riggable===true;
        task.rigType=result.output?.rig_type??null;
        task.output=result.output??null;
      }else{
        const url=result.output?.model??result.output?.model_url;
        task.modelBytes=await download(url,`${sourceName}-rigged-v1.glb`);
        task.modelUrl=`/generated/rigging/${sourceName}-rigged-v1.glb`;
        if(result.output?.rendered_image){task.previewBytes=await download(result.output.rendered_image,`${sourceName}-rigged-preview-v1.png`);task.preview=`/generated/rigging/${sourceName}-rigged-preview-v1.png`;}
      }
    }
  }
  await save();console.log(JSON.stringify({source:sourceName,check:item.check,rig:item.rig}));
}
