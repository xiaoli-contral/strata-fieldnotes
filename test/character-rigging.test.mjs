import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

function glbJson(bytes){
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  const length=bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20,20+length).toString('utf8'));
}

test('绑定结果含双足人物骨骼与蒙皮，但不冒称已具备动作',async()=>{
  const state=JSON.parse(await readFile(new URL('../outputs/rigging/tasks.json',import.meta.url),'utf8'));
  assert.equal(state.items.seatedGuide.check.riggable,false);
  assert.equal(state.items.seatedGuide.rig,null);
  assert.equal(state.items.standingGuide.check.riggable,true);
  assert.equal(state.items.standingGuide.check.rigType,'biped');
  assert.equal(state.items.standingGuide.rig.status,'ready');
  assert.equal(state.items.standingGuide.rig.creditsConsumed,25);
  const source=glbJson(await readFile(new URL('../outputs/nearfield/standingGuide-v1.glb',import.meta.url)));
  const rigged=glbJson(await readFile(new URL('../outputs/rigging/standingGuide-rigged-v1.glb',import.meta.url)));
  assert.equal(source.skins?.length??0,0);
  assert.equal(rigged.skins?.length,1);
  assert.ok(rigged.skins[0].joints.length>=40);
  assert.equal(rigged.animations?.length??0,0);
});
