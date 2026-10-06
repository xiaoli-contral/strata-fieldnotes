import * as THREE from 'three';
import {createGuideDirector} from './guide-interaction.mjs';
import {guideFacingYaw} from './navigation.mjs';
import {approachPose,speakingGestures} from './guide-motion.mjs';

const start={x:-2.68,z:-4.36};
export const loadedBoneName=name=>THREE.PropertyBinding.sanitizeNodeName(name);
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
function opacityFor(root,value){root.traverse(node=>{if(!node.isMesh||node.userData.speechMouth)return;for(const material of Array.isArray(node.material)?node.material:[node.material]){material.transparent=value<.999;material.depthWrite=value>=.999;material.opacity=value;}});}
function independentMaterials(root){root.traverse(node=>{if(node.isMesh)node.material=Array.isArray(node.material)?node.material.map(material=>material.clone()):node.material.clone();});}

export async function mountGuideVisual({loader,group,seated,floorAt}){
  if(!seated)return null;
  const file=await loader.loadAsync('/generated/rigging/standingGuide-rigged-v1.glb');
  const standing=file.scene;
  const source=new THREE.Box3().setFromObject(standing),size=source.getSize(new THREE.Vector3()),center=source.getCenter(new THREE.Vector3());
  // GLTFLoader strips ':' from bone names. Looking up the raw Tripo name
  // silently rejected a valid rig and left only the static seated mesh.
  const bone=name=>standing.getObjectByName(loadedBoneName(name));
  if(size.y<.001||!bone('tripo::Root'))throw new Error('站姿人物缺少有效尺寸或骨骼');
  const scale=1.62/size.y,root=new THREE.Group();
  standing.scale.setScalar(scale);
  standing.position.set(-center.x*scale,-source.min.y*scale,-center.z*scale);
  root.add(standing);root.visible=false;root.name='解释性人物_绑定站姿';
  group.add(root);
  independentMaterials(seated);independentMaterials(standing);
  const director=createGuideDirector(start);
  const joints={
    torso:bone('tripo::Spine_0'),head:bone('tripo::Head_0'),
    hipPlusZ:bone('tripo::0_Left_Limb_0'),hipMinusZ:bone('tripo::1_Left_Limb_0'),
    kneePlusZ:bone('tripo::0_Left_Limb_1'),kneeMinusZ:bone('tripo::1_Left_Limb_1'),
    armMinusZ:bone('tripo::0_Right_Limb_2'),armPlusZ:bone('bone_25'),
    elbowMinusZ:bone('tripo::0_Right_Limb_4'),elbowPlusZ:bone('bone_27')
  };
  if(Object.values(joints).some(joint=>!joint))throw new Error('人物骨骼不完整，无法驱动参考动作');
  const driven=['hipPlusZ','hipMinusZ','kneePlusZ','kneeMinusZ','armMinusZ','armPlusZ','elbowMinusZ','elbowPlusZ'];
  const toePlus=bone('tripo::0_Left_Limb_3'),toeMinus=bone('tripo::1_Left_Limb_3');
  root.updateMatrixWorld(true);
  const toeHeight=joint=>joint.getWorldPosition(new THREE.Vector3()).y;
  const restToeLift=Math.min(toeHeight(toePlus),toeHeight(toeMinus))-root.position.y;
  // The GLB has no facial morph targets. This small head-attached mouth slit
  // is an explicitly approximate expression cue, not phoneme lip-sync.
  const mouth=new THREE.Mesh(new THREE.CircleGeometry(1,20),new THREE.MeshBasicMaterial({color:0x3b211d,side:THREE.DoubleSide,transparent:true,opacity:.78,depthWrite:false}));
  mouth.name='教学示意_轻微口部张合';mouth.userData.speechMouth=true;mouth.position.set(.078,.858,0);mouth.rotation.y=Math.PI/2;mouth.scale.set(.019,.003,1);mouth.renderOrder=8;
  standing.add(mouth);standing.updateMatrixWorld(true);joints.head.attach(mouth);
  const mouthHeight=mouth.scale.y;mouth.visible=false;
  const rest=Object.fromEntries(Object.entries(joints).map(([name,joint])=>[name,joint.quaternion.clone()]));
  const axisX=new THREE.Vector3(1,0,0),axisZ=new THREE.Vector3(0,0,1),delta=new THREE.Quaternion(),held=new THREE.Quaternion();
  const pose=(name,angle,axis=axisX)=>joints[name].quaternion.copy(rest[name]).multiply(delta.setFromAxisAngle(axis,angle));
  const applyLocal=(name,parts)=>{joints[name].quaternion.copy(rest[name]);for(const [axis,angle] of parts)joints[name].quaternion.multiply(delta.setFromAxisAngle(axis,angle));};
  function applyAngles(frame){
    applyLocal('hipPlusZ',[[axisX,frame.hipPlusZ]]);
    applyLocal('hipMinusZ',[[axisX,frame.hipMinusZ]]);
    applyLocal('kneePlusZ',[[axisX,frame.kneePlusZ]]);
    applyLocal('kneeMinusZ',[[axisX,frame.kneeMinusZ]]);
    applyLocal('armMinusZ',[[axisZ,frame.armDropMinusZ],[axisX,frame.armSwingMinusZ]]);
    applyLocal('armPlusZ',[[axisX,frame.armDropPlusZ],[axisZ,frame.armSwingPlusZ]]);
    applyLocal('elbowMinusZ',[[axisX,frame.elbowMinusZ]]);
    applyLocal('elbowPlusZ',[[axisX,frame.elbowPlusZ]]);
  }
  function blendFromRest(amount){
    if(amount>=1)return;
    for(const name of driven){held.copy(joints[name].quaternion);joints[name].quaternion.copy(rest[name]).slerp(held,amount);}
  }
  let previous='seated',walkTargetYaw=0,talkTime=0,talking=false,stopPose=null,stopElapsed=0;
  function update(dt,camera,houseDistance,blocked){
    const result=director.update(dt,{cameraX:camera.position.x,cameraZ:camera.position.z,houseDistance,floorAt,blocked});
    const phase=result.phase,progress=phase==='rising'?smooth(result.riseProgress):1;
    if(phase==='seated'){root.visible=false;seated.visible=true;return result;}
    if(previous==='seated')walkTargetYaw=guideFacingYaw(start.x,start.z,camera.position.x,camera.position.z);
    const floor=floorAt(result.x,result.z);
    if(floor!==null)root.position.set(result.x,floor,result.z);
    root.visible=progress>.16;
    seated.visible=progress<.55;
    opacityFor(seated,1-smooth((progress-.16)/.39));
    opacityFor(standing,smooth((progress-.16)/.39));
    // Rising stays the crouch. Walking and the stop use the video-derived hang,
    // so the arms do not snap back out to the bind A-pose when the guide arrives.
    if(talking&&phase==='speaking')talkTime+=dt;
    const gestures=talking&&phase==='speaking'?speakingGestures(talkTime):{armMinusZ:0,armPlusZ:0};
    const crouch=phase==='rising'?1-progress:0;
    if(phase==='walking'){
      if(previous!=='walking')stopPose=null;
      applyAngles(approachPose(result.walkTime));
      blendFromRest(smooth(result.walkTime/.26));
      standing.updateMatrixWorld(true);
      const lowest=Math.min(toeHeight(toePlus),toeHeight(toeMinus));
      root.position.y+=floor+restToeLift-lowest;
    }else{
      if(previous==='walking'){stopPose=driven.map(name=>joints[name].quaternion.clone());stopElapsed=0;}
      if(phase==='speaking'){
        const destFrame=approachPose(0,{minus:gestures.armMinusZ,plus:gestures.armPlusZ});
        if(stopPose){
          stopElapsed+=dt;
          const blend=smooth(stopElapsed/.24);
          applyAngles(destFrame);
          const dest=driven.map(name=>joints[name].quaternion.clone());
          driven.forEach((name,index)=>joints[name].quaternion.copy(stopPose[index]).slerp(dest[index],blend));
          if(blend>=1)stopPose=null;
          standing.updateMatrixWorld(true);
          root.position.y+=floor+restToeLift-Math.min(toeHeight(toePlus),toeHeight(toeMinus));
        }else applyAngles(destFrame);
        pose('head',talking?Math.sin(talkTime*2.1)*.035:0);
      }
      if(phase==='rising'){
        pose('torso',crouch*.48);
        pose('hipPlusZ',crouch*1.05);
        pose('hipMinusZ',crouch*1.05);
        pose('kneePlusZ',-crouch*1.3);
        pose('kneeMinusZ',-crouch*1.3);
        pose('armMinusZ',crouch*.28,axisX);
        pose('armPlusZ',crouch*.28,axisZ);
        root.position.y-=crouch*.43;
      }
    }
    mouth.visible=talking&&phase==='speaking';
    mouth.scale.y=mouthHeight*(1.15+.85*Math.sin(talkTime*11));
    if(phase==='walking'||phase==='speaking')walkTargetYaw=guideFacingYaw(result.x,result.z,camera.position.x,camera.position.z);
    root.rotation.y=walkTargetYaw;
    previous=phase;
    return result;
  }
  return {root,seated,update,setTalking(value){talking=Boolean(value);if(talking)talkTime=0;else mouth.visible=false;}};
}
