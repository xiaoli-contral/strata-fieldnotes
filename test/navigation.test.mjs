import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {movementVector,guideFacingYaw} from '../public/navigation.mjs';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('W/S/A/D 在每个朝向均相对玩家视线移动',()=>{
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI*.73]){
    const cameraForward=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
    const cameraRight=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
    for(const [forward,side,target] of [[1,0,cameraForward],[-1,0,cameraForward.clone().negate()],[0,1,cameraRight],[0,-1,cameraRight.clone().negate()]]){
      const move=movementVector(yaw,forward,side);
      close(move.x,target.x);close(move.z,target.z);
    }
  }
  const diagonal=movementVector(0,1,1);
  close(Math.hypot(diagonal.x,diagonal.z),1);
});

test('人物讲述时经网格验证的模型正面 +X 始终朝向玩家',()=>{
  for(const [dx,dz] of [[0,1],[1,0],[0,-1],[-1,0],[2,3]]){
    const yaw=guideFacingYaw(0,0,dx,dz);
    const front=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
    const distance=Math.hypot(dx,dz);
    close(front.x,dx/distance);close(front.z,dz/distance);
  }
});
