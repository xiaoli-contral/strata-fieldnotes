// Three.js cameras look along local -Z. W/S follow that horizontal heading;
// A/D follow local -X/+X at every yaw, including after a full turn.
export function movementVector(yaw,forward,side){
  const x=-Math.sin(yaw)*forward+Math.cos(yaw)*side;
  const z=-Math.cos(yaw)*forward-Math.sin(yaw)*side;
  const length=Math.hypot(x,z);
  return length?{x:x/length,z:z/length}:{x:0,z:0};
}

// The actual textured Tripo GLB faces local +X (verified from its mesh/UVs).
// Rotation around Y maps +X to (cos(yaw), 0, -sin(yaw)).
export function guideFacingYaw(guideX,guideZ,viewerX,viewerZ){
  return Math.atan2(guideZ-viewerZ,viewerX-guideX);
}
