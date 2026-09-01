import Phaser from'phaser';
const ROLES=['soldier','slime']as const;
const ANIMS={idle:{frames:6,rate:7,repeat:-1},walk:{frames:8,rate:9,repeat:-1},attack:{frames:8,rate:11,repeat:0},hurt:{frames:4,rate:8,repeat:0},death:{frames:10,rate:9,repeat:0}}as const;

export class BootScene extends Phaser.Scene{
  constructor(){super('boot')}
  preload():void{for(const role of ROLES)for(const name of Object.keys(ANIMS)as(keyof typeof ANIMS)[])this.load.spritesheet(`${role}-${name}`,`assets/sprites/${role}-${name}.png`,{frameWidth:96,frameHeight:96})}
  create():void{
    for(const role of ROLES)for(const[name,cfg]of Object.entries(ANIMS))this.anims.create({key:`${role}-${name}`,frames:this.anims.generateFrameNumbers(`${role}-${name}`,{start:0,end:cfg.frames-1}),frameRate:cfg.rate,repeat:cfg.repeat});
    const g=this.add.graphics();g.fillStyle(0xffffff).fillRect(0,0,4,4);g.generateTexture('pixel',4,4);
    this.ballTexture(g,'warrior-ball',0xd45846,'sword');this.ballTexture(g,'mage-ball',0x726de8,'rune');this.ballTexture(g,'archer-ball',0x55a863,'arrow');
    g.clear().fillStyle(0xffd36a).fillCircle(5,5,5);g.generateTexture('spark',10,10);g.destroy();this.scene.start('game');
  }
  private ballTexture(g:Phaser.GameObjects.Graphics,key:string,color:number,crest:'sword'|'rune'|'arrow'){
    g.clear().fillStyle(0x172431).fillCircle(14,14,13).fillStyle(color).fillCircle(14,14,11).lineStyle(2,0xffe7a2).strokeCircle(14,14,11);
    if(crest==='sword')g.lineStyle(3,0xffffff).lineBetween(9,20,19,8).lineBetween(9,16,14,21);
    if(crest==='rune')g.lineStyle(2,0xffffff).strokeCircle(14,14,5).lineBetween(14,6,14,22).lineBetween(6,14,22,14);
    if(crest==='arrow')g.lineStyle(3,0xffffff).lineBetween(7,20,20,7).lineBetween(14,7,20,7).lineBetween(20,7,20,13);
    g.generateTexture(key,28,28);
  }
}
