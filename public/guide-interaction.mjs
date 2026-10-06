// A one-shot, terrain-constrained teaching-guide encounter.
// Coordinates are scene layout positions, never archaeological findspots.
export function createGuideDirector({x=-2.68,z=-4.36,speed=.85,riseSeconds=1.45,triggerDistance=4.2,stopDistance=2.15}={}){
  const guide={phase:'seated',x,z,elapsed:0,spoken:false};
  function update(dt,{cameraX,cameraZ,houseDistance,floorAt,blocked=()=>false}){
    const step=Math.max(0,Math.min(dt,.1));
    const distance=Math.hypot(cameraX-guide.x,cameraZ-guide.z);
    let justSpoke=false;
    if(guide.phase==='seated'&&houseDistance<triggerDistance&&distance<6.5){guide.phase='rising';guide.elapsed=0;}
    if(guide.phase==='rising'){
      guide.elapsed=Math.min(riseSeconds,guide.elapsed+step);
      if(guide.elapsed>=riseSeconds){guide.phase='walking';guide.elapsed=0;}
    }
    if(guide.phase==='walking'){
      if(distance<=stopDistance){guide.phase='speaking';justSpoke=!guide.spoken;guide.spoken=true;}
      else{
        const length=Math.min(speed*step,distance-stopDistance);
        const nx=guide.x+(cameraX-guide.x)/distance*length,nz=guide.z+(cameraZ-guide.z)/distance*length;
        const current=floorAt(guide.x,guide.z),next=floorAt(nx,nz);
        if(current!==null&&next!==null&&Math.abs(next-current)<.24&&!blocked(nx,nz)){guide.x=nx;guide.z=nz;guide.elapsed+=step;}
        else{guide.phase='speaking';justSpoke=!guide.spoken;guide.spoken=true;}
      }
    }
    return {phase:guide.phase,x:guide.x,z:guide.z,riseProgress:Math.min(1,guide.elapsed/riseSeconds),walkTime:guide.elapsed,justSpoke};
  }
  return {update,get phase(){return guide.phase;}};
}
