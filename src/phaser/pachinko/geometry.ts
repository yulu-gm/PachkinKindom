export const TRACK={
  leftWallX:25,outerWallX:647,innerRailX:596,topY:76,topBoundaryRight:596,
  innerRailTop:180,innerRailBottom:555,launchFloorY:568,
  spawn:{x:622,y:532,radius:12},
  guide:{x:620,y:118,width:76,height:12,angle:.62,left:582},
  exit:{x:300,y:548,width:540,height:22},
}as const;

export const RELAUNCH_ZONE={
  minX:TRACK.innerRailX+TRACK.spawn.radius,maxX:TRACK.outerWallX-TRACK.spawn.radius,
  minY:495,maxY:TRACK.launchFloorY-TRACK.spawn.radius,minElapsedMs:450,
}as const;

export const TELEPORT_ZONE={minX:60,maxX:550,minY:130,maxY:200}as const;
const teleportRoll=(seed:number,salt:number)=>{let value=(seed^Math.imul(salt+1,0x9e3779b9))>>>0;value=Math.imul(value^(value>>>16),0x7feb352d);return((value^(value>>>15))>>>0)/4294967296};
export const teleportPoint=(seed:number)=>({
  x:TELEPORT_ZONE.minX+teleportRoll(seed,0)*(TELEPORT_ZONE.maxX-TELEPORT_ZONE.minX),
  y:TELEPORT_ZONE.minY+teleportRoll(seed,1)*(TELEPORT_ZONE.maxY-TELEPORT_ZONE.minY),
});

export function isRelaunchReady(x:number,y:number,velocityY:number,elapsedMs:number){
  return elapsedMs>=RELAUNCH_ZONE.minElapsedMs&&x>=RELAUNCH_ZONE.minX&&x<=RELAUNCH_ZONE.maxX
    &&y>=RELAUNCH_ZONE.minY&&y<=RELAUNCH_ZONE.maxY&&velocityY>=-1.5;
}
