import{describe,it,expect}from'vitest';import{isRelaunchReady,PEG_LAYOUT,PEG_ROWS,TRACK}from'./geometry';

describe('pachinko launch track geometry',()=>{
  it('spawns the ball inside a sealed launch lane',()=>{
    expect(TRACK.spawn.x-TRACK.spawn.radius).toBeGreaterThan(TRACK.innerRailX);
    expect(TRACK.spawn.x+TRACK.spawn.radius).toBeLessThan(TRACK.outerWallX);
    expect(TRACK.spawn.y+TRACK.spawn.radius).toBeLessThan(TRACK.launchFloorY);
  });

  it('leaves a top entrance and deflects the ball into the field',()=>{
    expect(TRACK.topBoundaryRight).toBeLessThanOrEqual(TRACK.innerRailX);
    const guideYAtInnerRail=TRACK.guide.y+Math.tan(TRACK.guide.angle)*(TRACK.innerRailX-TRACK.guide.x);
    const exitClearance=TRACK.innerRailTop-guideYAtInnerRail;
    expect(TRACK.guide.angle).toBeGreaterThan(0);
    expect(exitClearance).toBeGreaterThan(TRACK.spawn.radius*2+12);
    expect(TRACK.guide.left).toBeLessThan(TRACK.innerRailX);
  });

  it('increases peg density progressively from top to bottom',()=>{
    const spacings=PEG_LAYOUT.map(row=>row.length>1?row[1]!.x-row[0]!.x:Infinity);
    expect(PEG_ROWS).toHaveLength(8);
    expect(PEG_LAYOUT[0]).toHaveLength(5);
    expect(PEG_LAYOUT.at(-1)).toHaveLength(12);
    PEG_LAYOUT.forEach((row,index)=>expect(row).toHaveLength(index+5));
    for(let i=1;i<spacings.length;i++)expect(spacings[i]!).toBeLessThan(spacings[i-1]!);
    expect(PEG_ROWS[0].y-TRACK.topY).toBeGreaterThan(100);
    expect(spacings[0]!).toBeGreaterThan(120);
    expect(spacings.at(-1)!).toBeGreaterThanOrEqual(46);
    const rightmost=Math.max(...PEG_LAYOUT.flatMap(row=>row.map(peg=>peg.x)));
    expect(TRACK.innerRailX-rightmost).toBeGreaterThan(TRACK.spawn.radius*2+12);
  });

  it('only allows a returned ball at the launch origin to relaunch',()=>{
    expect(isRelaunchReady(TRACK.spawn.x,TRACK.spawn.y,1,900)).toBe(true);
    expect(isRelaunchReady(TRACK.spawn.x,TRACK.spawn.y,-20,900)).toBe(false);
    expect(isRelaunchReady(TRACK.spawn.x,TRACK.spawn.y,1,200)).toBe(false);
    expect(isRelaunchReady(TRACK.innerRailX-20,TRACK.spawn.y,1,900)).toBe(false);
    expect(isRelaunchReady(TRACK.spawn.x,420,1,900)).toBe(false);
  });
});
