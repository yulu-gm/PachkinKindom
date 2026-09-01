import type{Phase,RunState}from'./model';const LEGAL:Record<Phase,Phase[]>={PREP:['LAUNCHING','BATTLE'],LAUNCHING:['REVEAL'],REVEAL:['PREP'],BATTLE:['VICTORY','RUN_END'],VICTORY:['PREP','RUN_END'],RUN_END:['PREP']};
export const createRun=(seed:number):RunState=>({seed,phase:'PREP',gold:50,stage:1,nextId:1,units:[],settledBallIds:[],ballsFired:0,highestRarity:'white'});
export const transition=(state:RunState,next:Phase):RunState=>{if(!LEGAL[state.phase].includes(next))throw new Error(`Illegal phase transition ${state.phase} -> ${next}`);return{...state,phase:next}};
