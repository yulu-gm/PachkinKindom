import type{BallForm,Star}from'./model';

export type Encounter={name:string;scale:number;boss:boolean;enemies:{form:BallForm;star:Star;row:number;col:number}[]};
const encounter=(name:string,scale:number,forms:BallForm[],boss=false):Encounter=>({
  name,scale,boss,
  enemies:forms.map((form,index)=>({form,star:1,row:(index%4)as 0|1|2|3,col:5-Math.floor(index/4)})),
});

export const ENCOUNTERS:Encounter[]=[
  encounter('草原盗匪',.65,['warrior']),
  encounter('石桥守军',.72,['warrior','archer']),
  encounter('森林伏兵',.78,['knight','archer']),
  encounter('废塔卫队',.85,['knight','mage','archer']),
  encounter('食人魔营地',.92,['general','warrior','mage'],true),
  encounter('矿坑佣兵',1,['knight','knight','ranger']),
  encounter('幽灵城堡',1.08,['general','elementalist','ranger']),
  encounter('王室骑士',1.16,['general','knight','elementalist','ranger']),
  encounter('王座前厅',1.25,['general','general','archmage','sharpshooter']),
  encounter('腐化国王',1.38,['general','knight','archmage','ranger','sharpshooter'],true),
];
