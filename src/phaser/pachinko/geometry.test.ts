import{describe,it,expect}from'vitest';import{TRACK}from'./geometry';

describe('pachinko launch track geometry',()=>{
  it('spawns the ball inside a sealed launch lane',()=>{
    expect(TRACK.spawn.x-TRACK.spawn.radius).toBeGreaterThan(TRACK.innerRailX);
    expect(TRACK.spawn.x+TRACK.spawn.radius).toBeLessThan(TRACK.outerWallX);
    expect(TRACK.spawn.y+TRACK.spawn.radius).toBeLessThan(TRACK.launchFloorY);
  });

  it('leaves a top entrance and deflects the ball into the field',()=>{
    expect(TRACK.topBoundaryRight).toBeLessThanOrEqual(TRACK.innerRailX);
    expect(TRACK.innerRailTop).toBeGreaterThan(TRACK.topY+TRACK.spawn.radius*2);
    expect(TRACK.guide.angle).toBeLessThan(0);
    expect(TRACK.guide.left).toBeLessThan(TRACK.innerRailX);
  });
});
