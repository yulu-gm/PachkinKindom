import type{Rarity,UnitKind}from'./model';

export const UNIT_DEFS:Record<UnitKind,{rarity:Rarity;hp:number;attack:number;attackEveryMs:number;range:number}>={
  guard:{rarity:'white',hp:140,attack:8,attackEveryMs:1000,range:1},
  slinger:{rarity:'white',hp:75,attack:7,attackEveryMs:600,range:3},
  swordsman:{rarity:'blue',hp:110,attack:12,attackEveryMs:850,range:1},
  axeman:{rarity:'purple',hp:85,attack:18,attackEveryMs:1200,range:1},
  longbow:{rarity:'orange',hp:65,attack:10,attackEveryMs:900,range:3},
  crossbow:{rarity:'red',hp:60,attack:20,attackEveryMs:1500,range:4},
};

export const KINDS_BY_RARITY:Record<Rarity,readonly UnitKind[]>={
  white:['guard','slinger'],
  blue:['swordsman'],
  purple:['axeman'],
  orange:['longbow'],
  red:['crossbow'],
};

export const rarityForKind=(kind:UnitKind)=>UNIT_DEFS[kind].rarity;
