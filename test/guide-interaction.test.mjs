import test from 'node:test';
import assert from 'node:assert/strict';
import {guideLines,cleanSpoken} from '../data/guide-speech.mjs';
import {allowLocalWrite} from '../server.mjs';
import {createGuideDirector} from '../public/guide-interaction.mjs';
import {loadedBoneName} from '../public/guide-visual.mjs';
import {readFile} from 'node:fs/promises';
import {asset} from '../generation.mjs';

test('靠近房址只触发一次起身，沿有地面的路径靠近后讲解',()=>{
  const guide=createGuideDirector({x:0,z:0,speed:1,riseSeconds:.5,triggerDistance:5,stopDistance:2});
  const env={cameraX:0,cameraZ:4,houseDistance:4,floorAt:()=>0};
  let result=guide.update(.1,env);assert.equal(result.phase,'rising');
  for(let i=0;i<5;i++)result=guide.update(.1,env);
  assert.equal(result.phase,'walking');
  for(let i=0;i<30&&result.phase!=='speaking';i++)result=guide.update(.1,env);
  assert.equal(result.phase,'speaking');assert.equal(result.justSpoke,true);
  assert.equal(guide.update(.1,env).justSpoke,false);
  assert.ok(Math.hypot(result.x-env.cameraX,result.z-env.cameraZ)>=2-.001);
});

test('缺少地面或坡差过大时停止，不能走入空洞',()=>{
  const guide=createGuideDirector({x:0,z:0,riseSeconds:.1});
  const env={cameraX:0,cameraZ:5,houseDistance:2,floorAt:(x,z)=>z>.01?null:0};
  const result=guide.update(.1,env);
  assert.equal(result.phase,'speaking');assert.equal(result.z,0);
});

test('原 03 漫游加载绑定人物，讲解保留来源和语音回退',async()=>{
  const model=await asset('rigging/standingGuide-rigged-v1.glb');
  assert.equal(model.mime,'model/gltf-binary');
  assert.equal(model.bytes.toString('ascii',0,4),'glTF');
  const viewer=await readFile(new URL('../public/viewer-entry.js',import.meta.url),'utf8');
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(viewer,/mountGuideVisual\(/);
  assert.match(viewer,/onGuideSpeak/);
  assert.match(app,/\/api\/guide\/lines/);
  assert.match(app,/new Audio/);
  assert.doesNotMatch(app,/SpeechSynthesisUtterance/);
  assert.equal(allowLocalWrite('http://127.0.0.1:4317','127.0.0.1:4317',4317),true);
  assert.equal(allowLocalWrite('http://localhost:4317','localhost:4317',4317,'same-origin'),true);
  assert.equal(allowLocalWrite('null','127.0.0.1:4317',4317),true);
  assert.equal(allowLocalWrite('https://example.com','127.0.0.1:4317',4317,'cross-site'),false);
  assert.equal(cleanSpoken('灰褐罐子装水或煮鱼，河滩上捡的蚌壳也在里头。'),'');
  assert.match(html,/id="guideCaption"/);
  assert.match(html,/id="guideQuestion"/);
  assert.match(html,/dfz\.jl\.gov\.cn/);
  assert.equal(guideLines.length,4);
  assert.match(guideLines.map(line=>line.text).join(''),/八个柱洞/);
  assert.match(guideLines.map(line=>line.text).join(''),/之字纹/);
  for(const line of guideLines){
    assert.ok(line.text.length<=80,line.id);
    assert.equal(cleanSpoken(line.text),line.text);
    assert.doesNotMatch(line.text,/[：:—–]|不是.{0,12}而是/);
  }
});

test('GLTFLoader 清洗 Tripo 骨骼名后，漫游仍可找到根骨和动作关节',async()=>{
  const model=await asset('rigging/standingGuide-rigged-v1.glb');
  const json=JSON.parse(model.bytes.subarray(20,20+model.bytes.readUInt32LE(12)).toString('utf8'));
  const names=new Set(json.nodes.map(node=>node.name));
  for(const name of ['tripo::Root','tripo::Spine_0','tripo::0_Left_Limb_0','tripo::1_Left_Limb_0','tripo::0_Right_Limb_2','bone_25']){
    assert.ok(names.has(name),`GLB 中缺少 ${name}`);
    assert.equal(loadedBoneName(name),name.replaceAll(':',''));
  }
  assert.equal(json.animations?.length||0,0,'当前 Tripo 绑定文件本身尚无动作片段');
});
