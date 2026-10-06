import learned from '../outputs/motion/approach-study/learned.json' with { type: 'json' };

// Angles for the existing Tripo rig. Names are spatial (+Z / -Z), not anatomical.
// The reference clip faces the camera with the arms hanging. A frontal view does
// not contain a reliable stride, so the legs are a small opposite-phase step.
export function approachPose(time,armOffset={minus:0,plus:0}){
  if(!Number.isFinite(time))throw new Error('走近采样时间无效');
  const swing=Math.sin(time*learned.cycleRadiansPerSecond);
  const drop=learned.armDropRadians;
  const elbow=learned.elbowBendRadians;
  return {
    hipPlusZ:swing*learned.hipRadians,
    hipMinusZ:-swing*learned.hipRadians,
    kneePlusZ:-Math.max(0,-swing)*learned.kneeRadians,
    kneeMinusZ:-Math.max(0,swing)*learned.kneeRadians,
    armDropMinusZ:drop,
    armDropPlusZ:drop,
    armSwingMinusZ:swing*learned.armSwingRadians+armOffset.minus,
    armSwingPlusZ:-swing*learned.armSwingRadians+armOffset.plus,
    elbowMinusZ:elbow,
    elbowPlusZ:-elbow
  };
}

export function speakingGestures(time){
  return {armMinusZ:-.10-.065*Math.sin(time*2.15),armPlusZ:-.09-.055*Math.sin(time*1.75+1.2)};
}
