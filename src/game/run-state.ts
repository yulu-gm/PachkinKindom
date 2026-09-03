import{roundStateFor}from'./cards';
import{GRID_SLOTS}from'./peg-grid';
import{createShop}from'./shop';
import type{CardInstance,Phase,RunState}from'./model';

const LEGAL:Record<Phase,Phase[]>={SHOP:['BATTLE','RUN_END'],LAUNCHING:['SHOP'],TRANSFERRING:['SHOP'],BATTLE:['SHOP','RUN_END'],RUN_END:['SHOP']};
const starter=(id:string):CardInstance=>({id,kind:'unit',ballClass:'warrior'});
export const freshPegGrid=()=>GRID_SLOTS.map(slot=>({...slot,type:'normal' as const,quality:'common' as const,installedCardId:undefined,bonusXp:0,bonusMultiplier:1}));
// 跨关保留已装配钉子，但爆弹带来的强化只在当前关生效。
export const nextStagePegGrid=(grid:RunState['pegGrid'])=>grid.map(slot=>({...slot,bonusXp:0,bonusMultiplier:1}));
export const createRun=(seed:number):RunState=>{
  const cards=[starter('c1')];
  return{seed,phase:'SHOP',gold:0,stage:1,nextId:2,cards,cardRound:roundStateFor(cards),roundUsedCards:{},activeProjectiles:{},
    balls:[],pegGrid:freshPegGrid(),shop:createShop(seed,1),population:{level:1,xp:0},launchResults:{},launchQueue:[],transferredBallIds:[]};
};
export const transition=(state:RunState,next:Phase):RunState=>{if(!LEGAL[state.phase].includes(next))throw new Error(`Illegal phase transition ${state.phase} -> ${next}`);return{...state,phase:next}};
