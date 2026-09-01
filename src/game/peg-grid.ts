import type{LaunchResult,PegSlot,PegType}from'./model';

export const GRID_COLUMNS=8;
export const GRID_ROWS=7;
export const GRID_SLOTS:PegSlot[]=Array.from({length:GRID_COLUMNS*GRID_ROWS},(_,id)=>({
  id,
  x:60+(id%GRID_COLUMNS)*68,
  y:140+Math.floor(id/GRID_COLUMNS)*55,
  type:'normal',
}));

export const createLaunchResult=(ballId:string):LaunchResult=>({
  ballId,xp:0,attackBonus:0,hasteBonus:0,shieldRatio:0,echoPending:false,
});

export function applyPegHit(result:LaunchResult,type:PegType):LaunchResult{
  const special=type!=='normal'&&type!=='echo';
  const times=result.echoPending&&special?2:1;
  const next:LaunchResult={
    ...result,
    xp:result.xp+10,
    echoPending:type==='echo'?true:special?false:result.echoPending,
  };
  if(type==='power')next.attackBonus=Math.min(1,next.attackBonus+.1*times);
  if(type==='haste')next.hasteBonus=Math.min(.8,next.hasteBonus+.08*times);
  if(type==='guard')next.shieldRatio+=.12*times;
  return next;
}
