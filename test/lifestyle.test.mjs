import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {buildLifestyleProps} from '../public/lifestyle-props.mjs';

test('生活痕迹贴合近景地面，保留未通过质检的新房屋模型',async()=>{
  const floorAt=(x,z)=>1+x*.02-z*.01;
  const props=buildLifestyleProps(floorAt);
  assert.ok(props.children.length>=14);
  assert.match(props.userData.placement,/非出土原位/);
  assert.equal(props.userData.revision,'visible-lifestyle-v2');
  const branchBounds=new THREE.Box3().setFromObject(new THREE.Group().add(...props.children.filter(item=>item.name.startsWith('推测枝材_')).map(item=>item.clone())));
  const branchSize=branchBounds.getSize(new THREE.Vector3());
  assert.ok(branchSize.x>1.5&&branchSize.y>.35,`枝材堆在成人视角下仍过小：${branchSize.toArray()}`);
  assert.ok(props.children.some(item=>item.name==='推测低矮作业木墩'));
  for(const item of props.children){
    assert.ok(Number.isFinite(item.position.y),`${item.name} 没有有效高度`);
    assert.ok(item.position.y>floorAt(item.position.x,item.position.z)-.1,`${item.name} 落入地面`);
  }
  const viewer=await readFile(new URL('../public/viewer-entry.js',import.meta.url),'utf8');
  assert.match(viewer,/buildLifestyleProps\(platformFloorAt,generated\)/);
  for(const name of ['branches','boneTools','refuse'])assert.match(viewer,new RegExp(`'${name}'`));
  assert.match(viewer,/repositionPot\(\.65,-3\.75/);
  assert.match(viewer,/shadeImportedProp\(model\)/);
  assert.match(viewer,/renderOrder=8/);
  assert.match(viewer,/metalness:0/);
  assert.doesNotMatch(viewer,/houseV2-v1\.glb/);
  const replaced=buildLifestyleProps(floorAt,{branches:true,boneTools:true,refuse:true});
  assert.equal(replaced.children.some(item=>item.name==='推测低矮作业木墩'),false);
  assert.equal(replaced.children.length,0);
});
