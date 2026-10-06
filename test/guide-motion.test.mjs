import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {approachPose,speakingGestures} from '../public/guide-motion.mjs';

function skeletonFrom(gltf){
  const nodes=gltf.nodes.map(node=>{const object=new THREE.Object3D();object.name=node.name||'';if(node.matrix)object.matrix.fromArray(node.matrix).decompose(object.position,object.quaternion,object.scale);else{if(node.translation)object.position.fromArray(node.translation);if(node.rotation)object.quaternion.fromArray(node.rotation);}return object;});
  gltf.nodes.forEach((node,index)=>(node.children||[]).forEach(child=>nodes[index].add(nodes[child])));
  return {root:nodes[gltf.scenes[0].nodes[0]],find:name=>nodes.find(node=>node.name===name)};
}

test('参考视频走近在真实骨架上左右脚交替，手留在身体两侧',async()=>{
  const bytes=await readFile(new URL('../outputs/rigging/standingGuide-rigged-v1.glb',import.meta.url));
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  const {root,find}=skeletonFrom(gltf);
  const axisX=new THREE.Vector3(1,0,0),axisZ=new THREE.Vector3(0,0,1),delta=new THREE.Quaternion();
  const names=['tripo::0_Left_Limb_0','tripo::1_Left_Limb_0','tripo::0_Left_Limb_1','tripo::1_Left_Limb_1','tripo::0_Right_Limb_2','bone_25','tripo::0_Right_Limb_4','bone_27'];
  const rest=new Map(names.map(name=>[name,find(name).quaternion.clone()]));
  const apply=(name,parts)=>{const joint=find(name);joint.quaternion.copy(rest.get(name));for(const [axis,angle] of parts)joint.quaternion.multiply(delta.setFromAxisAngle(axis,angle));};
  const frames=24,feet={plus:[],minus:[]},hands={plus:[],minus:[]},wristZ={plus:[],minus:[]},fingerZ={plus:[],minus:[]};
  for(let frame=0;frame<frames;frame++){
    const pose=approachPose(frame/frames*Math.PI*2/5.2);
    apply('tripo::0_Left_Limb_0',[[axisX,pose.hipPlusZ]]);
    apply('tripo::1_Left_Limb_0',[[axisX,pose.hipMinusZ]]);
    apply('tripo::0_Left_Limb_1',[[axisX,pose.kneePlusZ]]);
    apply('tripo::1_Left_Limb_1',[[axisX,pose.kneeMinusZ]]);
    apply('tripo::0_Right_Limb_2',[[axisZ,pose.armDropMinusZ],[axisX,pose.armSwingMinusZ]]);
    apply('bone_25',[[axisX,pose.armDropPlusZ],[axisZ,pose.armSwingPlusZ]]);
    apply('tripo::0_Right_Limb_4',[[axisX,pose.elbowMinusZ]]);
    apply('bone_27',[[axisX,pose.elbowPlusZ]]);
    root.updateMatrixWorld(true);
    const at=name=>find(name).getWorldPosition(new THREE.Vector3());
    feet.plus.push(at('tripo::0_Left_Limb_3').x);feet.minus.push(at('tripo::1_Left_Limb_3').x);
    const plus=at('bone_28'),minus=at('tripo::0_Right_Limb_5');
    hands.plus.push(plus.x);hands.minus.push(minus.x);wristZ.plus.push(plus.z);wristZ.minus.push(minus.z);
    fingerZ.plus.push(at('bone_31').z);fingerZ.minus.push(at('bone_12').z);
  }
  const range=values=>Math.max(...values)-Math.min(...values);
  const correlation=(a,b)=>{const meanA=a.reduce((sum,value)=>sum+value,0)/a.length,meanB=b.reduce((sum,value)=>sum+value,0)/b.length;
    const numerator=a.reduce((sum,value,index)=>sum+(value-meanA)*(b[index]-meanB),0);
    const denominator=Math.sqrt(a.reduce((sum,value)=>sum+(value-meanA)**2,0)*b.reduce((sum,value)=>sum+(value-meanB)**2,0));
    return numerator/denominator;};
  assert.ok(range(feet.plus)>.15&&range(feet.minus)>.15);
  assert.ok(range(hands.plus)>.03&&range(hands.minus)>.03);
  assert.ok(Math.max(...hands.plus)<.12&&Math.max(...hands.minus)<.12);
  assert.ok(correlation(feet.plus,feet.minus)<-.5);
  assert.ok(correlation(feet.plus,hands.plus)<-.4);
  assert.ok(correlation(feet.minus,hands.minus)<-.4);
  assert.ok(Math.min(...wristZ.plus)>.16&&Math.max(...wristZ.minus)<-.16);
  assert.ok(Math.min(...fingerZ.plus)>.13&&Math.max(...fingerZ.minus)<-.13);
});

test('讲述时双臂低幅度且不同步，走近使用参考视频垂臂',async()=>{
  const first=speakingGestures(0),later=speakingGestures(.7);
  assert.notEqual(first.armPlusZ,first.armMinusZ);
  assert.notEqual(first.armPlusZ,later.armPlusZ);
  for(const amount of Object.values({...first,...later}))assert.ok(Math.abs(amount)<.2);
  const viewer=await readFile(new URL('../public/viewer-entry.js',import.meta.url),'utf8');
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const visual=await readFile(new URL('../public/guide-visual.mjs',import.meta.url),'utf8');
  assert.match(viewer,/setGuideSpeechActive/);
  assert.match(app,/audio\.onended=.*guideTalking\(false\)/);
  assert.match(app,/stopGuideSpeech\(\)/);
  assert.match(visual,/joints\.head\.attach\(mouth\)/);
  assert.match(visual,/approachPose\(result\.walkTime\)/);
  assert.match(visual,/guideFacingYaw\(result\.x,result\.z,camera\.position\.x,camera\.position\.z\)/);
  assert.doesNotMatch(visual,/sampleWalkPose|gaitAngles/);
});
