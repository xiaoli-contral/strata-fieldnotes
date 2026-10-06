import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

// Quaternius Universal Animation Library (CC0), mirrored at
// https://github.com/J-Ponzo/gltf-universal-animation-library .
// Its forward direction is +Z and its arms are held out. The Tripo guide
// faces +X with arms down, so copy each bone's swing relative to its own
// rest direction, then rotate that swing +90 degrees around Y. Copying the
// source quaternion directly only twists the hanging arms.
const sourceDir=path.resolve('outputs/motion/quaternius-ual1');
const sourceJSON=await readFile(path.join(sourceDir,'AnimationLibrary_Godot_Standard.gltf'),'utf8');
const sourceBIN=await readFile(path.join(sourceDir,'AnimationLibrary_Godot_Standard.bin'));
globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
const manager=new THREE.LoadingManager();
manager.setURLModifier(url=>url.endsWith('.bin')?`data:application/octet-stream;base64,${sourceBIN.toString('base64')}`:url);
const loaded=await new Promise((resolve,reject)=>new GLTFLoader(manager).parse(sourceJSON,'',resolve,reject));
const source=loaded.scene,clip=loaded.animations.find(animation=>animation.name==='Walk_Loop');
if(!clip||clip.duration<.5)throw new Error('CC0 来源缺少 Walk_Loop 动画');
const sourceBones=new Map();source.traverse(node=>{if(node.isBone)sourceBones.set(node.name,node);});
source.updateMatrixWorld(true);
const sourceRestPos=new Map([...sourceBones].map(([name,bone])=>[name,bone.getWorldPosition(new THREE.Vector3())]));

const targetBytes=await readFile('outputs/rigging/standingGuide-rigged-v1.glb');
if(targetBytes.toString('ascii',0,4)!=='glTF')throw new Error('Tripo 绑定文件不是 GLB');
const targetJSON=JSON.parse(targetBytes.subarray(20,20+targetBytes.readUInt32LE(12)).toString('utf8'));
const targetNodes=targetJSON.nodes.map((node,index)=>{
  const object=new THREE.Bone();object.name=node.name??`node_${index}`;
  if(node.matrix)object.matrix.fromArray(node.matrix).decompose(object.position,object.quaternion,object.scale);
  else{if(node.translation)object.position.fromArray(node.translation);if(node.rotation)object.quaternion.fromArray(node.rotation);if(node.scale)object.scale.fromArray(node.scale);}
  return object;
});
targetJSON.nodes.forEach((node,index)=>(node.children??[]).forEach(child=>targetNodes[index].add(targetNodes[child])));
const targetRoots=targetNodes.filter(node=>!node.parent);targetRoots.forEach(node=>node.updateMatrixWorld(true));
const targetByName=new Map(targetNodes.map(node=>[node.name,node]));
const targetRest=new Map(targetNodes.map(node=>[node,node.getWorldQuaternion(new THREE.Quaternion())]));
const targetLocalRest=new Map(targetNodes.map(node=>[node,node.quaternion.clone()]));

// Body side is based on world position, not Tripo's misleading limb labels:
// Quaternius .L (+X) rotates to Tripo -Z, and .R (-X) to Tripo +Z.
const mapping=new Map(Object.entries({
  'tripo::Root':'DEF-hips',
  'tripo::Spine_0':'DEF-spine001',
  'tripo::0_Right_Limb_0':'DEF-spine002',
  'tripo::0_Right_Limb_1':'DEF-spine003',
  'tripo::Head_0':'DEF-neck',
  'tripo::Head_1':'DEF-head',
  'tripo::0_Right_Limb_2':'DEF-shoulderL',
  'tripo::0_Right_Limb_3':'DEF-upper_armL',
  'tripo::0_Right_Limb_4':'DEF-forearmL',
  'tripo::0_Right_Limb_5':'DEF-handL',
  'bone_25':'DEF-shoulderR',
  'bone_26':'DEF-upper_armR',
  'bone_27':'DEF-forearmR',
  'bone_28':'DEF-handR',
  'tripo::1_Left_Limb_0':'DEF-thighL',
  'tripo::1_Left_Limb_1':'DEF-shinL',
  'tripo::1_Left_Limb_2':'DEF-footL',
  'tripo::1_Left_Limb_3':'DEF-toeL',
  'tripo::0_Left_Limb_0':'DEF-thighR',
  'tripo::0_Left_Limb_1':'DEF-shinR',
  'tripo::0_Left_Limb_2':'DEF-footR',
  'tripo::0_Left_Limb_3':'DEF-toeR'
}));
for(const [targetName,sourceName] of mapping){
  if(!targetByName.has(targetName)||!sourceBones.has(sourceName))throw new Error(`未找到骨骼 ${targetName} → ${sourceName}`);
}

const align=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2),alignInverse=align.clone().invert();
const primaryChild=new Map([
  ['tripo::Root','tripo::Spine_0'],
  ['tripo::Spine_0','tripo::0_Right_Limb_0'],
  ['tripo::0_Right_Limb_0','tripo::0_Right_Limb_1'],
  ['tripo::0_Right_Limb_1','tripo::Head_0'],
  ['tripo::Head_0','tripo::Head_1'],
  ['tripo::0_Right_Limb_2','tripo::0_Right_Limb_3'],
  ['tripo::0_Right_Limb_3','tripo::0_Right_Limb_4'],
  ['tripo::0_Right_Limb_4','tripo::0_Right_Limb_5'],
  ['bone_25','bone_26'],
  ['bone_26','bone_27'],
  ['bone_27','bone_28'],
  ['tripo::1_Left_Limb_0','tripo::1_Left_Limb_1'],
  ['tripo::1_Left_Limb_1','tripo::1_Left_Limb_2'],
  ['tripo::1_Left_Limb_2','tripo::1_Left_Limb_3'],
  ['tripo::0_Left_Limb_0','tripo::0_Left_Limb_1'],
  ['tripo::0_Left_Limb_1','tripo::0_Left_Limb_2'],
  ['tripo::0_Left_Limb_2','tripo::0_Left_Limb_3']
]);
const targetRestPos=new Map([...targetByName].map(([name,node])=>[name,node.getWorldPosition(new THREE.Vector3())]));
function swungDirection(targetName,childName){
  const sourceName=mapping.get(targetName),sourceChild=mapping.get(childName);
  const rest=sourceRestPos.get(sourceChild).clone().sub(sourceRestPos.get(sourceName));
  const animated=sourceBones.get(sourceChild).getWorldPosition(new THREE.Vector3()).sub(sourceBones.get(sourceName).getWorldPosition(new THREE.Vector3()));
  const targetRestDirection=targetRestPos.get(childName).clone().sub(targetRestPos.get(targetName));
  if(rest.lengthSq()<1e-8||animated.lengthSq()<1e-8||targetRestDirection.lengthSq()<1e-8)return targetRestDirection.normalize();
  const swing=new THREE.Quaternion().setFromUnitVectors(rest.normalize(),animated.normalize());
  return targetRestDirection.normalize().applyQuaternion(align.clone().multiply(swing).multiply(alignInverse));
}
function aimLocal(node,childName,desiredWorld){
  const axis=targetByName.get(childName).position.clone();
  if(axis.lengthSq()<1e-8)return targetLocalRest.get(node).clone();
  axis.normalize();
  const parentWorld=node.parent?node.parent.getWorldQuaternion(new THREE.Quaternion()):new THREE.Quaternion();
  const restLocal=targetLocalRest.get(node);
  const restInParent=axis.clone().applyQuaternion(restLocal);
  const desiredInParent=desiredWorld.clone().applyQuaternion(parentWorld.clone().invert());
  if(desiredInParent.lengthSq()<1e-8)return restLocal.clone();
  return new THREE.Quaternion().setFromUnitVectors(restInParent,desiredInParent.normalize()).multiply(restLocal.clone());
}
const armBones=new Set(['tripo::0_Right_Limb_2','tripo::0_Right_Limb_3','tripo::0_Right_Limb_4','tripo::0_Right_Limb_5','bone_25','bone_26','bone_27','bone_28']);
const arms=[
  {sourceShoulder:'DEF-upper_armL',sourceHand:'DEF-handL',upper:'tripo::0_Right_Limb_3',elbow:'tripo::0_Right_Limb_4',wrist:'tripo::0_Right_Limb_5'},
  {sourceShoulder:'DEF-upper_armR',sourceHand:'DEF-handR',upper:'bone_26',elbow:'bone_27',wrist:'bone_28'}
];
function poseTree(node){
  if(mapping.has(node.name)&&!armBones.has(node.name)){
    const childName=primaryChild.get(node.name);
    node.quaternion.copy(childName?aimLocal(node,childName,swungDirection(node.name,childName)):targetLocalRest.get(node));
  }
  node.updateMatrixWorld();
  for(const child of node.children)poseTree(child);
}
function solveArm(arm){
  const upper=targetByName.get(arm.upper),elbow=targetByName.get(arm.elbow),wrist=targetByName.get(arm.wrist);
  const sourceScale=targetRestPos.get(arm.wrist).distanceTo(targetRestPos.get(arm.upper))/Math.max(sourceRestPos.get(arm.sourceHand).distanceTo(sourceRestPos.get(arm.sourceShoulder)),1e-4);
  const delta=sourceBones.get(arm.sourceHand).getWorldPosition(new THREE.Vector3()).sub(sourceRestPos.get(arm.sourceHand)).applyQuaternion(align).multiplyScalar(sourceScale);
  upper.updateMatrixWorld();
  const shoulder=upper.getWorldPosition(new THREE.Vector3());
  const shoulderShift=shoulder.clone().sub(targetRestPos.get(arm.upper));
  const target=targetRestPos.get(arm.wrist).clone().add(shoulderShift).add(delta);
  const upperLen=elbow.position.length(),foreLen=wrist.position.length();
  const toTarget=target.clone().sub(shoulder);
  const dist=Math.min(upperLen+foreLen-.0001,Math.max(Math.abs(upperLen-foreLen)+.0001,toTarget.length()));
  toTarget.normalize();
  const cosShoulder=Math.min(1,Math.max(-1,(upperLen*upperLen+dist*dist-foreLen*foreLen)/(2*upperLen*dist)));
  const bend=Math.sin(Math.acos(cosShoulder));
  const restOffset=targetRestPos.get(arm.elbow).clone().sub(targetRestPos.get(arm.upper));
  const restReach=targetRestPos.get(arm.wrist).clone().sub(targetRestPos.get(arm.upper));
  const carry=new THREE.Quaternion().setFromUnitVectors(restReach.clone().normalize(),toTarget);
  const pole=shoulder.clone().add(restOffset.applyQuaternion(carry));
  const poleDir=pole.clone().sub(shoulder);
  const normal=new THREE.Vector3().crossVectors(toTarget,poleDir);
  if(normal.lengthSq()<1e-8)normal.set(0,0,1);
  normal.normalize();
  const bendDir=new THREE.Vector3().crossVectors(normal,toTarget).normalize();
  let elbowPos=shoulder.clone().addScaledVector(toTarget,upperLen*cosShoulder).addScaledVector(bendDir,upperLen*bend);
  if(elbowPos.clone().sub(shoulder).dot(poleDir)<0)elbowPos=shoulder.clone().addScaledVector(toTarget,upperLen*cosShoulder).addScaledVector(bendDir,-upperLen*bend);
  const handPos=shoulder.clone().addScaledVector(toTarget,dist);
  upper.quaternion.copy(aimLocal(upper,arm.elbow,elbowPos.clone().sub(shoulder)));
  upper.updateMatrixWorld();
  elbow.quaternion.copy(aimLocal(elbow,arm.wrist,handPos.clone().sub(elbow.getWorldPosition(new THREE.Vector3()))));
  elbow.updateMatrixWorld();
}
const mixer=new THREE.AnimationMixer(source);mixer.clipAction(clip).play();
const frameCount=Math.round(clip.duration*30),times=[],frames=new Map([...mapping.keys()].map(name=>[name,[]]));
const footSamples={plusZ:[],minusZ:[]},handSamples={plusZ:[],minusZ:[]};
for(let frame=0;frame<=frameCount;frame++){
  const time=clip.duration*frame/frameCount;times.push(Number(time.toFixed(6)));
  mixer.setTime(time);source.updateMatrixWorld(true);
  for(const name of mapping.keys())targetByName.get(name).quaternion.copy(targetLocalRest.get(targetByName.get(name)));
  targetRoots.forEach(node=>node.updateMatrixWorld(true));
  targetRoots.forEach(poseTree);
  for(const arm of arms)solveArm(arm);
  for(const [name,node] of targetByName)if(mapping.has(name))frames.get(name).push(...node.quaternion.toArray().map(value=>Number(value.toFixed(7))));
  for(const [side,foot,hand] of [['plusZ','tripo::0_Left_Limb_3','bone_28'],['minusZ','tripo::1_Left_Limb_3','tripo::0_Right_Limb_5']]){
    const footPoint=targetByName.get(foot).getWorldPosition(new THREE.Vector3());
    const handPoint=targetByName.get(hand).getWorldPosition(new THREE.Vector3());
    footSamples[side].push([footPoint.x,footPoint.y]);handSamples[side].push([handPoint.x,handPoint.y,handPoint.z]);
  }
}
const range=values=>Number((Math.max(...values)-Math.min(...values)).toFixed(4));
const correlation=(a,b)=>{const meanA=a.reduce((sum,v)=>sum+v,0)/a.length,meanB=b.reduce((sum,v)=>sum+v,0)/b.length;
  const numerator=a.reduce((sum,v,i)=>sum+(v-meanA)*(b[i]-meanB),0);
  const denominator=Math.sqrt(a.reduce((sum,v)=>sum+(v-meanA)**2,0)*b.reduce((sum,v)=>sum+(v-meanB)**2,0));
  return Number((numerator/denominator).toFixed(3));};
const metrics={sourceClip:clip.name,sourceDuration:clip.duration,frames:times.length,
  plusZFootForwardRange:range(footSamples.plusZ.map(p=>p[0])),
  minusZFootForwardRange:range(footSamples.minusZ.map(p=>p[0])),
  plusZFootHeightRange:range(footSamples.plusZ.map(p=>p[1])),
  minusZFootHeightRange:range(footSamples.minusZ.map(p=>p[1])),
  plusZHandForwardRange:range(handSamples.plusZ.map(p=>p[0])),
  minusZHandForwardRange:range(handSamples.minusZ.map(p=>p[0])),
  plusZHandSideRange:range(handSamples.plusZ.map(p=>p[2])),
  minusZHandSideRange:range(handSamples.minusZ.map(p=>p[2])),
  plusZHandHeightRange:range(handSamples.plusZ.map(p=>p[1])),
  minusZHandHeightRange:range(handSamples.minusZ.map(p=>p[1])),
  footForwardCorrelation:correlation(footSamples.plusZ.map(p=>p[0]),footSamples.minusZ.map(p=>p[0])),
  plusZFootHandCorrelation:correlation(footSamples.plusZ.map(p=>p[0]),handSamples.plusZ.map(p=>p[0])),
  minusZFootHandCorrelation:correlation(footSamples.minusZ.map(p=>p[0]),handSamples.minusZ.map(p=>p[0]))};
if(Math.min(metrics.plusZFootForwardRange,metrics.minusZFootForwardRange)<.035)throw new Error('重定向后脚部前后位移不足，拒绝导出');
if(metrics.footForwardCorrelation>-.2)throw new Error('左右脚没有形成交替前后步态，拒绝导出');
if(Math.min(metrics.plusZHandForwardRange,metrics.minusZHandForwardRange)<.08)throw new Error('重定向后手臂前后摆动不足，拒绝导出');
if(metrics.plusZFootHandCorrelation>-.2||metrics.minusZFootHandCorrelation>-.2)throw new Error('同侧手脚没有反相，拒绝导出');
const output={schemaVersion:1,source:'Quaternius Universal Animation Library / Walk_Loop / CC0',
  sourceUrl:'https://quaternius.com/packs/universalanimationlibrary.html',
  duration:Number(clip.duration.toFixed(6)),fps:30,times,
  tracks:[...mapping.keys()].map(bone=>({bone,quaternions:frames.get(bone)})),metrics};
const outputFile=path.resolve('outputs/motion/standingGuide-walk-cc0-v1.json');
await mkdir(path.dirname(outputFile),{recursive:true});
await writeFile(outputFile,JSON.stringify(output));
console.log(JSON.stringify({outputFile,tracks:output.tracks.length,...metrics},null,2));
