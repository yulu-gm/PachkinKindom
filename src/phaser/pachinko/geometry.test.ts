import{describe,expect,it}from'vitest';
import{GRID_SLOTS}from'../../game/peg-grid';
import{isRelaunchReady,TRACK}from'./geometry';

describe('pachinko launch track geometry',()=>{
  it('spawns the ball inside a sealed launch lane',()=>{
    expect(TRACK.spawn.x-TRACK.spawn.radius).toBeGreaterThan(TRACK.innerRailX);
    expect(TRACK.spawn.x+TRACK.spawn.radius).toBeLessThan(TRACK.outerWallX);
    expect(TRACK.spawn.y+TRACK.spawn.radius).toBeLessThan(TRACK.launchFloorY);
  });
  it('leaves a top entrance and deflects the ball into the field',()=>{
    const guideYAtInnerRail=TRACK.guide.y+Math.tan(TRACK.guide.angle)*(TRACK.innerRailX-TRACK.guide.x);
    expect(TRACK.guide.angle).toBeGreaterThan(0);
    expect(TRACK.innerRailTop-guideYAtInnerRail).toBeGreaterThan(TRACK.spawn.radius*2+12);
    expect(TRACK.guide.left).toBeLessThan(TRACK.innerRailX);
  });
  it('keeps every lower 8 by 5 grid peg outside launcher and exit safe zones',()=>{
    expect(GRID_SLOTS).toHaveLength(40);
    expect(new Set(GRID_SLOTS.map(peg=>peg.x))).toHaveLength(8);
    expect(new Set(GRID_SLOTS.map(peg=>peg.y))).toHaveLength(5);
    for(const peg of GRID_SLOTS){expect(peg.x).toBeLessThanOrEqual(536);expect(peg.y).toBeGreaterThanOrEqual(250);expect(peg.y).toBeLessThanOrEqual(470)}
  });
  it('only allows a returned ball at the launch origin to relaunch',()=>{
    expect(isRelaunchReady(TRACK.spawn.x,TRACK.spawn.y,1,900)).toBe(true);
    expect(isRelaunchReady(TRACK.spawn.x,TRACK.spawn.y,-20,900)).toBe(false);
    expect(isRelaunchReady(TRACK.spawn.x,TRACK.spawn.y,1,200)).toBe(false);
    expect(isRelaunchReady(TRACK.innerRailX-20,TRACK.spawn.y,1,900)).toBe(false);
  });
});
