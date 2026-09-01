import Phaser from'phaser';
import{addBallExperience,nextExperienceCost,progressionNode}from'../../game/ball-progression';
import type{BattleEvent,BattleState}from'../../game/battle';
import type{BallClass,BallForm,BallUnit,PegType,RunState}from'../../game/model';
import type{GameController}from'../../game/controller';
import{isRelaunchReady,TRACK}from'../pachinko/geometry';

type ActiveBall={id:string;img:Phaser.Physics.Matter.Image;lastLaunch:number;retryReady:boolean;retryRing?:Phaser.GameObjects.Arc;forced:boolean;stalledSince?:number;rescueCount:number;previewNode:number};
type UnitView={root:Phaser.GameObjects.Container;sprite:Phaser.GameObjects.Sprite;bar:Phaser.GameObjects.Rectangle;shield:Phaser.GameObjects.Arc;role:'soldier'|'slime'};
const CLASS_COLOR:Record<BallClass,number>={warrior:0xd45846,mage:0x726de8,archer:0x55a863};
const PEG_COLOR:Record<PegType,number>={normal:0xdab15f,power:0xff5b57,haste:0x5bc8ff,guard:0x77d7b0,echo:0xc57bff,spring:0xffe35b,amplifier:0xa9df55};
const PEG_SYMBOL:Record<PegType,string>={normal:'',power:'攻',haste:'速',guard:'盾',echo:'双',spring:'弹',amplifier:'倍'};
const FORM_NAME:Record<BallForm,string>={warrior:'战士',knight:'骑士',general:'将军',commander:'统帅',lord:'领主',mage:'术士',wizard:'法师',elementalist:'元素师',magus:'魔导师',archmage:'大魔法师',archer:'弓手',crossbowman:'弩手',ranger:'游侠',sharpshooter:'神射手',hawkeye:'鹰眼射手'};
const FORM_CLASS:Record<BallForm,BallClass>={warrior:'warrior',knight:'warrior',general:'warrior',commander:'warrior',lord:'warrior',mage:'mage',wizard:'mage',elementalist:'mage',magus:'mage',archmage:'mage',archer:'archer',crossbowman:'archer',ranger:'archer',sharpshooter:'archer',hawkeye:'archer'};
const LAUNCH_SPEED={minX:-.45,maxX:.45,minY:-22.4,maxY:-20.8}as const;
const BOARD_X=708,BOARD_Y=88,CELL_W=90,CELL_H=88;
const boardPoint=(row:number,col:number)=>({x:BOARD_X+43+col*CELL_W,y:BOARD_Y+41+row*CELL_H});

export class GameScene extends Phaser.Scene{
  private c!:GameController;
  private activeBalls=new Map<string,ActiveBall>();
  private pegViews=new Map<number,{ring:Phaser.GameObjects.Arc;text:Phaser.GameObjects.Text}>();
  private prepViews:Phaser.GameObjects.GameObject[]=[];
  private battleViews=new Map<string,UnitView>();
  private deployedViews=new Map<string,Phaser.GameObjects.Container>();
  private reduced=false;
  private acc=0;
  private unsub?:()=>void;
  private dragPegSlot?:number;
  private dragMarker?:Phaser.GameObjects.Arc;
  private canvas?:HTMLCanvasElement;

  constructor(){super('game')}
  create():void{
    this.c=this.registry.get('controller')as GameController;
    this.input.mouse?.disableContextMenu();
    this.drawShell();this.buildMachine();this.drawBoard();
    this.matter.world.on('collisionstart',(event:any)=>this.collide(event));
    const start=()=>this.startExpedition();
    const motion=(event:Event)=>this.reduced=(event as CustomEvent<boolean>).detail;
    const dragStart=(event:Event)=>this.dragPegSlot=(event as CustomEvent<number>).detail;
    const dragEnd=()=>this.clearPegDrag();
    window.addEventListener('pk-start',start);window.addEventListener('pk-motion',motion);
    window.addEventListener('pk-peg-drag-start',dragStart);window.addEventListener('pk-peg-drag-end',dragEnd);
    this.canvas=this.game.canvas;
    this.canvas.addEventListener('dragover',event=>this.onCanvasDrag(event));
    this.canvas.addEventListener('drop',event=>this.onCanvasDrop(event));
    this.input.on('drag',(_:Phaser.Input.Pointer,view:Phaser.GameObjects.Container,dragX:number,dragY:number)=>{if(this.c.snapshot().phase==='SHOP'&&view.getData('ballId'))view.setPosition(dragX,dragY)});
    this.input.on('dragend',(_:Phaser.Input.Pointer,view:Phaser.GameObjects.Container)=>this.dropFormation(view));
    this.unsub=this.c.subscribe(state=>this.render(state));
    this.events.once('shutdown',()=>{window.removeEventListener('pk-start',start);window.removeEventListener('pk-motion',motion);window.removeEventListener('pk-peg-drag-start',dragStart);window.removeEventListener('pk-peg-drag-end',dragEnd);this.unsub?.()});
  }

  private drawShell(){
    this.add.rectangle(332,328,650,640,0x182a36).setStrokeStyle(6,0xd2a456);
    this.add.rectangle(972,328,610,640,0x183126).setStrokeStyle(6,0xd2a456);
    this.add.text(332,14,'♛ 王国训练场',{fontFamily:'monospace',fontSize:'22px',color:'#ffe1a0'}).setOrigin(.5,0);
    this.add.text(972,14,'⚔ 王国战棋场',{fontFamily:'monospace',fontSize:'22px',color:'#ffe1a0'}).setOrigin(.5,0);
    this.add.text(332,46,'撞钉积累本轮经验 | 特殊钉赋予本轮战斗效果',{fontFamily:'monospace',fontSize:'13px',color:'#9ec7d3'}).setOrigin(.5,0);
  }

  private buildMachine(){
    const addWall=(x:number,y:number,w:number,h:number,angle=0)=>this.matter.add.rectangle(x,y,w,h,{isStatic:true,label:'wall',angle,friction:.02,restitution:.76});
    addWall(TRACK.leftWallX,320,18,500);addWall(TRACK.outerWallX,330,18,540);
    addWall((TRACK.leftWallX+TRACK.topBoundaryRight)/2,TRACK.topY,TRACK.topBoundaryRight-TRACK.leftWallX,16);
    addWall(TRACK.innerRailX,(TRACK.innerRailTop+TRACK.innerRailBottom)/2,14,TRACK.innerRailBottom-TRACK.innerRailTop);
    addWall((TRACK.innerRailX+TRACK.outerWallX)/2,TRACK.launchFloorY,TRACK.outerWallX-TRACK.innerRailX,14);
    addWall(TRACK.guide.x,TRACK.guide.y,TRACK.guide.width,TRACK.guide.height,TRACK.guide.angle);
    addWall(105,522,170,12,.16);addWall(495,522,170,12,-.16);
    this.add.rectangle(105,522,170,12,0x9b6d31).setRotation(.16).setStrokeStyle(3,0xf2c96f);
    this.add.rectangle(495,522,170,12,0x9b6d31).setRotation(-.16).setStrokeStyle(3,0xf2c96f);
    this.add.rectangle(TRACK.innerRailX,(TRACK.innerRailTop+TRACK.innerRailBottom)/2,14,TRACK.innerRailBottom-TRACK.innerRailTop,0x9b6d31).setStrokeStyle(3,0xf2c96f);
    this.add.rectangle(TRACK.guide.x,TRACK.guide.y,TRACK.guide.width,TRACK.guide.height,0xc99a4c).setRotation(TRACK.guide.angle).setStrokeStyle(3,0xffd77c);
    this.add.rectangle(622,350,38,420,0xd9b46a,.12).setStrokeStyle(2,0x6f4925);
    this.add.text(622,330,'发\n射\n轨\n道',{fontFamily:'monospace',fontSize:'12px',color:'#e8c87d',align:'center'}).setOrigin(.5);
    for(const slot of this.c.snapshot().pegGrid){
      const ring=this.add.circle(slot.x,slot.y,10,PEG_COLOR[slot.type]).setStrokeStyle(3,0x71471f).setDepth(2);
      const text=this.add.text(slot.x,slot.y,PEG_SYMBOL[slot.type],{fontFamily:'monospace',fontSize:'10px',fontStyle:'bold',color:'#ffffff',stroke:'#18222b',strokeThickness:2}).setOrigin(.5).setDepth(3);
      this.matter.add.circle(slot.x,slot.y,9,{isStatic:true,label:`peg:${slot.id}`,restitution:.9});
      this.pegViews.set(slot.id,{ring,text});
    }
    this.matter.add.rectangle(TRACK.exit.x,TRACK.exit.y,TRACK.exit.width,TRACK.exit.height,{isStatic:true,isSensor:true,label:'exit'});
    this.add.rectangle(TRACK.exit.x,TRACK.exit.y,TRACK.exit.width,8,0x79d9ca,.25).setStrokeStyle(2,0x9af6dd);
    this.add.text(300,558,'▼ 战场部署出口 ▼',{fontFamily:'monospace',fontSize:'11px',color:'#9af6dd'}).setOrigin(.5,0);
  }

  private drawBoard(){
    for(let row=0;row<4;row++)for(let col=0;col<6;col++){const point=boardPoint(row,col);this.add.rectangle(point.x,point.y,84,82,(row+col)%2?0x625b43:0x817653).setStrokeStyle(2,col<3?0x6fa3b0:0xad6a6a)}
    this.add.text(837,454,'己方编队区 | 商店阶段可拖动单位球',{fontFamily:'monospace',fontSize:'13px',color:'#b9d9d1'}).setOrigin(.5);
    this.add.text(1108,454,'敌方区域',{fontFamily:'monospace',fontSize:'13px',color:'#d8a9a0'}).setOrigin(.5);
  }

  private startExpedition(){
    try{
      this.c.beginLaunch();
      const queue=this.c.snapshot().launchQueue;
      queue.forEach((id,index)=>this.time.delayedCall(index*200,()=>this.spawnBall(id)));
    }catch(error){this.toast(error instanceof Error?error.message:'无法开始远征')}
  }
  private spawnBall(id:string){
    if(this.activeBalls.has(id)||this.c.snapshot().phase!=='LAUNCHING')return;
    const ball=this.c.snapshot().balls.find(value=>value.id===id);
    if(!ball)return;
    try{
      const img=this.matter.add.image(TRACK.spawn.x,TRACK.spawn.y,`${ball.class}-ball`).setCircle(TRACK.spawn.radius).setBounce(.84).setFriction(.001).setFrictionAir(.002).setDepth(8).setInteractive({useHandCursor:true});
      (img.body as MatterJS.BodyType).label=`ball:${id}`;
      const active:ActiveBall={id,img,lastLaunch:this.time.now,retryReady:false,forced:false,rescueCount:0,previewNode:progressionNode(ball)};
      this.activeBalls.set(id,active);
      img.on('pointerdown',()=>this.relaunch(active));this.fire(active);
    }catch(error){console.error(`[GameScene] 发射单位球 ${id} 失败`,error)}
  }
  private fire(active:ActiveBall){
    this.clearRetry(active);
    active.img.setAngularVelocity(Phaser.Math.FloatBetween(-.08,.08)).setVelocity(
      Phaser.Math.FloatBetween(LAUNCH_SPEED.minX,LAUNCH_SPEED.maxX),
      Phaser.Math.FloatBetween(LAUNCH_SPEED.minY,LAUNCH_SPEED.maxY),
    );
    active.lastLaunch=this.time.now;active.forced=false;
  }
  private relaunch(active:ActiveBall){if(active.retryReady){this.fire(active);this.burst(active.img.x,active.img.y,0xffe06b);this.toast('再次发射！')}}
  private showRetry(active:ActiveBall){
    if(active.retryReady)return;
    active.retryReady=true;
    const ring=this.add.circle(active.img.x,active.img.y,18,0xffd36a,0).setStrokeStyle(3,0xffd36a).setDepth(7);
    active.retryRing=ring;this.tweens.add({targets:ring,alpha:{from:.3,to:1},scale:{from:.9,to:1.25},duration:520,yoyo:true,repeat:-1});
  }
  private clearRetry(active:ActiveBall){
    active.retryReady=false;
    if(active.retryRing){this.tweens.killTweensOf(active.retryRing);active.retryRing.destroy();active.retryRing=undefined}
  }
  private collide(event:any){
    for(const pair of event.pairs as any[]){
      const labels=[pair.bodyA.label as string,pair.bodyB.label as string],ballLabel=labels.find(label=>label.startsWith('ball:'));
      if(!ballLabel)continue;
      const id=ballLabel.slice(5),pegLabel=labels.find(label=>label.startsWith('peg:'));
      if(pegLabel)this.hitPeg(id,Number(pegLabel.slice(4)));
      if(labels.includes('exit'))this.exitBall(id);
    }
  }
  private hitPeg(id:string,slotId:number){
    const active=this.activeBalls.get(id);if(!active)return;
    try{
      const beforeNode=active.previewNode;
      const {result,springPower,xpGained}=this.c.recordPegHit(id,slotId),slot=this.c.snapshot().pegGrid[slotId]!;
      const preview=this.previewBall(id),node=progressionNode(preview);active.previewNode=node;window.dispatchEvent(new CustomEvent('pk-growth-hit',{detail:id}));
      this.burst(slot.x,slot.y,PEG_COLOR[slot.type]);this.floatText(slot.x,slot.y-8,`+${this.compactNumber(xpGained)} EXP${slot.type==='normal'?'':` · ${PEG_SYMBOL[slot.type]}`}`,PEG_COLOR[slot.type]);
      if(slot.type==='amplifier')this.floatText(slot.x,slot.y+12,`EXP ×${this.compactMultiplier(result.xpMultiplier)}`,PEG_COLOR.amplifier);
      if(node>beforeNode)this.boostGrowth(active,beforeNode,node,preview);
      if(springPower)active.img.setVelocity(Phaser.Math.FloatBetween(-3.5,3.5)*springPower,-14-(springPower-1)*6);
      if(result.xp%50===0&&!this.reduced)this.cameras.main.shake(60,.002);
    }catch{}
  }
  private previewBall(id:string,state=this.c.snapshot()){
    const ball=state.balls.find(value=>value.id===id)!,result=state.launchResults[id];
    return result&&!state.transferredBallIds.includes(id)?addBallExperience(ball,result.xp):ball;
  }
  private boostGrowth(active:ActiveBall,beforeNode:number,node:number,preview:BallUnit){
    const gained=node-beforeNode,body=active.img.body as MatterJS.BodyType,evolved=Math.floor(beforeNode/3)!==Math.floor(node/3),color=CLASS_COLOR[preview.class];
    active.img.setBounce(Math.min(1.08,.84+.04*node)).setFrictionAir(Math.max(.0006,.002-.00018*node));
    active.img.setVelocity(body.velocity.x+Phaser.Math.FloatBetween(-1.5,1.5),Math.min(body.velocity.y,-6-1.2*gained-(evolved?3:0)));
    const wave=this.add.circle(active.img.x,active.img.y,17,color,.08).setStrokeStyle(evolved?5:3,color).setDepth(12);
    this.tweens.add({targets:wave,scale:evolved?2.5:1.8,alpha:0,duration:this.reduced?140:280,onComplete:()=>wave.destroy()});
    this.floatText(active.img.x,active.img.y-22,evolved?`${FORM_NAME[preview.form]}进化！`:`升星 ×${gained} · 弹力提升`,color);
    if(evolved)this.banner(`${FORM_NAME[preview.form]}进化！`,color);
  }
  private compactNumber(value:number){if(!Number.isFinite(value))return'∞';return Math.abs(value)<10000?String(Math.floor(value)):value.toExponential(2)}
  private compactMultiplier(value:number){if(!Number.isFinite(value))return'∞';return value<1000?value.toFixed(2):value.toExponential(2)}
  private exitBall(id:string){
    const active=this.activeBalls.get(id);if(!active)return;
    this.activeBalls.delete(id);
    this.clearRetry(active);active.img.destroy();
    try{this.c.finishBallLaunch(id)}catch(error){console.error(`[GameScene] 结算单位球 ${id} 失败`,error)}
    const after=this.c.snapshot().balls.find(ball=>ball.id===id)!;
    const target=boardPoint(after.cell.row,after.cell.col);
    const waiting=this.makeUnit(target.x,target.y,after.form,after.star,false,after);
    waiting.root.setScale(.75).setAlpha(0);this.deployedViews.set(id,waiting.root);
    this.spawnBurst(target.x,target.y,after.class);
    this.tweens.add({targets:waiting.root,scale:1,alpha:1,duration:180,ease:'Back.Out',onComplete:()=>{try{this.c.completeBallTransfer(id)}catch(error){console.error(`[GameScene] 转移单位球 ${id} 失败`,error)}}});
  }

  private render(state:RunState){
    for(const slot of state.pegGrid){const view=this.pegViews.get(slot.id);if(view){view.ring.setFillStyle(PEG_COLOR[slot.type]);view.text.setText(PEG_SYMBOL[slot.type])}}
    if(state.phase==='SHOP')this.renderPrep(state);
    else if(this.prepViews.length)this.clearPrep();
    if(state.phase==='BATTLE')this.renderBattle();
  }
  private clearPrep(){for(const view of this.prepViews)view.destroy();this.prepViews=[]}
  private renderPrep(state:RunState){
    this.clearPrep();this.clearBattle();this.clearDeployedViews();
    for(const enemy of this.c.encounter().enemies){const point=boardPoint(enemy.row,enemy.col),view=this.makeUnit(point.x,point.y,enemy.form,enemy.star,true);view.root.setAlpha(.72);this.prepViews.push(view.root)}
    for(const ball of state.balls){
      const point=boardPoint(ball.cell.row,ball.cell.col),view=this.makeUnit(point.x,point.y,ball.form,ball.star,false,ball);
      view.root.setData('ballId',ball.id).setInteractive(new Phaser.Geom.Rectangle(-40,-48,80,96),Phaser.Geom.Rectangle.Contains);
      if(view.root.input)view.root.input.cursor='pointer';
      this.input.setDraggable(view.root);this.prepViews.push(view.root);
    }
  }

  private makeUnit(x:number,y:number,form:BallForm,star:number,enemy=false,ball?:BallUnit):UnitView{
    const role=enemy?'slime':'soldier';
    const className=ball?.class??FORM_CLASS[form];
    const color=CLASS_COLOR[className];
    const ring=this.add.ellipse(0,28,52,16,color,.25).setStrokeStyle(3,color),sprite=this.add.sprite(0,-5,`${role}-idle`).setScale(enemy?4:3);
    const label=this.add.text(0,26,FORM_NAME[form],{fontFamily:'monospace',fontSize:'11px',fontStyle:'bold',color:'#fff',stroke:'#151018',strokeThickness:3}).setOrigin(.5);
    const stars=this.add.text(0,39,'★'.repeat(star),{fontFamily:'monospace',fontSize:'9px',color:'#ffd765',stroke:'#151018',strokeThickness:2}).setOrigin(.5);
    const barBg=this.add.rectangle(0,-40,52,6,0x1b1316),bar=this.add.rectangle(0,-40,52,6,0x62d678);
    const shield=this.add.circle(0,-4,31,0x70d9ff,.1).setStrokeStyle(3,0x70d9ff).setVisible(false);
    const children:Phaser.GameObjects.GameObject[]=[ring,shield,barBg,bar,sprite,label,stars];
    if(ball){const cost=nextExperienceCost(ball),xp=this.add.text(0,50,cost?`EXP ${ball.xp}/${cost}`:'MAX',{fontFamily:'monospace',fontSize:'8px',color:'#bcefe6',stroke:'#151018',strokeThickness:2}).setOrigin(.5);children.push(xp)}
    const root=this.add.container(x,y,children).setDepth(10);
    if(enemy)sprite.setFlipX(true);
    sprite.play(`${role}-idle`,true);
    sprite.on('animationcomplete',(anim:Phaser.Animations.Animation)=>{if(anim.key===`${role}-attack`||anim.key===`${role}-hurt`)sprite.play(`${role}-idle`,true)});
    return{root,sprite,bar,shield,role};
  }
  private dropFormation(view:Phaser.GameObjects.Container){
    const id=view.getData('ballId')as string|undefined;if(!id)return;
    const col=Phaser.Math.Clamp(Math.round((view.x-(BOARD_X+43))/CELL_W),0,2),row=Phaser.Math.Clamp(Math.round((view.y-(BOARD_Y+41))/CELL_H),0,3);
    try{this.c.moveBall(id,{row:row as 0|1|2|3,col:col as 0|1|2})}catch(error){this.toast(error instanceof Error?error.message:'无法布阵');this.renderPrep(this.c.snapshot())}
  }
  private onCanvasDrag(event:DragEvent){
    if(this.dragPegSlot===undefined)return;event.preventDefault();
    const point=this.canvasPoint(event.clientX,event.clientY),nearest=this.nearestPeg(point.x,point.y);
    if(!nearest||nearest.distance>34){this.dragMarker?.setVisible(false);return}
    if(!this.dragMarker)this.dragMarker=this.add.circle(nearest.x,nearest.y,17,0xffffff,.12).setStrokeStyle(3,0xffffff).setDepth(30);
    this.dragMarker.setPosition(nearest.x,nearest.y).setVisible(true);
  }
  private onCanvasDrop(event:DragEvent){
    if(this.dragPegSlot===undefined)return;event.preventDefault();
    const point=this.canvasPoint(event.clientX,event.clientY),nearest=this.nearestPeg(point.x,point.y),shopSlot=this.dragPegSlot;
    try{if(!nearest||nearest.distance>34)throw new Error('请放到发光钉位上');this.c.placePeg(shopSlot,nearest.id);this.burst(nearest.x,nearest.y,0xffffff);this.toast('特殊钉已装配')}catch(error){this.toast(error instanceof Error?error.message:'无法放置')}
    this.clearPegDrag();
  }
  private canvasPoint(clientX:number,clientY:number){const rect=this.canvas!.getBoundingClientRect();return{x:(clientX-rect.left)*1280/rect.width,y:(clientY-rect.top)*656/rect.height}}
  private nearestPeg(x:number,y:number){return this.c.snapshot().pegGrid.map(slot=>({...slot,distance:Phaser.Math.Distance.Between(x,y,slot.x,slot.y)})).sort((a,b)=>a.distance-b.distance)[0]}
  private clearPegDrag(){this.dragPegSlot=undefined;if(this.dragMarker){this.dragMarker.destroy();this.dragMarker=undefined}}

  private clearBattle(){for(const view of this.battleViews.values()){this.tweens.killTweensOf(view.root);view.root.destroy()}this.battleViews.clear()}
  private clearDeployedViews(){for(const view of this.deployedViews.values())view.destroy();this.deployedViews.clear()}
  private renderBattle(){
    const battle=this.c.battleSnapshot();if(!battle)return;
    if(this.prepViews.length)this.clearPrep();
    if(this.deployedViews.size)this.clearDeployedViews();
    for(const fighter of battle.fighters){
      let view=this.battleViews.get(fighter.id);
      if(fighter.hp>0){
        if(!view){const point=boardPoint(fighter.row,fighter.col);view=this.makeUnit(point.x,point.y,fighter.form,fighter.star,fighter.team==='enemy');this.battleViews.set(fighter.id,view)}
        const hp=Math.max(0,fighter.hp/fighter.maxHp);view.bar.setDisplaySize(52*hp,6);view.bar.setX(-26+26*hp);view.shield.setVisible(fighter.shield>0);
      }else if(view){this.battleViews.delete(fighter.id);this.tweens.killTweensOf(view.root);view.sprite.play(`${view.role}-death`);this.tweens.add({targets:view.root,alpha:0,duration:700,onComplete:()=>{if(view?.root.active)view.root.destroy()}})}
    }
  }
  private playBattleEvents(events:BattleEvent[],battle:BattleState){
    for(const event of events){
      if(event.type==='move'){
        const view=this.battleViews.get(event.id);
        if(view&&event.row!==undefined&&event.col!==undefined){const point=boardPoint(event.row,event.col);view.sprite.play(`${view.role}-walk`,true);this.tweens.add({targets:view.root,...point,duration:460,onComplete:()=>{if(view?.root.active&&view.sprite.active)view.sprite.play(`${view.role}-idle`,true)}})}
        continue;
      }
      if(event.type==='attack'&&event.target){
        const attacker=this.battleViews.get(event.id);
        attacker?.sprite.play(`${attacker.role}-attack`,true);
        if(attacker){const pulse=this.add.circle(attacker.root.x,attacker.root.y,22,0xffdf73,.12).setStrokeStyle(3,0xffdf73).setDepth(24);this.tweens.add({targets:pulse,scale:1.45,alpha:0,duration:180,onComplete:()=>pulse.destroy()})}
        continue;
      }
      if(event.type==='shield-hit'){
        const target=this.battleViews.get(event.id);
        if(target){target.shield.setVisible(true).setScale(.7).setAlpha(1);this.tweens.add({targets:target.shield,scale:1.3,alpha:.2,duration:240});this.floatText(target.root.x,target.root.y-40,`护盾 -${event.amount}`,0x70d9ff)}
        continue;
      }
      if(event.type!=='hit'||!event.target)continue;
      const attacker=battle.fighters.find(fighter=>fighter.id===event.id),target=battle.fighters.find(fighter=>fighter.id===event.target);
      const targetView=this.battleViews.get(event.target);
      if(!attacker||!target)continue;
      targetView?.sprite.play(`${targetView.role}-hurt`,true);
      const from=boardPoint(attacker.row,attacker.col),to=boardPoint(target.row,target.col),angle=Math.atan2(to.y-from.y,to.x-from.x);
      const slash=this.add.rectangle(from.x,from.y,34,7,0xffdf73,.95).setRotation(angle).setDepth(25);
      this.tweens.add({targets:slash,x:to.x,y:to.y,scaleX:.3,alpha:0,duration:150,onComplete:()=>slash.destroy()});
      this.burst(to.x,to.y,0xff526b);this.floatText(to.x,to.y-25,`-${event.amount??0}`,0xff8b84);
      if(!this.reduced)this.cameras.main.shake(55,.0025);
    }
  }

  private burst(x:number,y:number,color:number){
    for(let index=0;index<(this.reduced?3:7);index++){
      const spark=this.add.image(x,y,'spark').setTint(color).setScale(.4).setDepth(28);
      this.tweens.add({targets:spark,x:x+Phaser.Math.Between(-22,22),y:y+Phaser.Math.Between(-22,16),alpha:0,scale:0,duration:260,onComplete:()=>spark.destroy()});
    }
  }
  private spawnBurst(x:number,y:number,ballClass:BallClass){
    this.burst(x,y,CLASS_COLOR[ballClass]);
    const flash=this.add.circle(x,y,18,0xffffff,.55).setStrokeStyle(4,CLASS_COLOR[ballClass]).setDepth(24);
    this.tweens.add({targets:flash,scale:2,alpha:0,duration:180,ease:'Cubic.Out',onComplete:()=>flash.destroy()});
    for(let index=0;index<(this.reduced?3:6);index++){
      const puff=this.add.circle(x+Phaser.Math.Between(-8,8),y+Phaser.Math.Between(-6,6),Phaser.Math.Between(5,8),index%2?0xd8e4df:0xffffff,.72).setDepth(23);
      this.tweens.add({targets:puff,x:puff.x+Phaser.Math.Between(-15,15),y:puff.y+Phaser.Math.Between(-15,8),scale:1.55,alpha:0,duration:220,ease:'Cubic.Out',onComplete:()=>puff.destroy()});
    }
  }
  private floatText(x:number,y:number,text:string,color:number){
    const view=this.add.text(x,y,text,{fontFamily:'monospace',fontSize:'13px',fontStyle:'bold',color:`#${color.toString(16).padStart(6,'0')}`,stroke:'#111820',strokeThickness:4}).setOrigin(.5).setDepth(30);
    this.tweens.add({targets:view,y:y-34,alpha:0,duration:620,onComplete:()=>view.destroy()});
  }
  private banner(text:string,color:number){
    const view=this.add.text(640,95,text,{fontFamily:'monospace',fontSize:'26px',fontStyle:'bold',color:`#${color.toString(16).padStart(6,'0')}`,stroke:'#131018',strokeThickness:7}).setOrigin(.5).setDepth(40).setScale(.6);
    this.tweens.add({targets:view,scale:1.1,yoyo:true,hold:500,alpha:{from:1,to:.95},duration:260,onComplete:()=>view.destroy()});
    if(!this.reduced)this.cameras.main.shake(130,.006);
  }
  private toast(text:string){
    const view=this.add.text(640,620,text,{fontFamily:'monospace',fontSize:'16px',backgroundColor:'#211318',padding:{x:12,y:7},color:'#ffd68a'}).setOrigin(.5).setDepth(50);
    this.tweens.add({targets:view,alpha:0,y:590,duration:1400,onComplete:()=>view.destroy()});
  }
  update(_:number,delta:number){
    for(const active of this.activeBalls.values()){
      const body=active.img.body as MatterJS.BodyType|undefined,elapsed=this.time.now-active.lastLaunch;
      if(!body){this.activeBalls.delete(active.id);continue}
      const canRetry=isRelaunchReady(active.img.x,active.img.y,body.velocity.y,elapsed);
      if(canRetry)this.showRetry(active);
      if(active.retryRing)active.retryRing.setPosition(active.img.x,active.img.y);
      if(elapsed>12000&&!active.forced){active.forced=true;active.img.setVelocity((300-active.img.x)/45,12);this.toast('引导单位球前往出口')}
      const speed=Math.abs(body.velocity.x)+Math.abs(body.velocity.y);
      const inPegField=active.img.x<TRACK.innerRailX-TRACK.spawn.radius&&active.img.y>TRACK.topY+TRACK.spawn.radius&&active.img.y<TRACK.exit.y;
      const stalled=inPegField&&speed<.45&&!canRetry;
      active.stalledSince=stalled?(active.stalledSince??this.time.now):undefined;
      if(active.stalledSince!==undefined&&this.time.now-active.stalledSince>900){
        const direction=active.img.x<TRACK.exit.x?1:-1;
        active.rescueCount++;active.stalledSince=undefined;
        active.img.setPosition(Phaser.Math.Clamp(active.img.x+direction*12,TRACK.leftWallX+24,TRACK.innerRailX-24),Math.min(active.img.y+26,TRACK.exit.y-24));
        active.img.setAngularVelocity(Phaser.Math.FloatBetween(-.12,.12)).setVelocity(direction*Phaser.Math.FloatBetween(2.2,3.6),Phaser.Math.FloatBetween(3.5,5.5));
        this.burst(active.img.x,active.img.y,0x9af6dd);
      }
      if(elapsed>15500)this.exitBall(active.id);
    }
    if(this.c.snapshot().phase==='BATTLE'){
      this.acc+=Math.min(delta,100);
      while(this.acc>=50){
        const events=this.c.tickBattle(50),battle=this.c.battleSnapshot();
        if(battle&&events.length)this.playBattleEvents(events,battle);
        this.acc-=50;
      }
      if(this.c.snapshot().phase==='BATTLE')this.renderBattle();
    }
  }
}
