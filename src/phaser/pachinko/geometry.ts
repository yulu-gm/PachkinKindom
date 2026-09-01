export const TRACK={
  leftWallX:25,
  outerWallX:647,
  innerRailX:596,
  topY:76,
  topBoundaryRight:596,
  innerRailTop:180,
  innerRailBottom:555,
  launchFloorY:568,
  spawn:{x:622,y:532,radius:10},
  guide:{x:620,y:118,width:76,height:12,angle:0.62,left:582},
}as const;

export const PEG_ROWS=[
  {y:190,count:5},
  {y:232,count:6},
  {y:273,count:7},
  {y:313,count:8},
  {y:352,count:9},
  {y:390,count:10},
  {y:429,count:11},
  {y:467,count:12},
]as const;

const PEG_LEFT=44;
const PEG_RIGHT=556;

export const PEG_LAYOUT=PEG_ROWS.map((row,index)=>{
  const stagger=index===PEG_ROWS.length-1?0:index%2?0.5:0;
  const spacing=(PEG_RIGHT-PEG_LEFT)/(row.count-1+stagger);
  return Array.from({length:row.count},(_,column)=>({
    x:PEG_LEFT+(column+stagger)*spacing,
    y:row.y,
  }));
});

export const RELAUNCH_ZONE={
  minX:TRACK.innerRailX+TRACK.spawn.radius,
  maxX:TRACK.outerWallX-TRACK.spawn.radius,
  minY:500,
  maxY:TRACK.launchFloorY-TRACK.spawn.radius,
  minElapsedMs:450,
}as const;

export function isRelaunchReady(x:number,y:number,velocityY:number,elapsedMs:number){
  return elapsedMs>=RELAUNCH_ZONE.minElapsedMs
    &&x>=RELAUNCH_ZONE.minX
    &&x<=RELAUNCH_ZONE.maxX
    &&y>=RELAUNCH_ZONE.minY
    &&y<=RELAUNCH_ZONE.maxY
    &&velocityY>=-1.5;
}
