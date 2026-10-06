import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {nearfieldState,asset} from '../generation.mjs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';

test('近景任务与未部署的房屋试验独立记录，场景仍使用贴地网格',async()=>{
  const state=await nearfieldState();
  assert.equal(state.status,'ready');
  assert.equal(state.phase,'一期后段');
  assert.equal(state.creditsConsumed,300);
  assert.equal(state.tasks.houseV2,'ready');
  for(const name of ['potV2','branches','boneTools','refuse','seatedGuide']){
    assert.equal(state.tasks[name],'ready');
    const model=await asset(state.assets[name==='potV2'?'pot':name].replace('/generated/',''));
    assert.equal(model.bytes.toString('ascii',0,4),'glTF');
  }
  assert.equal(state.experimentalHouse.deployed,false);
  for(const name of ['house','grass','grassLight']){
    assert.equal(state.tasks[name],'ready');
    const model=await asset(state.assets[name].replace('/generated/',''));
    assert.equal(model.mime,'model/gltf-binary');
    assert.equal(model.bytes.toString('ascii',0,4),'glTF');
  }
  assert.equal(state.tasks.ground,'ready');
  assert.ok(state.assets.groundTexture.endsWith('ground-texture-v1.png'));
  const ground=await asset(state.assets.groundModel.replace('/generated/',''));
  assert.equal(ground.bytes.toString('ascii',0,4),'glTF');
  const viewer=await readFile(new URL('../public/viewer-entry.js',import.meta.url),'utf8');
  assert.match(viewer,/loader\.loadAsync\(assets\.groundModel\)/);
  assert.match(viewer,/world\.walkFloorAt=platformFloorAt/);
  assert.match(viewer,/fitTripoGroundToTerrain\(ground,environmentFloorAt\)/);
  assert.doesNotMatch(viewer,/独立近景平台留空/);
  assert.match(viewer,/width:4\.8/);
  assert.match(viewer,/options\.platformMode\?\.45:\.7/);
  assert.match(viewer,/renderer\.shadowMap\.enabled=true/);
  assert.match(viewer,/assignNearfieldShadows\(group,ground\)/);
  assert.match(viewer,/node\.castShadow=false;node\.receiveShadow=false/);
});

test('近景房屋与草丛示意落点均处于现有碰撞网格覆盖内',async()=>{
  const world=JSON.parse(await readFile(new URL('../outputs/left-generation.json',import.meta.url))).plusWorld;
  const bytes=await readFile(new URL('../outputs/left-world-plus-collider.glb',import.meta.url));
  const collider=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  collider.scale.setScalar(world.metricScaleFactor);
  collider.quaternion.set(1,0,0,0);
  collider.position.y=world.groundPlaneOffset;
  collider.traverse(node=>{if(node.isMesh)node.material.side=THREE.DoubleSide;});
  collider.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  for(const [x,z] of [[-3.3,-9],[2.6,-4.8],[3.8,-6.2],[2.3,-7.4],[4.1,-8.1],[1.8,-9.2],[-1.4,-7]]){
    ray.set(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0));
    assert.ok(ray.intersectObject(collider,true).length>0,`落点 ${x},${z} 缺少地面`);
  }
});
