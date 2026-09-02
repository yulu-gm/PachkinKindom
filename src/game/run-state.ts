import{createBall}from'./ball-progression';
import{GRID_SLOTS}from'./peg-grid';
import{createShop}from'./shop';
import type{Phase,RunState}from'./model';

const LEGAL:Record<Phase,Phase[]>={
  SHOP:['LAUNCHING','RUN_END'],
  LAUNCHING:['TRANSFERRING'],
  TRANSFERRING:['LAUNCHING','BATTLE'],
  BATTLE:['SHOP','RUN_END'],
  RUN_END:['SHOP'],
};

export const createRun=(seed:number):RunState=>({
  seed,phase:'SHOP',gold:0,stage:1,nextId:2,
  balls:[createBall('b1','warrior',{row:1,col:1})],
  pegGrid:GRID_SLOTS.map(slot=>({...slot})),
  shop:createShop(seed,1),
  population:{level:1,xp:0},
  launchResults:{},launchQueue:[],transferredBallIds:[],
});

export const transition=(state:RunState,next:Phase):RunState=>{
  if(!LEGAL[state.phase].includes(next))throw new Error(`Illegal phase transition ${state.phase} -> ${next}`);
  return{...state,phase:next};
};
