// 远景是 World Labs 溅射世界。Tripo 地面贴着它的碰撞体，房屋、罐子、人和杂物叠在这块地面上。
// 阴影只打在近景网格和人物上。溅射河面收不到这块阴影。
import * as THREE from 'three';
import {SparkRenderer,SplatMesh,SplatLoader,SplatEdit,SplatEditSdf,SplatEditSdfType} from '@sparkjsdev/spark';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {fitTripoGroundToTerrain} from './terrain-fit.mjs';
import {buildLifestyleProps} from './lifestyle-props.mjs';
import {mountGuideVisual} from './guide-visual.mjs';
import {movementVector} from './navigation.mjs';

function size(renderer,camera,canvas){const rect=canvas.getBoundingClientRect();renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height),false);camera.aspect=Math.max(1,rect.width)/Math.max(1,rect.height);camera.updateProjectionMatrix();}
let worldInstance=null,worldLoad=Promise.resolve(),ambience=null;
const eyeHeight=1.54,bodyRadius=.24;
function markCaster(root){root.traverse(node=>{if(!node.isMesh||node.userData.speechMouth)return;node.castShadow=true;node.receiveShadow=true;});}
function shadeImportedProp(root){root.traverse(node=>{if(!node.isMesh)return;const sources=Array.isArray(node.material)?node.material:[node.material];const shaded=sources.map(source=>{const material=new THREE.MeshStandardMaterial({map:source.map||null,normalMap:source.normalMap||null,roughnessMap:source.roughnessMap||null,color:0xffffff,metalness:0,roughness:.82,transparent:true,opacity:1,depthWrite:true,depthTest:true,side:THREE.FrontSide});if(material.map)material.map.colorSpace=THREE.SRGBColorSpace;return material;});node.material=Array.isArray(node.material)?shaded:shaded[0];node.castShadow=true;node.receiveShadow=true;node.renderOrder=8;});}
function assignNearfieldShadows(group,ground){const soil=new Set();ground.traverse(node=>{if(!node.isMesh)return;node.castShadow=false;node.receiveShadow=true;soil.add(node);});group.traverse(node=>{if(!node.isMesh||soil.has(node)||node.userData.speechMouth)return;node.castShadow=true;node.receiveShadow=true;});}
function frameSunShadow(light,box){const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),reach=Math.hypot(size.x,size.z)*.5+3,direction=new THREE.Vector3(3,7,2).normalize();light.position.copy(center).addScaledVector(direction,16);light.target.position.copy(center);light.target.updateMatrixWorld();const camera=light.shadow.camera;camera.left=camera.bottom=-reach;camera.right=camera.top=reach;camera.near=.5;camera.far=16+reach+8;camera.updateProjectionMatrix();}
function cue(){try{const context=new (window.AudioContext||window.webkitAudioContext)(),tone=context.createOscillator(),gain=context.createGain();tone.type='sine';tone.frequency.setValueAtTime(520,context.currentTime);tone.frequency.exponentialRampToValueAtTime(330,context.currentTime+.12);gain.gain.setValueAtTime(.07,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.17);tone.connect(gain).connect(context.destination);tone.start();tone.stop(context.currentTime+.18);tone.onended=()=>context.close();}catch{}}
function footstep(){if(!ambience)return;const {context}=ambience,duration=.11,length=Math.round(context.sampleRate*duration),buffer=context.createBuffer(1,length,context.sampleRate),values=buffer.getChannelData(0);for(let i=0;i<length;i++)values[i]=(Math.random()*2-1)*Math.pow(1-i/length,2);const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=280;gain.gain.value=.065;source.connect(filter).connect(gain).connect(context.destination);source.start();source.stop(context.currentTime+duration);}
export async function toggleAmbientAudio(){if(ambience){await ambience.context.close();ambience=null;return false;}const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw new Error('音频不可用');const context=new Context();await context.resume();const length=context.sampleRate*2,buffer=context.createBuffer(1,length,context.sampleRate),values=buffer.getChannelData(0);let smooth=0;for(let i=0;i<length;i++){smooth=smooth*.985+(Math.random()*2-1)*.015;values[i]=smooth;}const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=650;gain.gain.value=.05;source.connect(filter).connect(gain).connect(context.destination);source.start();ambience={context,source};return true;}
export async function stopAmbientAudio(){if(!ambience)return;await ambience.context.close();ambience=null;}
export function setGuideSpeechActive(active){worldInstance?.guideVisual?.setTalking(active);}
export function mountWorld(url,options={}){worldLoad=worldLoad.catch(()=>{}).then(()=>mountWorldNow(url,options));return worldLoad;}
export function touchArtifact(){if(!worldInstance?.pot)return;worldInstance.keys.clear();cue();worldInstance.options.onArtifactTouch?.();}
export function touchHouse(){if(!worldInstance?.nearfieldActive)return;worldInstance.keys.clear();cue();worldInstance.options.onHouseTouch?.();}
function houseLayout(world,layout={}){const house=world.nearfieldHouse;if(!house)return null;const x=Number.isFinite(layout.x)?layout.x:-3.3,z=Number.isFinite(layout.z)?layout.z:-9,width=Number.isFinite(layout.width)?layout.width:3.6,yaw=Number.isFinite(layout.yaw)?layout.yaw:0;const floor=world.floorAt(x,z);if(floor===null)throw new Error(`房址落点 (${x}, ${z}) 没有碰撞地面`);house.position.set(0,0,0);house.rotation.set(0,yaw*Math.PI/180,0);house.scale.setScalar(width/world.nearfieldHouseSourceWidth);house.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(house),center=box.getCenter(new THREE.Vector3());house.position.add(new THREE.Vector3(x-center.x,floor-box.min.y,z-center.z));house.updateMatrixWorld(true);world.nearfieldHouseBounds=new THREE.Box3().setFromObject(house);world.nearfieldObstacles=[world.nearfieldHouseBounds];world.nearfieldLayout={x,z,width,yaw,floor};if(world.originalHouseMask){const bounds=world.nearfieldHouseBounds,top=bounds.max.y+.25,bottom=floor+.15;world.originalHouseMask.position.set(x,(top+bottom)/2,z);world.originalHouseMask.scale.set(bounds.max.x-bounds.min.x+.35,Math.max(.2,top-bottom),bounds.max.z-bounds.min.z+.35);}return world.nearfieldLayout;}
export function updateNearfieldHouse(layout){if(!worldInstance?.nearfieldHouse)throw new Error('请先开启近景层');return houseLayout(worldInstance,layout);}
export function armHouseDoorPick(){if(!worldInstance?.nearfieldActive)throw new Error('请先开启 A 方案近景层');worldInstance.pickHouseDoor=true;return true;}
export function setOriginalHouseMask(enabled){const world=worldInstance;if(!world?.nearfieldHouse)throw new Error('请先开启 A 方案近景层');if(!world.originalHouseMask){const edit=new SplatEdit({name:'A 方案旧房屋试验遮罩',softEdge:.15});const shape=new SplatEditSdf({type:SplatEditSdfType.BOX,opacity:1});edit.add(shape);world.scene.add(edit);world.originalHouseMask=shape;houseLayout(world,world.nearfieldLayout);}world.originalHouseMask.opacity=enabled?0:1;return enabled;}
export async function setNearfieldVisible(enabled,assets,layout={}){const world=worldInstance;if(!world?.collider)throw new Error('需要先载入配套碰撞地面');if(world.options.platformMode)return mountNearfieldPlatform(world,assets);if(!enabled){if(world.nearfieldGroup)world.nearfieldGroup.visible=false;if(world.originalHouseMask)world.originalHouseMask.opacity=1;world.nearfieldActive=false;world.nearfieldObstacles=[];return {house:false,grass:false};}if(world.nearfieldGroup){world.nearfieldGroup.visible=true;world.nearfieldActive=true;houseLayout(world,layout);return {house:true,grass:true,layout:world.nearfieldLayout};}
  if(!assets?.house||!assets?.grass||!assets?.grassLight||!assets?.groundTexture)throw new Error('近景组件尚未齐备');
  const loader=new GLTFLoader();const [houseFile,grassFile,grassLightFile,texture]=await Promise.all([loader.loadAsync(assets.house),loader.loadAsync(assets.grass),loader.loadAsync(assets.grassLight),new THREE.TextureLoader().loadAsync(assets.groundTexture)]);
  const group=new THREE.Group();texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  // 只在局部坡度较缓的位置放小块土面；边缘淡出，避免跨台地和河岸拉成一张斜板。
  const pixels=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const distance=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5),a=Math.max(0,Math.min(1,(1-distance)*3));const i=(y*32+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=Math.round(a*255);pixels[i+3]=255;}
  const fade=new THREE.DataTexture(pixels,32,32,THREE.RGBAFormat);fade.needsUpdate=true;fade.magFilter=THREE.LinearFilter;
  let groundTiles=0;for(const z of [-1.4,-2.35,-3.3,-4.25,-5.2,-6.15,-7.1])for(const x of [-1.8,-.9,0,.9,1.8,2.7,3.6]){const geometry=new THREE.PlaneGeometry(.95,.95,4,4);geometry.rotateX(-Math.PI/2);geometry.translate(x,0,z);const positions=geometry.getAttribute('position'),heights=[];for(let i=0;i<positions.count;i++){const height=world.floorAt(positions.getX(i),positions.getZ(i));if(height===null)break;heights.push(height);}if(heights.length!==positions.count||Math.max(...heights)-Math.min(...heights)>.18){geometry.dispose();continue;}for(let i=0;i<positions.count;i++)positions.setY(i,heights[i]+.018);positions.needsUpdate=true;geometry.computeVertexNormals();const material=new THREE.MeshStandardMaterial({map:texture,alphaMap:fade,transparent:true,opacity:.78,roughness:1,side:THREE.DoubleSide,depthWrite:false});const tile=new THREE.Mesh(geometry,material);tile.receiveShadow=true;tile.castShadow=false;tile.renderOrder=2;group.add(tile);groundTiles++;}
  const house=houseFile.scene,sourceBox=new THREE.Box3().setFromObject(house),sourceSize=sourceBox.getSize(new THREE.Vector3());house.traverse(n=>{if(n.isMesh)n.renderOrder=3;});markCaster(house);group.add(house);world.nearfieldHouse=house;world.nearfieldHouseSourceWidth=Math.max(sourceSize.x,sourceSize.z,.01);houseLayout(world,layout);
  if(layout.extraPots&&world.pot){for(const [x,z,scaleFactor] of [[-1.1,-4.4,.62],[1.35,-6.2,.7]]){const floor=world.floorAt(x,z);if(floor===null)continue;const jar=world.pot.clone(true);jar.scale.multiplyScalar(scaleFactor);jar.position.set(0,0,0);jar.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(jar),center=box.getCenter(new THREE.Vector3());jar.position.set(x-center.x,floor-box.min.y,z-center.z);markCaster(jar);group.add(jar);}}
  const grassPositions=[[2.4,-2.4,.22],[3.6,-3.1,.29],[2.8,-4.2,.31],[4.0,-4.9,.4],[1.9,-5.6,.25],[3.25,-6.15,.35],[4.1,-6.9,.28],[2.2,-7.4,.38],[3.7,-8.1,.31],[1.5,-8.8,.2],[4.2,-9.2,.43],[.85,-10,.24],[-.75,-5.2,.19],[-1.3,-7.1,.22],[.7,-7.8,.2],[2.9,-10.4,.34]];let grasses=0;
  for(const [x,z,height] of grassPositions){const tuft=(grasses%3===0?grassLightFile:grassFile).scene.clone(true);tuft.traverse(n=>{if(n.isMesh)n.renderOrder=3;});const bounds=new THREE.Box3().setFromObject(tuft),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),floor=world.floorAt(x,z);if(floor===null||Math.abs(floor-world.camera.position.y+eyeHeight)>1.6)continue;const scale=height/Math.max(size.y,.01);tuft.scale.setScalar(scale);tuft.rotation.y=grasses*2.39996;tuft.position.set(x-center.x*scale,floor-bounds.min.y*scale,z-center.z*scale);markCaster(tuft);group.add(tuft);grasses++;}
  world.scene.add(group);world.nearfieldGroup=group;world.nearfieldActive=true;return {house:true,grass:grasses>0,grassCount:grasses,groundTiles,layout:world.nearfieldLayout};}
async function mountNearfieldPlatform(world,assets){
  if(world.platformMode)return {house:true,grass:true,grassCount:0,smallPropCount:0,generatedProps:[],guideStatus:world.guideVisual?'ready':'missing_or_failed',ground:'Tripo GLB',layout:world.nearfieldLayout};
  if(!assets?.house||!assets?.groundModel||!assets?.grass||!assets?.grassLight||!assets?.groundTexture)throw new Error('近景平台组件不齐');
  const loader=new GLTFLoader();const [groundFile,houseFile,darkFile,lightFile,texture]=await Promise.all([loader.loadAsync(assets.groundModel),loader.loadAsync(assets.house),loader.loadAsync(assets.grass),loader.loadAsync(assets.grassLight),new THREE.TextureLoader().loadAsync(assets.groundTexture)]);
  texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,4);texture.anisotropy=4;
  const group=new THREE.Group(),ground=groundFile.scene,environmentFloorAt=world.floorAt;
  const fit=fitTripoGroundToTerrain(ground,environmentFloorAt);
  ground.traverse(node=>{if(node.isMesh){node.material=new THREE.MeshStandardMaterial({map:texture,color:0xb8ad99,vertexColors:true,transparent:true,depthWrite:false,roughness:1,metalness:0,side:THREE.DoubleSide});node.renderOrder=2;}});
  group.add(ground);
  const groundBounds=fit.bounds,surfaceRay=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  function platformFloorAt(x,z){if(x<groundBounds.min.x+.12||x>groundBounds.max.x-.12||z<groundBounds.min.z+.12||z>groundBounds.max.z-.12)return null;surfaceRay.set(new THREE.Vector3(x,fit.terrainRange[1]+10,z),down);surfaceRay.far=30;return surfaceRay.intersectObject(ground,true)[0]?.point.y??null;}
  if(platformFloorAt(0,-.35)===null||platformFloorAt(-1.3,-7.3)===null||platformFloorAt(.65,-3.75)===null)throw new Error('Tripo 地面无法覆盖入口、房址或陶罐');
  world.environmentFloorAt=environmentFloorAt;world.floorAt=platformFloorAt;world.walkFloorAt=platformFloorAt;
  // Stay on the visible soil, but remove the former 0.8 m invisible fence.
  const inset=.16*8+.08;
  world.walkBounds={minX:groundBounds.min.x+inset,maxX:groundBounds.max.x-inset,minZ:groundBounds.min.z+inset,maxZ:groundBounds.max.z-inset};
  const house=houseFile.scene,sourceBox=new THREE.Box3().setFromObject(house),sourceSize=sourceBox.getSize(new THREE.Vector3());house.traverse(node=>{if(node.isMesh)node.renderOrder=3;});group.add(house);world.nearfieldHouse=house;world.nearfieldHouseSourceWidth=Math.max(sourceSize.x,sourceSize.z,.01);houseLayout(world,{x:-1.3,z:-7.3,width:4.8,yaw:12});
  world.repositionPot(.65,-3.75,platformFloorAt(.65,-3.75));
  const grassPositions=[[-3.8,-3.6,.18],[-4.1,-5.4,.26],[-3.6,-7.6,.33],[-2.8,-9.1,.35],[-.2,-9.8,.31],[1.8,-9.3,.32],[3.1,-8.4,.29],[4.0,-6.9,.25],[3.5,-5.2,.19],[-4.2,-9.1,.35],[3.8,-9.8,.36],[.3,-5.2,.14],[-2.5,-4.1,.17]];let grasses=0;
  for(const [x,z,height] of grassPositions){const floor=platformFloorAt(x,z);if(floor===null)continue;const tuft=(grasses%2?lightFile:darkFile).scene.clone(true),bounds=new THREE.Box3().setFromObject(tuft),tuftSize=bounds.getSize(new THREE.Vector3()),tuftCenter=bounds.getCenter(new THREE.Vector3()),scale=height/Math.max(tuftSize.y,.01);tuft.scale.setScalar(scale);tuft.rotation.y=grasses*2.4;tuft.position.set(x-tuftCenter.x*scale,floor-bounds.min.y*scale,z-tuftCenter.z*scale);tuft.traverse(node=>{if(node.isMesh)node.renderOrder=3;});group.add(tuft);grasses++;}
  const generated={};
  for(const [name,x,z,width,yaw,targetHeight] of [['branches',-3.52,-3.82,1.55,-12],['boneTools',-2.25,-3.48,.54,18],['refuse',2.68,-4.08,1.18,-8],['seatedGuide',-2.68,-4.36,1.05,12,1.05]]){
    if(!assets[name])continue;
    try{
      const floor=platformFloorAt(x,z);if(floor===null)continue;
      const model=(await loader.loadAsync(assets[name])).scene;
      const source=new THREE.Box3().setFromObject(model),size=source.getSize(new THREE.Vector3());
      if(!Number.isFinite(size.x)||Math.max(size.x,size.z)<.001)continue;
      model.scale.setScalar(targetHeight?targetHeight/Math.max(size.y,.01):width/Math.max(size.x,size.z));model.rotation.y=yaw*Math.PI/180;
      model.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());
      model.position.add(new THREE.Vector3(x-center.x,floor-box.min.y+.02,z-center.z));
      model.name=`Tripo_${name}_解释性摆放`;model.userData={phase:'一期后段',placement:'教学示意，非出土原位',source:assets[name]};
      if(name!=='seatedGuide')shadeImportedProp(model);
      model.traverse(node=>{if(node.isMesh)node.renderOrder=4;});group.add(model);generated[name]=true;
      if(name==='seatedGuide'){world.seatedGuide=model;world.nearfieldObstacles.push(new THREE.Box3().setFromObject(model));}
    }catch(error){console.warn(`近景组件 ${name} 未能载入，使用几何后备`,error);}
  }
  const lifestyleProps=buildLifestyleProps(platformFloorAt,generated);group.add(lifestyleProps);
  let guideStatus=world.seatedGuide?'loading':'missing_seated_model';
  if(world.seatedGuide){try{world.guideVisual=await mountGuideVisual({loader,group,seated:world.seatedGuide,floorAt:platformFloorAt});guideStatus='ready';}catch(error){guideStatus=`error: ${error.message}`;console.warn('人物绑定资产未能装入漫游，保留静态坐姿',error);}}
  assignNearfieldShadows(group,ground);if(world.sun)frameSunShadow(world.sun,groundBounds);world.scene.add(group);world.nearfieldGroup=group;world.platformGround=ground;world.platformMode=true;world.nearfieldActive=true;world.camera.position.set(0,platformFloorAt(0,-.35)+eyeHeight,-.35);
  return {house:true,grass:grasses>0,grassCount:grasses,smallPropCount:lifestyleProps.children.length+Object.keys(generated).length,generatedProps:Object.keys(generated),guideStatus,ground:'Tripo GLB fitted to World Labs collider',layout:world.nearfieldLayout,terrainRange:fit.terrainRange};
}
async function mountWorldNow(url,options){
  const canvas=document.querySelector('#worldCanvas');
  if(worldInstance?.url===url){worldInstance.options=options;return {colliderLoaded:!!worldInstance.collider,objectLoaded:!!worldInstance.pot};}
  if(worldInstance){worldInstance.renderer.setAnimationLoop(null);worldInstance.observer.disconnect();window.removeEventListener('keydown',worldInstance.keydown);window.removeEventListener('keyup',worldInstance.keyup);worldInstance.splats.dispose();worldInstance.renderer.dispose();worldInstance=null;}
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1,.05,1000);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));size(renderer,camera,canvas);
  scene.add(new SparkRenderer({renderer,view:{sort32:true}}));
  const scale=options.metricScaleFactor||1,offset=options.groundPlaneOffset||0;
  const packed=await new SplatLoader().loadAsync(url),splats=new SplatMesh({packedSplats:packed,raycastable:true});
  splats.scale.setScalar(scale);splats.quaternion.set(1,0,0,0);splats.position.y=offset;scene.add(splats);
  let collider=null;
  if(options.collider){try{collider=(await new GLTFLoader().loadAsync(options.collider)).scene;collider.scale.setScalar(scale);collider.quaternion.set(1,0,0,0);collider.position.y=offset;collider.traverse(node=>{if(node.isMesh){node.material.side=THREE.DoubleSide;node.material.visible=false;node.castShadow=false;node.receiveShadow=false;}});collider.updateMatrixWorld(true);scene.add(collider);}catch{collider=null;}}
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  function floorAt(x,z,from=10){if(!collider)return null;ray.set(new THREE.Vector3(x,from,z),down);ray.far=1000;return ray.intersectObject(collider,true)[0]?.point.y??null;}
  let floor=floorAt(0,0);camera.position.set(0,(floor??0)+eyeHeight,0);
  let pot=null,potBounds=null;
  if(options.objectUrl){try{pot=(await new GLTFLoader().loadAsync(options.objectUrl)).scene;const box=new THREE.Box3().setFromObject(pot),dims=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),potSize=options.platformMode?.45:.7;pot.scale.setScalar(potSize/Math.max(dims.x,dims.y,dims.z,.01));pot.position.copy(center).multiplyScalar(-pot.scale.x);const spot=new THREE.Vector3(0,0,-3),potFloor=floorAt(spot.x,spot.z);if(potFloor===null)throw new Error('陶罐位置没有可用地面');pot.position.add(new THREE.Vector3(spot.x,potFloor+potSize/2,spot.z));pot.traverse(node=>{if(node.isMesh)node.renderOrder=3;});markCaster(pot);scene.add(new THREE.HemisphereLight(0xffffff,0x635c51,1.15));const lamp=new THREE.DirectionalLight(0xffffff,3.4);lamp.position.set(3,7,2);lamp.castShadow=true;lamp.shadow.mapSize.set(2048,2048);lamp.shadow.bias=-.0004;lamp.shadow.normalBias=.035;lamp.shadow.radius=2;const shadowCamera=lamp.shadow.camera;shadowCamera.near=.5;shadowCamera.far=40;shadowCamera.left=shadowCamera.bottom=-14;shadowCamera.right=shadowCamera.top=14;shadowCamera.updateProjectionMatrix();scene.add(lamp);scene.add(lamp.target);scene.add(pot);potBounds=new THREE.Box3().setFromObject(pot);}catch{pot=null;}}
  function repositionPot(x,z,surfaceY){if(!pot||surfaceY===null)return;const box=new THREE.Box3().setFromObject(pot),center=box.getCenter(new THREE.Vector3());pot.position.add(new THREE.Vector3(x-center.x,surfaceY-box.min.y,z-center.z));pot.updateMatrixWorld(true);potBounds=new THREE.Box3().setFromObject(pot);}
  let yaw=0,pitch=-.08,drag=false,moved=false,lastX=0,lastY=0,lastTime=performance.now(),near=false,walked=0;
  const velocity=new THREE.Vector3();
  const keys=new Set(),active=()=>canvas.closest('.page.active')!==null,dialogOpen=()=>document.querySelector('#artifactDialog')?.hidden===false;
  const keydown=e=>{if(!active()||dialogOpen()||['TEXTAREA','INPUT','SELECT'].includes(document.activeElement?.tagName))return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e'].includes(k))e.preventDefault();keys.add(k);if(k==='e'&&near)touchArtifact();};
  const keyup=e=>keys.delete(e.key.toLowerCase());window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);
  canvas.addEventListener('pointerdown',e=>{drag=true;moved=false;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;if(Math.abs(dx)+Math.abs(dy)>2)moved=true;yaw-=dx*.004;pitch=Math.max(-1.2,Math.min(1.2,pitch-dy*.004));lastX=e.clientX;lastY=e.clientY;});
  canvas.addEventListener('pointerup',e=>{drag=false;if(!moved){const pointer=new THREE.Vector2((e.offsetX/canvas.clientWidth)*2-1,-(e.offsetY/canvas.clientHeight)*2+1),pick=new THREE.Raycaster();pick.setFromCamera(pointer,camera);if(worldInstance?.pickHouseDoor){worldInstance.pickHouseDoor=false;const hit=pick.intersectObject(splats,true)[0];if(hit){const door=hit.point,yaw=Math.atan2(camera.position.x-door.x,camera.position.z-door.z),front=Math.min(1.6,(worldInstance.nearfieldLayout?.width||3.6)*.42),layout={x:door.x-Math.sin(yaw)*front,z:door.z-Math.cos(yaw)*front,yaw:yaw*180/Math.PI,width:worldInstance.nearfieldLayout?.width||3.6};try{const placed=houseLayout(worldInstance,layout);worldInstance.options.onHouseCalibration?.({door:door.toArray(),layout:placed});}catch(error){worldInstance.options.onHouseCalibration?.({error:error.message});}}else worldInstance.options.onHouseCalibration?.({error:'未拾取到 World Labs 点云，请在可见的旧房门上再试一次'});return;}if(near&&pot&&pick.intersectObject(pot,true).length)touchArtifact();else if(worldInstance?.nearfieldActive&&worldInstance.nearfieldHouse&&worldInstance.nearfieldHouseBounds.distanceToPoint(camera.position)<5&&pick.intersectObject(worldInstance.nearfieldHouse,true).length)touchHouse();}});
  const observer=new ResizeObserver(()=>size(renderer,camera,canvas));observer.observe(canvas);
  renderer.setAnimationLoop(()=>{if(!active())return;const now=performance.now(),dt=Math.min((now-lastTime)/1000,.05);lastTime=now;camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);
    if(collider&&!dialogOpen()){const forward=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown')),side=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
      const heading=movementVector(yaw,forward,side),blend=1-Math.exp(-dt*10);
      velocity.x+=(heading.x*1.85-velocity.x)*blend;velocity.z+=(heading.z*1.85-velocity.z)*blend;
      const distance=Math.min(Math.hypot(velocity.x,velocity.z)*dt,.09);
      if(distance>.0005){const direction=new THREE.Vector3(velocity.x,0,velocity.z).normalize(),next=camera.position.clone().addScaledVector(direction,distance);let blocked=false;
        if(!worldInstance?.platformMode)for(const h of [.35,1.1]){ray.set(new THREE.Vector3(camera.position.x,camera.position.y-eyeHeight+h,camera.position.z),direction);ray.far=distance+bodyRadius;if(ray.intersectObject(collider,true).length){blocked=true;break;}}
        if(potBounds&&potBounds.distanceToPoint(new THREE.Vector3(next.x,potBounds.getCenter(new THREE.Vector3()).y,next.z))<bodyRadius)blocked=true;
        if(worldInstance?.nearfieldActive){const bounds=worldInstance.walkBounds;if(bounds&&(next.x<bounds.minX||next.x>bounds.maxX||next.z<bounds.minZ||next.z>bounds.maxZ))blocked=true;for(const obstacle of worldInstance.nearfieldObstacles||[]){const expanded=obstacle.clone().expandByScalar(bodyRadius);if(expanded.containsPoint(new THREE.Vector3(next.x,camera.position.y-eyeHeight+.8,next.z)))blocked=true;}}
        if(!blocked){const currentFloor=worldInstance?.walkFloorAt?worldInstance.walkFloorAt(camera.position.x,camera.position.z):floorAt(camera.position.x,camera.position.z),nextFloor=worldInstance?.walkFloorAt?worldInstance.walkFloorAt(next.x,next.z):floorAt(next.x,next.z,camera.position.y+2.5);if(nextFloor!==null&&currentFloor!==null&&Math.abs(nextFloor-currentFloor)<.45){camera.position.set(next.x,nextFloor+eyeHeight,next.z);walked+=distance;if(walked>.67){footstep();walked=0;}}else blocked=true;}
        if(blocked)velocity.multiplyScalar(.15);
      }
    }
    if(worldInstance?.guideVisual&&worldInstance.nearfieldHouseBounds&&!dialogOpen()){
      const houseDistance=worldInstance.nearfieldHouseBounds.distanceToPoint(camera.position);
      const blocked=(x,z)=>{const y=worldInstance.floorAt(x,z);if(y===null)return true;const point=new THREE.Vector3(x,y+.8,z),bounds=worldInstance.walkBounds;if(bounds&&(x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ))return true;return worldInstance.nearfieldHouseBounds.clone().expandByScalar(.3).containsPoint(point)||!!potBounds&&potBounds.clone().expandByScalar(.4).containsPoint(point);};
      const guide=worldInstance.guideVisual.update(dt,camera,houseDistance,blocked);
      const visible=guide.phase==='seated'?worldInstance.seatedGuide:worldInstance.guideVisual.root;
      worldInstance.nearfieldObstacles=[worldInstance.nearfieldHouseBounds,new THREE.Box3().setFromObject(visible)];
      if(guide.phase!==worldInstance.lastGuidePhase){worldInstance.lastGuidePhase=guide.phase;worldInstance.options.onGuidePhase?.(guide.phase);}
      if(guide.justSpoke)worldInstance.options.onGuideSpeak?.();
    }
    const isNear=!!pot&&new THREE.Vector2(camera.position.x-pot.position.x,camera.position.z-pot.position.z).length()<2.2;
    near=isNear;camera.updateMatrixWorld();if(pot){const marker=potBounds.getCenter(new THREE.Vector3());marker.y=potBounds.max.y+.3;marker.project(camera);const visible=isNear&&marker.z>-.9&&marker.z<1&&Math.abs(marker.x)<.92&&Math.abs(marker.y)<.88;worldInstance?.options.onArtifactNear?.({near:visible,x:(marker.x+1)*50,y:(1-marker.y)*50});}if(worldInstance?.nearfieldActive&&worldInstance.nearfieldHouseBounds){const bounds=worldInstance.nearfieldHouseBounds,marker=bounds.getCenter(new THREE.Vector3());marker.y=bounds.max.y+.2;const close=bounds.distanceToPoint(camera.position)<5;marker.project(camera);const visible=close&&marker.z>-.9&&marker.z<1&&Math.abs(marker.x)<.92&&Math.abs(marker.y)<.88;worldInstance.options.onHouseNear?.({near:visible,x:(marker.x+1)*50,y:(1-marker.y)*50});}else worldInstance?.options.onHouseNear?.({near:false,x:0,y:0});renderer.render(scene,camera);
  });
  worldInstance={url,options,renderer,observer,scene,camera,collider,pot,sun:scene.children.find(child=>child.isDirectionalLight)||null,splats,keys,keydown,keyup,floorAt,repositionPot,nearfieldGroup:null,nearfieldObstacles:[],nearfieldActive:false};
  return {colliderLoaded:!!collider,objectLoaded:!!pot};
}
