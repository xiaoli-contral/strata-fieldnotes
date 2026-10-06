import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

const base='https://api.tripo3d.ai/v2/openapi/task';
const directory=path.resolve('outputs/rigging');
const statePath=path.join(directory,'tasks.json');
const [action,motionName='walk']=process.argv.slice(2);
if(!['start','poll'].includes(action)||!['walk','idle','walkAliasRetry'].includes(motionName)||action==='start'&&motionName==='walkAliasRetry')throw new Error('用法：node scripts/retarget-guide.mjs start walk|idle，或 poll walk|idle|walkAliasRetry');
if(!process.env.TRIPO_API_KEY)throw new Error('TRIPO_API_KEY 未配置');
await mkdir(directory,{recursive:true});
const state=JSON.parse(await readFile(statePath,'utf8'));
const item=state.items?.standingGuide;
if(item?.rig?.status!=='ready'||!item.rig.taskId)throw new Error('站姿人物骨骼绑定尚未完成');
async function save(){await writeFile(statePath,JSON.stringify(state,null,2),{mode:0o600});}
async function api(url,options={}){const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${process.env.TRIPO_API_KEY}`,...options.headers},signal:AbortSignal.timeout(60000)});const body=await response.json();if(!response.ok||body.code!==0)throw new Error(`Tripo 请求失败：HTTP ${response.status} / code ${body.code??'未知'} / ${String(body.message??'').slice(0,160)}`);return body.data;}
if(action==='start'){
  item.motionTrials??={};
  if(item.motionTrials[motionName]?.taskId){console.log(JSON.stringify({status:'already_submitted',taskId:item.motionTrials[motionName].taskId}));process.exit(0);}
  const request={type:'animate_retarget',original_model_task_id:item.rig.taskId,animation:`preset:${motionName}`,out_format:'glb',bake_animation:true,export_with_geometry:true};
  const result=await api(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  if(!result.task_id)throw new Error('Tripo 未返回动作任务编号');
  item.motionTrials[motionName]={taskId:result.task_id,status:'running',animation:request.animation,estimatedCredits:10,submittedAt:new Date().toISOString()};
  await save();console.log(JSON.stringify({status:'running',taskId:result.task_id,estimatedCredits:10}));
}
if(action==='poll'){
  const task=item.motionTrials?.[motionName];if(!task?.taskId)throw new Error('尚未提交动作任务');
  if(task.status==='ready'){console.log(JSON.stringify(task));process.exit(0);}
  const result=await api(`${base}/${encodeURIComponent(task.taskId)}`);
  task.progress=result.progress??0;
  if(['failed','banned','expired','cancelled','unknown'].includes(result.status)){task.status='failed';task.error=result.error_message||result.status;task.errorCode=result.error_code??null;task.creditsConsumed=result.consumed_credit??null;task.completedAt=new Date().toISOString();}
  else if(result.status==='success'){
    const url=result.output?.model??result.output?.model_url;
    if(!url||new URL(url).protocol!=='https:')throw new Error('动作任务没有安全的模型下载地址');
    const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error(`模型下载失败：HTTP ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>100e6)throw new Error('模型超过 100 MB');
    if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF')throw new Error('下载结果不是 GLB 文件');
    const jsonLength=bytes.readUInt32LE(12),document=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
    const fileName=motionName==='walkAliasRetry'?'standingGuide-walk-v2.glb':`standingGuide-${motionName}-v1.glb`;
    await writeFile(path.join(directory,fileName),bytes,{mode:0o600,flag:'wx'});
    task.modelBytes=bytes.length;task.modelUrl=`/generated/rigging/${fileName}`;task.creditsConsumed=result.consumed_credit??null;task.completedAt=new Date().toISOString();task.animationCount=document.animations?.length??0;
    task.status=task.animationCount>0?'ready':'invalid_no_animation';
  }
  await save();console.log(JSON.stringify({status:task.status,progress:task.progress,animationCount:task.animationCount??null,creditsConsumed:task.creditsConsumed??null,errorCode:task.errorCode??null,error:task.error??null}));
}
