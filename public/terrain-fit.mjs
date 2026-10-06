import * as THREE from 'three';

const smoothstep=t=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};

// Tripo supplies the actual walkable mesh. Only its heights and edge opacity are
// adapted to the World Labs collider; movement still raycasts the Tripo mesh.
export function fitTripoGroundToTerrain(ground,floorAt,{width=16,depth=16,centerX=0,centerZ=-5.3,samples=33}={}){
  const sourceBox=new THREE.Box3().setFromObject(ground),sourceSize=sourceBox.getSize(new THREE.Vector3()),sourceCenter=sourceBox.getCenter(new THREE.Vector3());
  if(sourceSize.x<=0||sourceSize.z<=0)throw new Error('Tripo 地面缺少有效宽度');
  const xMin=centerX-width/2,xMax=centerX+width/2,zMin=centerZ-depth/2,zMax=centerZ+depth/2;
  const heights=new Float32Array(samples*samples);
  for(let row=0;row<samples;row++)for(let col=0;col<samples;col++){
    const x=xMin+width*col/(samples-1),z=zMin+depth*row/(samples-1),y=floorAt(x,z);
    if(!Number.isFinite(y))throw new Error(`World Labs 碰撞地面缺少采样 (${x.toFixed(1)}, ${z.toFixed(1)})`);
    heights[row*samples+col]=y;
  }
  function sampledFloor(x,z){
    const u=Math.max(0,Math.min(samples-1,(x-xMin)/width*(samples-1))),v=Math.max(0,Math.min(samples-1,(z-zMin)/depth*(samples-1)));
    const col=Math.min(samples-2,Math.floor(u)),row=Math.min(samples-2,Math.floor(v)),fx=u-col,fz=v-row;
    const a=heights[row*samples+col],b=heights[row*samples+col+1],c=heights[(row+1)*samples+col],d=heights[(row+1)*samples+col+1];
    return (a*(1-fx)+b*fx)*(1-fz)+(c*(1-fx)+d*fx)*fz;
  }
  ground.scale.set(width/sourceSize.x,1,depth/sourceSize.z);
  ground.position.set(centerX-sourceCenter.x*ground.scale.x,0,centerZ-sourceCenter.z*ground.scale.z);
  let vertexCount=0;
  ground.traverse(node=>{if(!node.isMesh)return;node.geometry=node.geometry.clone();const positions=node.geometry.getAttribute('position'),colors=new Float32Array(positions.count*4);
    for(let i=0;i<positions.count;i++){
      const x=ground.position.x+positions.getX(i)*ground.scale.x,z=ground.position.z+positions.getZ(i)*ground.scale.z;
      const edge=Math.max(Math.abs((x-centerX)/(width/2)),Math.abs((z-centerZ)/(depth/2)));
      const alpha=1-smoothstep((edge-.84)/.16),sink=.015*smoothstep((edge-.84)/.16);
      const localRelief=(positions.getY(i)-sourceBox.max.y)*.12;
      positions.setY(i,sampledFloor(x,z)+.015+localRelief-sink);
      colors.set([1,1,1,alpha],i*4);
    }
    positions.needsUpdate=true;node.geometry.setAttribute('color',new THREE.BufferAttribute(colors,4));node.geometry.computeVertexNormals();node.geometry.computeBoundingBox();node.geometry.computeBoundingSphere();vertexCount+=positions.count;
  });
  ground.updateMatrixWorld(true);
  return {bounds:new THREE.Box3().setFromObject(ground),sampledFloor,vertexCount,terrainRange:[Math.min(...heights),Math.max(...heights)]};
}
