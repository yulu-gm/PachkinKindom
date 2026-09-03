import Phaser from'phaser';
import{addBallExperience,nextExperienceCost,progressionNode}from'../../game/ball-progression';
import{createBall}from'../../game/ball-progression';
import type{BattleEvent,BattleState}from'../../game/battle';
import type{ActiveProjectile,BallClass,BallForm,BallUnit,CardInstance,CardKind,PegQuality,PegSlot,PegType,RunState}from'../../game/model';
import type{GameController}from'../../game/controller';
import{aimVelocity,isLaunchPoint,LAUNCH_ZONE,MACHINE,rotateVelocity,teleportPoint}from'../pachinko/geometry';

type ProjectileView={state:ActiveProjectile;img:Phaser.Physics.Matter.Image;launchedAt:number;forced:boolean;stalledSince?:number;rescueCount:number;previewNode:number;teleportFrame?:number};
type UnitView={root:Phaser.GameObjects.Container;sprite:Phaser.GameObjects.Sprite;bar:Phaser.GameObjects.Rectangle;shield:Phaser.GameObjects.Arc;role:'soldier'|'slime'};
type AimView={card:CardInstance;start:{x:number;y:number};ball:Phaser.GameObjects.Image;graphics:Phaser.GameObjects.Graphics};
const CLASS_COLOR:Record<BallClass,number>={warrior:0xd45846,mage:0x726de8,archer:0x55a863};
const PEG_COLOR:Record<PegType,number>={normal:0xdab15f,experience:0xe5e0c8,power:0xff5b57,haste:0x5bc8ff,guard:0x77d7b0,echo:0xc57bff,spring:0xffe35b,multiplier:0xa9df55,teleport:0x56e0dc};
const PEG_SYMBOL:Record<PegType,string>={normal:'',experience:'验',power:'攻',haste:'速',guard:'盾',echo:'响',spring:'弹',multiplier:'倍',teleport:'传'};
const QUALITY_COLOR:Record<PegQuality,number>={common:0xe8e5dc,rare:0x5ba7ff,epic:0xc873ff,legendary:0xffa63d};
const FORM_NAME:Record<BallForm,string>={warrior:'战士',knight:'骑士',general:'将军',commander:'统帅',lord:'领主',mage:'术士',wizard:'法师',elementalist:'元素师',magus:'魔导师',archmage:'大魔法师',archer:'弓手',crossbowman:'弩手',ranger:'游侠',sharpshooter:'神射手',hawkeye:'鹰眼射手'};
const FORM_CLASS:Record<BallForm,BallClass>={warrior:'warrior',knight:'warrior',general:'warrior',commander:'warrior',lord:'warrior',mage:'mage',wizard:'mage',elementalist:'mage',magus:'mage',archmage:'mage',archer:'archer',crossbowman:'archer',ranger:'archer',sharpshooter:'archer',hawkeye:'archer'};
const BOARD_X=708,BOARD_Y=88,CELL_W=90,CELL_H=88;
const boardPoint=(row:number,col:number)=>({x:BOARD_X+43+col*CELL_W,y:BOARD_Y+41+row*CELL_H});

export class GameScene extends Phaser.Scene{
  private c!:GameController;
  private projectiles=new Map<string,ProjectileView>();
  private pegViews=new Map<number,{ring:Phaser.GameObjects.Arc;text:Phaser.GameObjects.Text;boost:Phaser.GameObjects.Text}>();
  private prepViews:Phaser.GameObjects.GameObject[]=[];
  private battleViews=new Map<string,UnitView>();
  private reduced=false;
  private acc=0;
  private unsub?:()=>void;
  private dragging?:{cardId:string;kind:CardKind};
  private dragMarker?:Phaser.GameObjects.Arc;
  private launchZoneView?:Phaser.GameObjects.Rectangle;
  private aim?:AimView;
  private canvas?:HTMLCanvasElement;
  private pegCooldowns=new Map<number,number>();
  private pegTooltip?:Phaser.GameObjects.Text;
  private frameIndex=0;
  private renderedStage=0;

  constructor(){super('game')}
  create():void{
    this.c=this.registry.get('controller')as GameController;this.input.mouse?.disableContextMenu();
    this.drawShell();this.buildMachine();this.drawBoard();
    this.matter.world.on('collisionstart',(event:any)=>this.collide(event));
    const start=()=>this.startExpedition(),motion=(event:Event)=>this.reduced=(event as CustomEvent<boolean>).detail;
    const dragStart=(event:Event)=>this.dragging=(event as CustomEvent<{cardId:string;kind:CardKind}>).detail;
    const dragEnd=()=>this.clearCardDrag(),blur=()=>this.cancelAim(),keydown=(event:KeyboardEvent)=>{if(event.key==='Escape')this.cancelAim()};
    window.addEventListener('pk-start',start);window.addEventListener('pk-motion',motion);window.addEventListener('pk-card-drag-start',dragStart);window.addEventListener('pk-card-drag-end',dragEnd);
    window.addEventListener('blur',blur);window.addEventListener('keydown',keydown);
    this.canvas=this.game.canvas;
    const canvasDrag=(event:DragEvent)=>this.onCanvasDrag(event),canvasDrop=(event:DragEvent)=>this.onCanvasDrop(event);
    this.canvas.addEventListener('dragover',canvasDrag);this.canvas.addEventListener('drop',canvasDrop);
    this.input.on('pointermove',(pointer:Phaser.Input.Pointer)=>this.updateAim(pointer.x,pointer.y));
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{if(!this.aim)return;if(pointer.rightButtonDown())this.cancelAim();else if(pointer.leftButtonDown())this.confirmAim(pointer.x,pointer.y)});
    this.input.on('drag',(_:Phaser.Input.Pointer,view:Phaser.GameObjects.Container,dragX:number,dragY:number)=>{if(this.c.snapshot().phase==='SHOP'&&view.getData('ballId'))view.setPosition(dragX,dragY)});
    this.input.on('dragend',(_:Phaser.Input.Pointer,view:Phaser.GameObjects.Container)=>this.dropFormation(view));
    this.unsub=this.c.subscribe(state=>this.render(state));
    this.events.once('shutdown',()=>{window.removeEventListener('pk-start',start);window.removeEventListener('pk-motion',motion);window.removeEventListener('pk-card-drag-start',dragStart);window.removeEventListener('pk-card-drag-end',dragEnd);window.removeEventListener('blur',blur);window.removeEventListener('keydown',keydown);this.canvas?.removeEventListener('dragover',canvasDrag);this.canvas?.removeEventListener('drop',canvasDrop);this.unsub?.()});
  }

  private drawShell(){
    this.add.rectangle(336,328,654,640,0x182a36).setStrokeStyle(6,0xd2a456);
    this.add.rectangle(972,328,610,640,0x183126).setStrokeStyle(6,0xd2a456);
    this.add.text(336,14,'♛ 王国训练场',{fontFamily:'monospace',fontSize:'22px',color:'#ffe1a0'}).setOrigin(.5,0);
    this.add.text(972,14,'⚔ 王国战棋场',{fontFamily:'monospace',fontSize:'22px',color:'#ffe1a0'}).setOrigin(.5,0);
    this.add.text(336,46,'拖入顶部区域定起点 · 移动鼠标瞄准 · 点击发射',{fontFamily:'monospace',fontSize:'13px',color:'#9ec7d3'}).setOrigin(.5,0);
  }
  private buildMachine(){
    const addWall=(x:number,y:number,w:number,h:number,angle=0)=>this.matter.add.rectangle(x,y,w,h,{isStatic:true,label:'wall',angle,friction:.02,restitution:.76});
    addWall(MACHINE.leftWallX,312,18,MACHINE.bottomY-MACHINE.topY);addWall(MACHINE.rightWallX,312,18,MACHINE.bottomY-MACHINE.topY);
    addWall((MACHINE.leftWallX+MACHINE.rightWallX)/2,MACHINE.topY,MACHINE.rightWallX-MACHINE.leftWallX,16);
    // 右侧发射轨道已移除，底部不再设置会把小球夹在两侧的导流板。
    this.launchZoneView=this.add.rectangle((LAUNCH_ZONE.minX+LAUNCH_ZONE.maxX)/2,(LAUNCH_ZONE.minY+LAUNCH_ZONE.maxY)/2,LAUNCH_ZONE.maxX-LAUNCH_ZONE.minX,LAUNCH_ZONE.maxY-LAUNCH_ZONE.minY,0x69d9cf,.035).setStrokeStyle(2,0x69d9cf,.45).setDepth(1);
    this.add.text(336,92,'小球卡拖放区',{fontFamily:'monospace',fontSize:'11px',color:'#69d9cf'}).setOrigin(.5).setAlpha(.66);
    for(const slot of this.c.snapshot().pegGrid){
      const ring=this.add.circle(slot.x,slot.y,10,PEG_COLOR[slot.type]).setStrokeStyle(3,QUALITY_COLOR[slot.quality]).setDepth(2);
      const text=this.add.text(slot.x,slot.y,PEG_SYMBOL[slot.type],{fontFamily:'monospace',fontSize:'10px',fontStyle:'bold',color:'#ffffff',stroke:'#18222b',strokeThickness:2}).setOrigin(.5).setDepth(3);
      const boost=this.add.text(slot.x+12,slot.y-13,'',{fontFamily:'monospace',fontSize:'8px',fontStyle:'bold',color:'#d9ff8b',stroke:'#152018',strokeThickness:2}).setDepth(4);
      ring.setInteractive({useHandCursor:true}).on('pointerover',()=>this.showPegTooltip(slot.id)).on('pointerout',()=>this.hidePegTooltip());
      this.matter.add.circle(slot.x,slot.y,9,{isStatic:true,label:`peg:${slot.id}`,restitution:.9});this.pegViews.set(slot.id,{ring,text,boost});
    }
    this.matter.add.rectangle(MACHINE.exit.x,MACHINE.exit.y,MACHINE.exit.width,MACHINE.exit.height,{isStatic:true,isSensor:true,label:'exit'});
    this.add.rectangle(MACHINE.exit.x,MACHINE.exit.y,MACHINE.exit.width,8,0x79d9ca,.25).setStrokeStyle(2,0x9af6dd);
    this.add.text(MACHINE.exit.x,558,'▼ 单位部署 / 爆弹回收出口 ▼',{fontFamily:'monospace',fontSize:'11px',color:'#9af6dd'}).setOrigin(.5,0);
  }
  private drawBoard(){
    for(let row=0;row<4;row++)for(let col=0;col<6;col++){const point=boardPoint(row,col);this.add.rectangle(point.x,point.y,84,82,(row+col)%2?0x625b43:0x817653).setStrokeStyle(2,col<3?0x6fa3b0:0xad6a6a)}
    this.add.text(837,454,'己方编队区 | 拖动单位调整位置 · 右键售出',{fontFamily:'monospace',fontSize:'13px',color:'#b9d9d1'}).setOrigin(.5);
    this.add.text(1108,454,'敌方区域',{fontFamily:'monospace',fontSize:'13px',color:'#d8a9a0'}).setOrigin(.5);
  }
  private startExpedition(){try{this.c.beginExpedition()}catch(error){this.toast(error instanceof Error?error.message:'无法开始远征')}}

  private onCanvasDrag(event:DragEvent){
    if(!this.dragging)return;event.preventDefault();const point=this.canvasPoint(event.clientX,event.clientY);
    if(this.dragging.kind==='peg'){
      const nearest=this.nearestPeg(point.x,point.y);this.launchZoneView?.setFillStyle(0x69d9cf,.035);
      if(!nearest||nearest.distance>34){this.dragMarker?.setVisible(false);return}
      if(!this.dragMarker)this.dragMarker=this.add.circle(nearest.x,nearest.y,17,0xffffff,.12).setStrokeStyle(3,0xffffff).setDepth(30);
      this.dragMarker.setPosition(nearest.x,nearest.y).setVisible(true);
    }else this.launchZoneView?.setFillStyle(isLaunchPoint(point.x,point.y)?0x69f0d2:0xd96b61,isLaunchPoint(point.x,point.y)?.2:.09).setStrokeStyle(3,isLaunchPoint(point.x,point.y)?0x9affdf:0xff8878,.9);
  }
  private onCanvasDrop(event:DragEvent){
    if(!this.dragging)return;event.preventDefault();const point=this.canvasPoint(event.clientX,event.clientY),dragging=this.dragging;
    try{
      if(dragging.kind==='peg'){
        const nearest=this.nearestPeg(point.x,point.y);if(!nearest||nearest.distance>34)throw new Error('请放到发光钉位上');
        this.c.placePegCard(dragging.cardId,nearest.id);this.burst(nearest.x,nearest.y,0xffffff);this.toast('钉子卡已装配');
      }else{
        if(!isLaunchPoint(point.x,point.y))throw new Error('请放到顶部高亮区域');
        const card=this.c.reserveCard(dragging.cardId);this.createAim(card,point.x,point.y);this.toast('移动鼠标确定速度，点击发射 · 右键/Esc 取消');
      }
    }catch(error){this.toast(error instanceof Error?error.message:'无法使用卡牌')}
    this.clearCardDrag();
  }
  private createAim(card:CardInstance,x:number,y:number){
    this.destroyAimView();const texture=card.kind==='unit'?`${card.ballClass}-ball`:'mage-ball',ball=this.add.image(x,y,texture).setDepth(35).setScale(1.05);
    if(card.kind==='experience-bomb')ball.setTint(0xffd75e);if(card.kind==='multiplier-bomb')ball.setTint(0xa9df55);
    this.aim={card,start:{x,y},ball,graphics:this.add.graphics().setDepth(34)};this.updateAim(this.input.activePointer.x,this.input.activePointer.y);
  }
  private updateAim(x:number,y:number){
    if(!this.aim)return;const velocity=aimVelocity(this.aim.start,{x,y}),end={x:this.aim.start.x+velocity.x*9,y:this.aim.start.y+velocity.y*9},g=this.aim.graphics;
    g.clear().lineStyle(5,0xffdb75,.9).beginPath().moveTo(this.aim.start.x,this.aim.start.y).lineTo(end.x,end.y).strokePath();
    const angle=Math.atan2(velocity.y,velocity.x),head=10;g.lineStyle(3,0xfff0ae,1).beginPath().moveTo(end.x,end.y).lineTo(end.x-Math.cos(angle-.55)*head,end.y-Math.sin(angle-.55)*head).moveTo(end.x,end.y).lineTo(end.x-Math.cos(angle+.55)*head,end.y-Math.sin(angle+.55)*head).strokePath();
    for(let tick=1;tick<=4;tick++){const t=tick/5,tx=this.aim.start.x+(end.x-this.aim.start.x)*t,ty=this.aim.start.y+(end.y-this.aim.start.y)*t;g.fillStyle(0xfff0ae,.8).fillCircle(tx,ty,1.5)}
    if(this.aim.card.kind!=='unit'){
      const half=this.aim.card.quality==='legendary'?24:this.aim.card.quality==='epic'?18:12;
      for(const degrees of[-half,half]){const edge=rotateVelocity(velocity,degrees);g.lineStyle(2,0xbef7a2,.55).beginPath().moveTo(this.aim.start.x,this.aim.start.y).lineTo(this.aim.start.x+edge.x*8,this.aim.start.y+edge.y*8).strokePath()}
    }
  }
  private confirmAim(x:number,y:number){
    if(!this.aim)return;const start=this.aim.start,velocity=aimVelocity(start,{x,y});
    try{
      const batch=this.c.confirmCardLaunch();this.destroyAimView();
      try{batch.projectiles.forEach((projectile,index)=>this.spawnProjectile(projectile,start,rotateVelocity(velocity,batch.angles[index]??0)))}
      catch(error){for(const projectile of batch.projectiles)this.removeProjectileView(projectile.id);this.c.rollbackCardLaunch(batch.card,batch.projectiles.map(projectile=>projectile.id));throw error}
    }catch(error){this.destroyAimView();if(this.c.snapshot().aimingCardId)this.c.cancelCardAim();this.toast(error instanceof Error?error.message:'发射失败')}
  }
  private cancelAim(){if(!this.aim&&!this.c.snapshot().aimingCardId)return;this.destroyAimView();this.c.cancelCardAim();this.toast('已取消瞄准，卡牌返回手牌')}
  private destroyAimView(){if(!this.aim)return;this.aim.ball.destroy();this.aim.graphics.destroy();this.aim=undefined}
  private spawnProjectile(state:ActiveProjectile,start:{x:number;y:number},velocity:{x:number;y:number}){
    const texture=state.kind==='unit'?`${state.ballClass}-ball`:'mage-ball',img=this.matter.add.image(start.x,start.y,texture).setCircle(MACHINE.projectileRadius).setBounce(.84).setFriction(.001).setFrictionAir(.002).setDepth(8);
    img.setCollisionGroup(-1);
    if(state.kind==='experience-bomb')img.setTint(0xffd75e);if(state.kind==='multiplier-bomb')img.setTint(0xa9df55);
    (img.body as MatterJS.BodyType).label=`projectile:${state.id}`;img.setAngularVelocity(Phaser.Math.FloatBetween(-.08,.08)).setVelocity(velocity.x,velocity.y);
    this.projectiles.set(state.id,{state,img,launchedAt:this.time.now,forced:false,rescueCount:0,previewNode:0});
  }
  private clearCardDrag(){this.dragging=undefined;if(this.dragMarker){this.dragMarker.destroy();this.dragMarker=undefined}this.launchZoneView?.setFillStyle(0x69d9cf,.035).setStrokeStyle(2,0x69d9cf,.45)}
  private canvasPoint(clientX:number,clientY:number){const rect=this.canvas!.getBoundingClientRect();return{x:(clientX-rect.left)*1280/rect.width,y:(clientY-rect.top)*656/rect.height}}
  private nearestPeg(x:number,y:number){return this.c.snapshot().pegGrid.map(slot=>({...slot,distance:Phaser.Math.Distance.Between(x,y,slot.x,slot.y)})).sort((a,b)=>a.distance-b.distance)[0]}

  private collide(event:any){
    for(const pair of event.pairs as any[]){
      const labels=[pair.bodyA.label as string,pair.bodyB.label as string],label=labels.find(value=>value.startsWith('projectile:'));if(!label)continue;
      const id=label.slice(11),peg=labels.find(value=>value.startsWith('peg:'));if(peg)this.hitPeg(id,Number(peg.slice(4)));if(labels.includes('exit'))this.exitProjectile(id);
    }
  }
  private hitPeg(id:string,slotId:number){
    const active=this.projectiles.get(id);if(!active)return;
    try{
      const before=this.c.snapshot().pegGrid[slotId]!;if(before.type==='teleport'&&active.teleportFrame===this.frameIndex)return;
      const effectReady=before.type!=='multiplier'||(this.pegCooldowns.get(slotId)??0)<=this.time.now,outcome=this.c.recordProjectilePegHit(id,slotId,effectReady);
      if(outcome.kind==='unit'){
        if(outcome.cooldownMs)this.pegCooldowns.set(slotId,this.time.now+outcome.cooldownMs);
        const preview=this.previewUnit(active),node=progressionNode(preview),beforeNode=active.previewNode;active.previewNode=node;window.dispatchEvent(new CustomEvent('pk-growth-hit',{detail:active.state.unitId}));
        this.floatText(before.x,before.y-8,`+${this.compactNumber(outcome.xpGained)} EXP`,PEG_COLOR[before.type]);if(node>beforeNode)this.boostGrowth(active,beforeNode,node,preview);
      }else if(outcome.applied){
        const after=this.c.snapshot().pegGrid[slotId]!,text=outcome.kind==='experience-bomb'?`经验 +${after.bonusXp}`:`经验 ×${this.compactMultiplier(after.bonusMultiplier)}`;
        this.floatText(after.x,after.y-12,text,outcome.kind==='experience-bomb'?0xffd75e:0xa9df55);
      }
      this.burst(before.x,before.y,PEG_COLOR[before.type]);
      if(outcome.springPower)active.img.setVelocity(Phaser.Math.FloatBetween(-3.5,3.5)*outcome.springPower,-14-(outcome.springPower-1)*6);
      if(outcome.teleport){active.teleportFrame=this.frameIndex;this.teleportProjectile(active,before,outcome.teleportPower)}
    }catch(error){console.error('[GameScene] 弹丸撞钉处理失败',{projectileId:id,slotId,error})}
  }
  private previewUnit(active:ProjectileView){
    const unitId=active.state.unitId!,ballClass=active.state.ballClass!,result=this.c.snapshot().launchResults[unitId];
    return addBallExperience(createBall(unitId,ballClass,{row:0,col:0},active.state.sourceCardId),result?.xp??0);
  }
  private boostGrowth(active:ProjectileView,beforeNode:number,node:number,preview:BallUnit){
    const gained=node-beforeNode,body=active.img.body as MatterJS.BodyType,evolved=Math.floor(beforeNode/3)!==Math.floor(node/3),color=CLASS_COLOR[preview.class];
    active.img.setBounce(Math.min(1.08,.84+.04*node)).setFrictionAir(Math.max(.0006,.002-.00018*node));active.img.setVelocity(body.velocity.x+Phaser.Math.FloatBetween(-1.5,1.5),Math.min(body.velocity.y,-6-1.2*gained-(evolved?3:0)));
    this.floatText(active.img.x,active.img.y-22,evolved?`${FORM_NAME[preview.form]}进化！`:`升星 ×${gained}`,color);if(evolved)this.banner(`${FORM_NAME[preview.form]}进化！`,color);
  }
  private teleportProjectile(active:ProjectileView,slot:PegSlot,power:number){
    const point=teleportPoint(Math.floor(this.time.now)+slot.id*101+active.rescueCount*17),legendary=slot.quality==='legendary';
    active.img.setPosition(point.x,point.y).setAngularVelocity(Phaser.Math.FloatBetween(-.16,.16));active.img.setVelocity(legendary?Phaser.Math.FloatBetween(-3.5,3.5)*Math.min(2,power):Phaser.Math.FloatBetween(-1.2,1.2),legendary?Phaser.Math.FloatBetween(5,8)+power:Phaser.Math.FloatBetween(2.5,4));
    active.launchedAt=this.time.now;active.forced=false;active.stalledSince=undefined;this.burst(point.x,point.y,QUALITY_COLOR[slot.quality]);
  }
  private exitProjectile(id:string){
    const active=this.projectiles.get(id);if(!active)return;this.projectiles.delete(id);active.img.destroy();
    try{const deployed=this.c.finishProjectile(id);if(deployed){const target=boardPoint(deployed.cell.row,deployed.cell.col);this.spawnBurst(target.x,target.y,deployed.class);this.toast(`${FORM_NAME[deployed.form]}已自动部署`)}}
    catch(error){console.error('[GameScene] 弹丸结算失败',error)}
  }

  private render(state:RunState){
    if(state.stage!==this.renderedStage){this.renderedStage=state.stage;this.pegCooldowns.clear()}
    for(const slot of state.pegGrid)this.updatePegView(slot);
    if(state.phase==='SHOP'){this.renderPrep(state);this.clearBattle()}else if(this.prepViews.length)this.clearPrep();
    if(state.phase==='BATTLE')this.renderBattle();if(state.phase==='RUN_END'){this.destroyAimView();for(const id of[...this.projectiles.keys()])this.removeProjectileView(id)}
  }
  private updatePegView(slot:PegSlot){
    const view=this.pegViews.get(slot.id);if(!view)return;const cooling=slot.type==='multiplier'&&(this.pegCooldowns.get(slot.id)??0)>this.time.now;
    view.ring.setFillStyle(cooling?0x62686b:PEG_COLOR[slot.type],cooling?.72:1).setStrokeStyle(3,QUALITY_COLOR[slot.quality],cooling?.45:1);
    view.text.setText(cooling?'CD':PEG_SYMBOL[slot.type]).setAlpha(cooling?.55:1).setFontSize(cooling?'7px':'10px');
    const parts=[];if(slot.bonusXp)parts.push(`+${slot.bonusXp}`);if(slot.bonusMultiplier!==1)parts.push(`×${this.compactMultiplier(slot.bonusMultiplier)}`);view.boost.setText(parts.join(' '));
  }
  private showPegTooltip(slotId:number){
    const slot=this.c.snapshot().pegGrid[slotId];if(!slot)return;this.hidePegTooltip();
    const base=slot.type==='normal'?'基础钉':PEG_SYMBOL[slot.type]+' · 特殊钉',bonus='额外经验 +'+slot.bonusXp+' · 本局倍率 ×'+this.compactMultiplier(slot.bonusMultiplier);
    this.pegTooltip=this.add.text(slot.x,slot.y-30,base+'\n'+bonus,{fontFamily:'monospace',fontSize:'10px',color:'#f6efd3',backgroundColor:'#111820e8',padding:{x:7,y:5},align:'center'}).setOrigin(.5,1).setDepth(45);
  }
  private hidePegTooltip(){this.pegTooltip?.destroy();this.pegTooltip=undefined}
  private clearPrep(){for(const view of this.prepViews)view.destroy();this.prepViews=[]}
  private renderPrep(state:RunState){
    this.clearPrep();
    for(const enemy of this.c.encounter().enemies){const point=boardPoint(enemy.row,enemy.col),view=this.makeUnit(point.x,point.y,enemy.form,enemy.star,true);view.root.setAlpha(.72);this.prepViews.push(view.root)}
    for(const ball of state.balls){const point=boardPoint(ball.cell.row,ball.cell.col),view=this.makeUnit(point.x,point.y,ball.form,ball.star,false,ball);view.root.setData('ballId',ball.id).setInteractive(new Phaser.Geom.Rectangle(-40,-48,80,96),Phaser.Geom.Rectangle.Contains);if(view.root.input)view.root.input.cursor='pointer';view.root.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{if(pointer.rightButtonDown())this.sellBoardBall(ball,point.x,point.y)});this.input.setDraggable(view.root);this.prepViews.push(view.root)}
  }
  private sellBoardBall(ball:BallUnit,x:number,y:number){try{this.c.sellBall(ball.id);this.spawnBurst(x,y,ball.class);this.toast('单位卡已售出 +3 金币')}catch(error){this.toast(error instanceof Error?error.message:'无法售出单位')}}
  private makeUnit(x:number,y:number,form:BallForm,star:number,enemy=false,ball?:BallUnit):UnitView{
    const role=enemy?'slime':'soldier',className=ball?.class??FORM_CLASS[form],color=CLASS_COLOR[className],ring=this.add.ellipse(0,28,52,16,color,.25).setStrokeStyle(3,color),sprite=this.add.sprite(0,-5,`${role}-idle`).setScale(enemy?4:3);
    const label=this.add.text(0,26,FORM_NAME[form],{fontFamily:'monospace',fontSize:'11px',fontStyle:'bold',color:'#fff',stroke:'#151018',strokeThickness:3}).setOrigin(.5),stars=this.add.text(0,39,'★'.repeat(star),{fontFamily:'monospace',fontSize:'9px',color:'#ffd765',stroke:'#151018',strokeThickness:2}).setOrigin(.5);
    const barBg=this.add.rectangle(0,-40,52,6,0x1b1316),bar=this.add.rectangle(0,-40,52,6,0x62d678),shield=this.add.circle(0,-4,31,0x70d9ff,.1).setStrokeStyle(3,0x70d9ff).setVisible(false),children:Phaser.GameObjects.GameObject[]=[ring,shield,barBg,bar,sprite,label,stars];
    if(ball){const cost=nextExperienceCost(ball);children.push(this.add.text(0,50,cost?`EXP ${ball.xp}/${cost}`:'MAX',{fontFamily:'monospace',fontSize:'8px',color:'#bcefe6',stroke:'#151018',strokeThickness:2}).setOrigin(.5))}
    const root=this.add.container(x,y,children).setDepth(10);if(enemy)sprite.setFlipX(true);sprite.play(`${role}-idle`,true);sprite.on('animationcomplete',(anim:Phaser.Animations.Animation)=>{if(anim.key===`${role}-attack`||anim.key===`${role}-hurt`)sprite.play(`${role}-idle`,true)});return{root,sprite,bar,shield,role};
  }
  private dropFormation(view:Phaser.GameObjects.Container){const id=view.getData('ballId')as string|undefined;if(!id)return;const col=Phaser.Math.Clamp(Math.round((view.x-(BOARD_X+43))/CELL_W),0,2),row=Phaser.Math.Clamp(Math.round((view.y-(BOARD_Y+41))/CELL_H),0,3);try{this.c.moveBall(id,{row:row as 0|1|2|3,col:col as 0|1|2})}catch(error){this.toast(error instanceof Error?error.message:'无法布阵');this.renderPrep(this.c.snapshot())}}

  private clearBattle(){for(const view of this.battleViews.values()){this.tweens.killTweensOf(view.root);view.root.destroy()}this.battleViews.clear()}
  private renderBattle(){
    const battle=this.c.battleSnapshot();if(!battle)return;if(this.prepViews.length)this.clearPrep();
    for(const fighter of battle.fighters){let view=this.battleViews.get(fighter.id);if(fighter.hp>0){if(!view){const point=boardPoint(fighter.row,fighter.col);view=this.makeUnit(point.x,point.y,fighter.form,fighter.star,fighter.team==='enemy');this.battleViews.set(fighter.id,view)}const hp=Math.max(0,fighter.hp/fighter.maxHp);view.bar.setDisplaySize(52*hp,6);view.bar.setX(-26+26*hp);view.shield.setVisible(fighter.shield>0)}else if(view){this.battleViews.delete(fighter.id);this.tweens.killTweensOf(view.root);view.sprite.play(`${view.role}-death`);this.tweens.add({targets:view.root,alpha:0,duration:700,onComplete:()=>{if(view?.root.active)view.root.destroy()}})}}
  }
  private playBattleEvents(events:BattleEvent[],battle:BattleState){
    for(const event of events){
      if(event.type==='move'){const view=this.battleViews.get(event.id);if(view&&event.row!==undefined&&event.col!==undefined){const point=boardPoint(event.row,event.col);view.sprite.play(`${view.role}-walk`,true);this.tweens.add({targets:view.root,...point,duration:460,onComplete:()=>{if(view?.root.active&&view.sprite.active)view.sprite.play(`${view.role}-idle`,true)}})}continue}
      if(event.type==='attack'&&event.target){const attacker=this.battleViews.get(event.id);attacker?.sprite.play(`${attacker.role}-attack`,true);continue}
      if(event.type==='shield-hit'){const target=this.battleViews.get(event.id);if(target){target.shield.setVisible(true);this.floatText(target.root.x,target.root.y-40,`护盾 -${event.amount}`,0x70d9ff)}continue}
      if(event.type!=='hit'||!event.target)continue;const attacker=battle.fighters.find(f=>f.id===event.id),target=battle.fighters.find(f=>f.id===event.target),targetView=this.battleViews.get(event.target);if(!attacker||!target)continue;targetView?.sprite.play(`${targetView.role}-hurt`,true);const from=boardPoint(attacker.row,attacker.col),to=boardPoint(target.row,target.col),slash=this.add.rectangle(from.x,from.y,34,7,0xffdf73,.95).setRotation(Math.atan2(to.y-from.y,to.x-from.x)).setDepth(25);this.tweens.add({targets:slash,x:to.x,y:to.y,scaleX:.3,alpha:0,duration:150,onComplete:()=>slash.destroy()});this.burst(to.x,to.y,0xff526b);this.floatText(to.x,to.y-25,`-${event.amount??0}`,0xff8b84);if(!this.reduced)this.cameras.main.shake(55,.0025);
    }
  }
  private removeProjectileView(id:string){const active=this.projectiles.get(id);if(active){active.img.destroy();this.projectiles.delete(id)}}
  private burst(x:number,y:number,color:number){for(let index=0;index<(this.reduced?3:7);index++){const spark=this.add.image(x,y,'spark').setTint(color).setScale(.4).setDepth(28);this.tweens.add({targets:spark,x:x+Phaser.Math.Between(-22,22),y:y+Phaser.Math.Between(-22,16),alpha:0,scale:0,duration:260,onComplete:()=>spark.destroy()})}}
  private spawnBurst(x:number,y:number,ballClass:BallClass){this.burst(x,y,CLASS_COLOR[ballClass]);const flash=this.add.circle(x,y,18,0xffffff,.55).setStrokeStyle(4,CLASS_COLOR[ballClass]).setDepth(24);this.tweens.add({targets:flash,scale:2,alpha:0,duration:180,onComplete:()=>flash.destroy()})}
  private floatText(x:number,y:number,text:string,color:number){const view=this.add.text(x,y,text,{fontFamily:'monospace',fontSize:'13px',fontStyle:'bold',color:`#${color.toString(16).padStart(6,'0')}`,stroke:'#111820',strokeThickness:4}).setOrigin(.5).setDepth(30);this.tweens.add({targets:view,y:y-34,alpha:0,duration:620,onComplete:()=>view.destroy()})}
  private banner(text:string,color:number){const view=this.add.text(640,95,text,{fontFamily:'monospace',fontSize:'26px',fontStyle:'bold',color:`#${color.toString(16).padStart(6,'0')}`,stroke:'#131018',strokeThickness:7}).setOrigin(.5).setDepth(40).setScale(.6);this.tweens.add({targets:view,scale:1.1,yoyo:true,hold:500,duration:260,onComplete:()=>view.destroy()})}
  private toast(text:string){const view=this.add.text(640,610,text,{fontFamily:'monospace',fontSize:'16px',backgroundColor:'#211318',padding:{x:12,y:7},color:'#ffd68a'}).setOrigin(.5).setDepth(50);this.tweens.add({targets:view,alpha:0,y:580,duration:1400,onComplete:()=>view.destroy()})}
  private compactNumber(value:number){return Number.isFinite(value)?(Math.abs(value)<10000?String(Math.floor(value)):value.toExponential(2)):'∞'}
  private compactMultiplier(value:number){return Number.isFinite(value)?(value<1000?Number(value.toFixed(2)).toString():value.toExponential(2)):'∞'}

  update(_:number,delta:number){
    this.frameIndex++;
    for(const slot of this.c.snapshot().pegGrid){const deadline=this.pegCooldowns.get(slot.id);if(deadline!==undefined&&deadline<=this.time.now)this.pegCooldowns.delete(slot.id);if(slot.type==='multiplier')this.updatePegView(slot)}
    for(const active of this.projectiles.values()){
      const body=active.img.body as MatterJS.BodyType|undefined,elapsed=this.time.now-active.launchedAt;if(!body){this.projectiles.delete(active.state.id);continue}
      const exitLeft=MACHINE.exit.x-MACHINE.exit.width/2-MACHINE.projectileRadius,exitRight=MACHINE.exit.x+MACHINE.exit.width/2+MACHINE.projectileRadius;
      if(active.img.y>=MACHINE.exit.y-MACHINE.exit.height/2&&active.img.x>=exitLeft&&active.img.x<=exitRight){this.exitProjectile(active.state.id);continue}
      if(elapsed>12000&&!active.forced){active.forced=true;active.img.setVelocity((MACHINE.exit.x-active.img.x)/45,12);this.toast('引导弹丸前往出口')}
      const speed=Math.abs(body.velocity.x)+Math.abs(body.velocity.y),inField=active.img.x>MACHINE.leftWallX+20&&active.img.x<MACHINE.rightWallX-20&&active.img.y>MACHINE.topY+20&&active.img.y<MACHINE.exit.y,stalled=inField&&speed<.45;
      active.stalledSince=stalled?(active.stalledSince??this.time.now):undefined;if(active.stalledSince!==undefined&&this.time.now-active.stalledSince>900){const direction=active.img.x<MACHINE.exit.x?1:-1;active.rescueCount++;active.stalledSince=undefined;active.img.setPosition(Phaser.Math.Clamp(active.img.x+direction*12,MACHINE.leftWallX+24,MACHINE.rightWallX-24),Math.min(active.img.y+26,MACHINE.exit.y-24));active.img.setVelocity(direction*Phaser.Math.FloatBetween(2.2,3.6),Phaser.Math.FloatBetween(3.5,5.5));this.burst(active.img.x,active.img.y,0x9af6dd)}
      if(elapsed>15500)this.exitProjectile(active.state.id);
    }
    if(this.c.snapshot().phase==='BATTLE'){this.acc+=Math.min(delta,100);while(this.acc>=50){const events=this.c.tickBattle(50),battle=this.c.battleSnapshot();if(battle&&events.length)this.playBattleEvents(events,battle);this.acc-=50}if(this.c.snapshot().phase==='BATTLE')this.renderBattle()}
  }
}
