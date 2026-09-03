import type{LaunchResult,PegQuality,PegSlot,PegType}from'./model';
import{QUALITY_XP}from'./shop';

export const GRID_COLUMNS=8;
export const GRID_ROWS=5;
export const GRID_SLOTS:PegSlot[]=Array.from({length:GRID_COLUMNS*GRID_ROWS},(_,id)=>({
  id,
  x:52+(id%GRID_COLUMNS)*81,
  y:250+Math.floor(id/GRID_COLUMNS)*55,
  type:'normal',
  quality:'common',
  bonusXp:0,
  bonusMultiplier:1,
}));

export const createLaunchResult=(ballId:string):LaunchResult=>({
  ballId,xp:0,xpMultiplier:1,attackBonus:0,hasteBonus:0,shieldRatio:0,echoRepeats:0,
});

export const POWER_EFFECT:Record<PegQuality,number>={common:.1,rare:.15,epic:.22,legendary:.32};
export const HASTE_EFFECT:Record<PegQuality,number>={common:.08,rare:.12,epic:.18,legendary:.26};
export const GUARD_EFFECT:Record<PegQuality,number>={common:.12,rare:.18,epic:.27,legendary:.4};
export const SPRING_EFFECT:Record<PegQuality,number>={common:1,rare:1.25,epic:1.6,legendary:2.1};
export const ECHO_EFFECT:Record<PegQuality,number>={common:2,rare:2,epic:3,legendary:4};
export type PegHitOutcome={result:LaunchResult;xpGained:number;effectTriggered:boolean;springPower:number;teleport:boolean;teleportPower:number;cooldownMs:number};

export function applyPegHit(result:LaunchResult,peg:Pick<PegSlot,'type'|'quality'>&Partial<Pick<PegSlot,'bonusXp'|'bonusMultiplier'>>,effectReady=true):PegHitOutcome{
  const{type,quality}=peg,triggerable=type!=='normal'&&type!=='experience'&&type!=='echo',effectTriggered=triggerable&&effectReady,times=effectTriggered?(result.echoRepeats||1):0;
  const xpGained=Math.max(1,Math.ceil((QUALITY_XP[quality]+(peg.bonusXp??0))*(peg.bonusMultiplier??1)*result.xpMultiplier));
  const next:LaunchResult={
    ...result,
    xp:result.xp+xpGained,
    echoRepeats:type==='echo'?ECHO_EFFECT[quality]:effectTriggered?0:result.echoRepeats,
  };
  if(type==='power'&&effectTriggered)next.attackBonus=Math.min(1,next.attackBonus+POWER_EFFECT[quality]*times);
  if(type==='haste'&&effectTriggered)next.hasteBonus=Math.min(.8,next.hasteBonus+HASTE_EFFECT[quality]*times);
  if(type==='guard'&&effectTriggered)next.shieldRatio+=GUARD_EFFECT[quality]*times;
  if(type==='multiplier'&&effectTriggered)next.xpMultiplier*=(quality==='legendary'?2:1.5)**times;
  return{
    result:next,xpGained,effectTriggered,
    springPower:type==='spring'&&effectTriggered?SPRING_EFFECT[quality]*times:0,
    teleport:type==='teleport'&&effectTriggered,teleportPower:type==='teleport'&&effectTriggered?times:0,
    cooldownMs:type==='multiplier'&&effectTriggered?(quality==='legendary'?800:1000):0,
  };
}
