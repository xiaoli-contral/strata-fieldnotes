import * as THREE from 'three';

// Interpretive props, never excavated object scans or recorded findspots.
// Keep the two clusters outside the path from the spawn point to the house.
export function buildLifestyleProps(floorAt,generated={}){
  const group=new THREE.Group();group.name='一期生活痕迹_解释性摆放_v2';
  const wood=new THREE.MeshStandardMaterial({color:0x654632,roughness:1});
  const paleWood=new THREE.MeshStandardMaterial({color:0x98734f,roughness:1});
  const cutWood=new THREE.MeshStandardMaterial({color:0xb69468,roughness:1});
  const stone=new THREE.MeshStandardMaterial({color:0x817a6e,roughness:1});
  const bone=new THREE.MeshStandardMaterial({color:0xc8bea4,roughness:1});
  const shell=new THREE.MeshStandardMaterial({color:0xd1c1a4,roughness:.85,side:THREE.DoubleSide});
  const sherd=new THREE.MeshStandardMaterial({color:0x765647,roughness:1,side:THREE.DoubleSide});
  const addRod=(name,x1,z1,x2,z2,radius,material,lift=0)=>{
    const y1=floorAt(x1,z1),y2=floorAt(x2,z2);if(y1===null||y2===null)return false;
    const a=new THREE.Vector3(x1,y1+radius+lift,z1),b=new THREE.Vector3(x2,y2+radius+lift,z2),direction=b.clone().sub(a);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius*.78,radius,direction.length(),8),material);
    mesh.name=name;mesh.position.copy(a.add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());mesh.renderOrder=4;group.add(mesh);return true;
  };
  const addStone=(name,x,z,sx,sy,sz)=>{const y=floorAt(x,z);if(y===null)return;const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),stone);mesh.name=name;mesh.scale.set(sx,sy,sz);mesh.position.set(x,y+sy*.72,z);mesh.renderOrder=4;group.add(mesh);};
  // Larger, stacked pieces read as a branch bundle from a 1.6 m adult eye height.
  // Material use and the exact pile position are visual conjecture.
  const branches=[
    [-4.15,-3.92,-2.45,-3.70,.083,.04],[-4.03,-3.62,-2.38,-3.91,.075,.10],
    [-3.96,-4.08,-2.62,-3.74,.092,.16],[-4.06,-3.75,-2.60,-4.05,.071,.23],
    [-3.75,-4.17,-2.40,-3.63,.066,.26],[-4.03,-3.51,-2.82,-3.98,.062,.32],
    [-3.63,-3.95,-2.36,-3.80,.052,.37],[-3.88,-3.69,-2.58,-3.66,.048,.42],
    [-3.88,-3.94,-3.27,-3.35,.037,.34],[-3.17,-4.09,-2.61,-3.43,.034,.29],
  ];
  if(!generated.branches)branches.forEach(([x1,z1,x2,z2,r,lift],i)=>addRod(`推测枝材_${i+1}`,x1,z1,x2,z2,r,i%3?paleWood:wood,lift));
  // The stump and pebbles are only the stand-in for when the Tripo pieces are absent.
  if(!generated.branches&&!generated.boneTools){
    const stumpX=-2.67,stumpZ=-3.17,stumpFloor=floorAt(stumpX,stumpZ);
    if(stumpFloor!==null){const stump=new THREE.Mesh(new THREE.CylinderGeometry(.29,.34,.36,11),wood);stump.name='推测低矮作业木墩';stump.position.set(stumpX,stumpFloor+.18,stumpZ);stump.renderOrder=4;group.add(stump);const top=new THREE.Mesh(new THREE.CylinderGeometry(.275,.275,.01,11),cutWood);top.name='作业木墩顶面';top.position.set(stumpX,stumpFloor+.365,stumpZ);top.renderOrder=5;group.add(top);}
    addStone('作业区卵石_1',-2.15,-3.55,.23,.115,.18);
    addStone('作业区卵石_2',-1.88,-3.80,.18,.09,.15);
    addStone('作业区卵石_3',-2.39,-3.89,.16,.08,.13);
  }
  // Bone needles and awls are attested categories, but their displayed forms and coordinates are schematic.
  if(!generated.boneTools){addRod('骨针类型示意',-2.32,-3.28,-2.07,-3.34,.018,bone,.14);addRod('骨锥类型示意',-2.36,-3.48,-2.06,-3.56,.028,bone,.15);}
  // Shell and fish remains are attested for the site as a whole, not this phase-I house.
  // They remain sparse and off the central walking route.
  if(!generated.refuse){[[2.48,-3.73,.22,.13],[2.81,-3.91,.18,.12],[2.61,-4.24,.20,.115]].forEach(([x,z,rx,rz],i)=>{const y=floorAt(x,z);if(y===null)return;const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),shell);mesh.name=`全遗址蚌壳线索_${i+1}`;mesh.scale.set(rx,.045,rz);mesh.position.set(x,y+.035,z);mesh.rotation.y=i*1.7;mesh.renderOrder=4;group.add(mesh);});
    [[2.65,-4.00,2.89,-4.09],[2.37,-4.12,2.55,-4.19],[2.86,-4.31,3.04,-4.34]].forEach(([x1,z1,x2,z2],i)=>addRod(`全遗址鱼骨线索_${i+1}`,x1,z1,x2,z2,.012,bone,.055));
    [[2.39,-3.98],[2.93,-4.47]].forEach(([x,z],i)=>{const y=floorAt(x,z);if(y===null)return;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.19,.14),sherd);mesh.name=`陶片类型示意_${i+1}`;mesh.rotation.set(-Math.PI/2,0,i*.7);mesh.position.set(x,y+.052,z);mesh.renderOrder=4;group.add(mesh);});}
  group.userData={phase:'一期后段',placement:'教学示意，非出土原位',items:group.children.length,revision:'visible-lifestyle-v2'};
  return group;
}
