import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {fitTripoGroundToTerrain} from '../public/terrain-fit.mjs';
import {buildLifestyleProps} from '../public/lifestyle-props.mjs';
import {createGuideDirector} from '../public/guide-interaction.mjs';

function meshWithoutTextures(bytes){
  const jsonLength=bytes.readUInt32LE(12);
  const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  const binaryStart=20+jsonLength+8;
  const primitive=gltf.meshes[0].primitives[0];
  const attribute=index=>{const accessor=gltf.accessors[index],view=gltf.bufferViews[accessor.bufferView],offset=bytes.byteOffset+binaryStart+(view.byteOffset||0)+(accessor.byteOffset||0);return {accessor,offset};};
  const position=attribute(primitive.attributes.POSITION),indices=attribute(primitive.indices);
  assert.equal(position.accessor.componentType,5126);
  assert.equal(indices.accessor.componentType,5125);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(bytes.buffer,position.offset,position.accessor.count*3),3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(bytes.buffer,indices.offset,indices.accessor.count),1));
  return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
}

test('Tripo 地面沿 World Labs 碰撞地形连续贴合，承载入口、陶罐和房址',async()=>{
  const world=JSON.parse(await readFile(new URL('../outputs/left-river-world.json',import.meta.url)));
  const colliderBytes=await readFile(new URL('../outputs/left-river-world-collider.glb',import.meta.url));
  const collider=(await new GLTFLoader().parseAsync(colliderBytes.buffer.slice(colliderBytes.byteOffset,colliderBytes.byteOffset+colliderBytes.byteLength),'')).scene;
  collider.scale.setScalar(world.metricScaleFactor);collider.quaternion.set(1,0,0,0);collider.position.y=world.groundPlaneOffset;
  collider.traverse(node=>{if(node.isMesh)node.material.side=THREE.DoubleSide;});collider.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(0,10,0),new THREE.Vector3(0,-1,0));
  const floorAt=(x,z)=>{ray.set(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0));return ray.intersectObject(collider,true)[0]?.point.y??null;};
  assert.ok(Number.isFinite(floorAt(0,0)));
  const groundBytes=await readFile(new URL('../outputs/nearfield/ground-v1.glb',import.meta.url));
  const ground=meshWithoutTextures(groundBytes),fit=fitTripoGroundToTerrain(ground,floorAt);
  assert.ok(fit.vertexCount>100);
  assert.ok(fit.terrainRange[1]>=fit.terrainRange[0]);
  const colors=ground.geometry.getAttribute('color');
  assert.ok(colors.itemSize===4);
  assert.ok(Array.from({length:colors.count},(_,i)=>colors.getW(i)).some(alpha=>alpha<.1));
  for(const [x,z] of [[0,-.35],[.65,-3.75],[-1.3,-7.3],[-3.65,-4.65],[-2.73,-3.98],[3.23,-5.54],[-5.4,-5.3],[5.4,-5.3]]){
    ray.set(new THREE.Vector3(x,fit.terrainRange[1]+10,z),new THREE.Vector3(0,-1,0));
    const top=ray.intersectObject(ground)[0]?.point.y;
    assert.ok(Number.isFinite(top),`Tripo 地面缺少落点 ${x}, ${z}`);
    assert.ok(Math.abs(top-floorAt(x,z))<.25,`Tripo 地面偏离对应地形: ${top-floorAt(x,z)}`);
  }
  const platformFloorAt=(x,z)=>{ray.set(new THREE.Vector3(x,fit.terrainRange[1]+10,z),new THREE.Vector3(0,-1,0));return ray.intersectObject(ground)[0]?.point.y??null;};
  const props=buildLifestyleProps(platformFloorAt);
  assert.equal(props.children.length,25,'新版近景物件未全部落在真实地面网格上');
  for(const prop of props.children){
    const surface=platformFloorAt(prop.position.x,prop.position.z);
    assert.ok(Number.isFinite(surface),`${prop.name} 没有平台地面`);
    assert.ok(prop.position.y>surface-.03,`${prop.name} 被埋入平台`);
  }
  const guide=createGuideDirector();
  const guideStart={x:-2.68,z:-4.36};
  let encounter;
  for(let i=0;i<120;i++)encounter=guide.update(.05,{cameraX:0,cameraZ:-2.3,houseDistance:2,floorAt:platformFloorAt});
  assert.equal(encounter.phase,'speaking','人物未能从房前沿真实平台地面走近玩家');
  assert.ok(encounter.z>guideStart.z+.25,'人物没有向玩家方向移动');
});
