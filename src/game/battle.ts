import type{BallForm,BallUnit,LaunchResult,Star}from'./model';

export type FormStats={maxHp:number;attack:number;attackEveryMs:number;range:number};
export const FORM_STATS:Record<BallForm,FormStats>={
  warrior:{maxHp:120,attack:12,attackEveryMs:900,range:1},
  knight:{maxHp:180,attack:18,attackEveryMs:850,range:1},
  general:{maxHp:260,attack:28,attackEveryMs:800,range:1},
  mage:{maxHp:70,attack:16,attackEveryMs:1100,range:3},
  elementalist:{maxHp:95,attack:25,attackEveryMs:1050,range:3},
  archmage:{maxHp:125,attack:38,attackEveryMs:1000,range:4},
  archer:{maxHp:80,attack:11,attackEveryMs:750,range:3},
  ranger:{maxHp:105,attack:17,attackEveryMs:650,range:4},
  sharpshooter:{maxHp:135,attack:26,attackEveryMs:550,range:5},
};
export const STAR_MULTIPLIER:Record<Star,number>={1:1,2:1.65,3:2.6};
export type Team='player'|'enemy';
export type Fighter={
  id:string;form:BallForm;star:Star;team:Team;row:number;col:number;
  maxHp:number;hp:number;attack:number;attackEveryMs:number;range:number;moveEveryMs:number;
  shield:number;nextMoveAt:number;nextAttackAt:number;
};
export type BattleEvent={type:'move'|'attack'|'hit'|'shield-hit'|'death';id:string;target?:string;row?:number;col?:number;amount?:number};
export type BattleState={fighters:Fighter[];elapsedMs:number;winner?:Team;events:BattleEvent[]};
export type EnemySeed={id:string;form:BallForm;star:Star;row:number;col:number};

const stats=(form:BallForm,star:Star,scale=1)=>{
  const base=FORM_STATS[form],multiplier=STAR_MULTIPLIER[star]*scale;
  return{
    maxHp:Math.round(base.maxHp*multiplier),
    attack:Math.round(base.attack*multiplier),
    attackEveryMs:base.attackEveryMs,
    range:base.range,
  };
};

export function createPlayerFighter(ball:BallUnit,launch:LaunchResult):Fighter{
  const base=stats(ball.form,ball.star);
  return{
    id:ball.id,form:ball.form,star:ball.star,team:'player',row:ball.cell.row,col:ball.cell.col,
    ...base,hp:base.maxHp,
    attack:Math.round(base.attack*(1+launch.attackBonus)),
    attackEveryMs:Math.round(base.attackEveryMs/(1+launch.hasteBonus)),
    shield:Math.round(base.maxHp*launch.shieldRatio),
    moveEveryMs:550,nextMoveAt:0,nextAttackAt:0,
  };
}

const createEnemyFighter=(enemy:EnemySeed,scale:number):Fighter=>{
  const base=stats(enemy.form,enemy.star,scale);
  return{
    ...enemy,team:'enemy',...base,hp:base.maxHp,shield:0,
    moveEveryMs:550,nextMoveAt:0,nextAttackAt:0,
  };
};

export function createBattle(players:BallUnit[],launches:Record<string,LaunchResult>,enemies:EnemySeed[],enemyScale=1):BattleState{
  return{
    elapsedMs:0,events:[],
    fighters:[
      ...players.map(ball=>createPlayerFighter(ball,launches[ball.id]??{ballId:ball.id,xp:0,attackBonus:0,hasteBonus:0,shieldRatio:0,echoPending:false})),
      ...enemies.map(enemy=>createEnemyFighter(enemy,enemyScale)),
    ],
  };
}

const distance=(a:Fighter,b:Fighter)=>Math.abs(a.row-b.row)+Math.abs(a.col-b.col);
const targetFor=(unit:Fighter,all:Fighter[])=>all
  .filter(other=>other.team!==unit.team&&other.hp>0)
  .sort((a,b)=>distance(unit,a)-distance(unit,b)||a.hp-b.hp||a.id.localeCompare(b.id))[0];

export function stepBattle(state:BattleState,delta=50):BattleState{
  if(state.winner)return state;
  const next:BattleState={...state,elapsedMs:state.elapsedMs+delta,events:[],fighters:state.fighters.map(fighter=>({...fighter}))};
  for(const unit of [...next.fighters].sort((a,b)=>a.id.localeCompare(b.id))){
    if(unit.hp<=0)continue;
    const target=targetFor(unit,next.fighters);
    if(!target)break;
    const gap=distance(unit,target);
    if(gap<=unit.range&&next.elapsedMs>=unit.nextAttackAt){
      const frenzy=next.elapsedMs>30000?1.03**Math.floor((next.elapsedMs-30000)/1000):1;
      let damage=Math.max(1,Math.round(unit.attack*frenzy));
      unit.nextAttackAt=next.elapsedMs+unit.attackEveryMs;
      next.events.push({type:'attack',id:unit.id,target:target.id});
      if(target.shield>0){
        const absorbed=Math.min(target.shield,damage);
        target.shield-=absorbed;damage-=absorbed;
        next.events.push({type:'shield-hit',id:target.id,target:unit.id,amount:absorbed});
      }
      if(damage>0){
        target.hp-=damage;
        next.events.push({type:'hit',id:unit.id,target:target.id,amount:damage});
      }
      if(target.hp<=0)next.events.push({type:'death',id:target.id});
    }else if(gap>unit.range&&next.elapsedMs>=unit.nextMoveAt){
      const dr=Math.sign(target.row-unit.row),dc=Math.sign(target.col-unit.col);
      const options:[number,number][]=Math.abs(target.col-unit.col)>=Math.abs(target.row-unit.row)
        ?[[unit.row,unit.col+dc],[unit.row+dr,unit.col]]
        :[[unit.row+dr,unit.col],[unit.row,unit.col+dc]];
      const cell=options.find(([row,col])=>row>=0&&row<4&&col>=0&&col<6&&!next.fighters.some(fighter=>fighter.hp>0&&fighter.id!==unit.id&&fighter.row===row&&fighter.col===col));
      if(cell){unit.row=cell[0];unit.col=cell[1];next.events.push({type:'move',id:unit.id,row:unit.row,col:unit.col})}
      unit.nextMoveAt=next.elapsedMs+unit.moveEveryMs;
    }
  }
  const playerAlive=next.fighters.some(fighter=>fighter.team==='player'&&fighter.hp>0);
  const enemyAlive=next.fighters.some(fighter=>fighter.team==='enemy'&&fighter.hp>0);
  if(!playerAlive||!enemyAlive)next.winner=playerAlive&&!enemyAlive?'player':'enemy';
  return next;
}

export const runBattleToEnd=(state:BattleState)=>{
  let next=state;
  for(let step=0;step<2400&&!next.winner;step++)next=stepBattle(next,50);
  return next;
};
