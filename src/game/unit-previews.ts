import{addBallExperience,createBall}from'./ball-progression';
import type{BallUnit,RunState}from'./model';

export type RoundUnitPreview={unit:BallUnit;inFlight:boolean};

export function roundUnitPreviews(state:RunState):RoundUnitPreview[]{
  const previews:RoundUnitPreview[]=state.balls.map(unit=>({unit,inFlight:false}));
  for(const projectile of Object.values(state.activeProjectiles)){
    if(projectile.kind!=='unit'||!projectile.unitId||!projectile.ballClass)continue;
    const result=state.launchResults[projectile.unitId],base=createBall(projectile.unitId,projectile.ballClass,{row:0,col:0},projectile.sourceCardId);
    previews.push({unit:addBallExperience(base,result?.xp??0),inFlight:true});
  }
  return previews;
}
