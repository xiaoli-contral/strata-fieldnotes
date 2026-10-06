import {readFile} from 'node:fs/promises';

const file=process.argv[2]??'outputs/rigging/standingGuide-walk-v2.glb';
const bytes=await readFile(file);
if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF')throw new Error('文件不是有效 GLB');
const jsonLength=bytes.readUInt32LE(12);
const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
const clips=(gltf.animations??[]).map((animation,index)=>{
  const targets=animation.channels.map(channel=>({
    node:gltf.nodes[channel.target?.node]?.name??`node_${channel.target?.node}`,
    path:channel.target?.path
  }));
  const duration=Math.max(0,...animation.samplers.map(sampler=>gltf.accessors[sampler.input]?.max?.[0]??0));
  return {index,name:animation.name??null,durationSeconds:duration,channels:targets.length,
    legTargets:targets.filter(target=>/Limb/i.test(target.node)&&target.path==='rotation').map(target=>target.node),
    rootTranslationTargets:targets.filter(target=>target.path==='translation'&&/Root|Hips/i.test(target.node)).map(target=>target.node)};
});
console.log(JSON.stringify({file,skins:gltf.skins?.length??0,animationCount:clips.length,clips},null,2));
if(!clips.length)process.exitCode=1;
