export const MACHINE={
  leftWallX:25,rightWallX:647,topY:76,bottomY:548,
  // 出口覆盖接近整个底边，避免小球从两侧漏过传感器。
  exit:{x:336,y:548,width:600,height:30},
  projectileRadius:12,
}as const;

export const LAUNCH_ZONE={
  minX:MACHINE.leftWallX+MACHINE.projectileRadius+10,
  maxX:MACHINE.rightWallX-MACHINE.projectileRadius-10,
  minY:MACHINE.topY+MACHINE.projectileRadius+10,
  maxY:205,
}as const;

export const AIM_SPEED={min:4,max:18,pixelsForMax:180}as const;
export const TELEPORT_ZONE={minX:60,maxX:612,minY:125,maxY:205}as const;
const teleportRoll=(seed:number,salt:number)=>{let value=(seed^Math.imul(salt+1,0x9e3779b9))>>>0;value=Math.imul(value^(value>>>16),0x7feb352d);return((value^(value>>>15))>>>0)/4294967296};
export const teleportPoint=(seed:number)=>({x:TELEPORT_ZONE.minX+teleportRoll(seed,0)*(TELEPORT_ZONE.maxX-TELEPORT_ZONE.minX),y:TELEPORT_ZONE.minY+teleportRoll(seed,1)*(TELEPORT_ZONE.maxY-TELEPORT_ZONE.minY)});

export const isLaunchPoint=(x:number,y:number)=>x>=LAUNCH_ZONE.minX&&x<=LAUNCH_ZONE.maxX&&y>=LAUNCH_ZONE.minY&&y<=LAUNCH_ZONE.maxY;
export const clampLaunchPoint=(x:number,y:number)=>({x:Math.max(LAUNCH_ZONE.minX,Math.min(LAUNCH_ZONE.maxX,x)),y:Math.max(LAUNCH_ZONE.minY,Math.min(LAUNCH_ZONE.maxY,y))});
export function aimVelocity(start:{x:number;y:number},pointer:{x:number;y:number}){
  const dx=pointer.x-start.x,dy=pointer.y-start.y,length=Math.hypot(dx,dy),ux=length>.001?dx/length:0,uy=length>.001?dy/length:1;
  const speed=Math.max(AIM_SPEED.min,Math.min(AIM_SPEED.max,length/AIM_SPEED.pixelsForMax*AIM_SPEED.max));
  return{x:ux*speed,y:uy*speed,speed};
}
export const rotateVelocity=(velocity:{x:number;y:number},degrees:number)=>{
  const radians=degrees*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
  return{x:velocity.x*cos-velocity.y*sin,y:velocity.x*sin+velocity.y*cos};
};

// Compatibility alias for code that only needs the field bounds.
export const TRACK={leftWallX:MACHINE.leftWallX,outerWallX:MACHINE.rightWallX,topY:MACHINE.topY,exit:MACHINE.exit,spawn:{x:336,y:130,radius:MACHINE.projectileRadius}}as const;
