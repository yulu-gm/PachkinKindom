export type Phase='SHOP'|'LAUNCHING'|'TRANSFERRING'|'BATTLE'|'RUN_END';
export type BallClass='warrior'|'mage'|'archer';
export type BallForm='warrior'|'knight'|'general'|'commander'|'lord'|'mage'|'wizard'|'elementalist'|'magus'|'archmage'|'archer'|'crossbowman'|'ranger'|'sharpshooter'|'hawkeye';
export type Star=1|2|3;
export type Cell={row:0|1|2|3;col:0|1|2|3|4|5};
export type BallUnit={id:string;sourceCardId?:string;class:BallClass;form:BallForm;star:Star;xp:number;cell:Cell};
export type PegQuality='common'|'rare'|'epic'|'legendary';
export type PegType='normal'|'experience'|'power'|'haste'|'guard'|'echo'|'spring'|'multiplier'|'teleport';
export type SpecialPegType=Exclude<PegType,'normal'>;
export type PegSlot={id:number;x:number;y:number;type:PegType;quality:PegQuality;installedCardId?:string;bonusXp:number;bonusMultiplier:number};
export type LaunchResult={ballId:string;xp:number;xpMultiplier:number;attackBonus:number;hasteBonus:number;shieldRatio:number;echoRepeats:number};

export type CardKind='unit'|'peg'|'experience-bomb'|'multiplier-bomb';
export type CardInstance={
  id:string;kind:CardKind;consumable?:boolean;
  ballClass?:BallClass;pegType?:SpecialPegType;quality?:PegQuality;
};
export type CardRoundStatus='available'|'reserved'|'used'|'equipped'|'invalidated';
export type CardRoundState=Record<string,CardRoundStatus>;
export type ActiveProjectile={
  id:string;sourceCardId:string;kind:Exclude<CardKind,'peg'>;quality?:PegQuality;unitId?:string;ballClass?:BallClass;hitPegIds:number[];
};

export type ShopItem=
  |{kind:'unit';ballClass:BallClass;price:5}
  |{kind:'peg';pegType:SpecialPegType;quality:PegQuality;price:number}
  |{kind:'experience-bomb'|'multiplier-bomb';quality:PegQuality;price:number};
export type ShopSlot={item:ShopItem;locked:boolean;sold:boolean};
export type ShopState={slots:ShopSlot[];rerollCost:number;seed:number};
export type PopulationState={level:number;xp:number};
export type RunState={
  seed:number;phase:Phase;gold:number;stage:number;nextId:number;
  cards:CardInstance[];cardRound:CardRoundState;roundUsedCards:Record<string,CardInstance>;aimingCardId?:string;
  activeProjectiles:Record<string,ActiveProjectile>;
  balls:BallUnit[];pegGrid:PegSlot[];shop:ShopState;population:PopulationState;
  launchResults:Record<string,LaunchResult>;launchQueue:string[];transferredBallIds:string[];
  result?:'victory'|'defeat';
};
