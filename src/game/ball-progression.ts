import type{BallClass,BallForm,BallUnit,Cell,Star}from'./model';

export const XP_COSTS=[20,40,60,80,100,120,140,160]as const;
export const FORM_CHAINS:Record<BallClass,readonly BallForm[]>={
  warrior:['warrior','knight','general'],
  mage:['mage','elementalist','archmage'],
  archer:['archer','ranger','sharpshooter'],
};

export const createBall=(id:string,ballClass:BallClass,cell:Cell):BallUnit=>({
  id,class:ballClass,form:FORM_CHAINS[ballClass][0]!,star:1,xp:0,cell,
});

export const resetBallProgression=(ball:BallUnit):BallUnit=>({...ball,form:FORM_CHAINS[ball.class][0]!,star:1,xp:0});

export const progressionNode=(ball:BallUnit)=>FORM_CHAINS[ball.class].indexOf(ball.form)*3+(ball.star-1);

export const nextExperienceCost=(ball:BallUnit)=>XP_COSTS[progressionNode(ball)];

export function addBallExperience(ball:BallUnit,amount:number):BallUnit{
  let node=progressionNode(ball);
  let xp=ball.xp+Math.max(0,Math.floor(amount));
  while(node<XP_COSTS.length&&xp>=XP_COSTS[node]!){xp-=XP_COSTS[node]!;node++}
  if(node>=XP_COSTS.length)return{...ball,form:FORM_CHAINS[ball.class][2]!,star:3,xp:0};
  return{
    ...ball,
    form:FORM_CHAINS[ball.class][Math.floor(node/3)]!,
    star:(node%3+1)as Star,
    xp,
  };
}
