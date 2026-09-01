import{describe,expect,it}from'vitest';
import{addBallExperience,createBall,FORM_CHAINS,nextExperienceCost,XP_COSTS}from'./ball-progression';

describe('unit-ball progression',()=>{
  it('carries excess experience across star and evolution nodes',()=>{
    const grown=addBallExperience(createBall('b1','warrior',{row:1,col:1}),125);
    expect(grown).toMatchObject({form:'knight',star:1,xp:5});
    expect(nextExperienceCost(grown)).toBe(80);
  });

  it('caps the final form at three stars',()=>{
    const grown=addBallExperience(createBall('b1','mage',{row:1,col:1}),9999);
    expect(grown).toMatchObject({form:'archmage',star:3,xp:0});
    expect(nextExperienceCost(grown)).toBeUndefined();
  });

  it('provides five three-star forms for every class',()=>{
    expect(FORM_CHAINS).toEqual({
      warrior:['warrior','knight','general','commander','lord'],
      mage:['mage','wizard','elementalist','magus','archmage'],
      archer:['archer','crossbowman','ranger','sharpshooter','hawkeye'],
    });
    expect(XP_COSTS).toEqual([20,40,60,80,100,120,140,160,200,250,310,380,460,550]);
  });

  it('carries explosive experience into the fifth form',()=>{
    const grown=addBallExperience(createBall('b1','warrior',{row:1,col:1}),1860);
    expect(grown).toMatchObject({form:'lord',star:1,xp:0});
    expect(nextExperienceCost(grown)).toBe(460);
  });
});
