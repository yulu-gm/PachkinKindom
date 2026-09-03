import{describe,expect,it}from'vitest';
import{GRID_SLOTS}from'../../game/peg-grid';
import{AIM_SPEED,aimVelocity,isLaunchPoint,LAUNCH_ZONE,MACHINE,rotateVelocity,TELEPORT_ZONE,teleportPoint}from'./geometry';

describe('manual pachinko launch geometry',()=>{
  it('uses the full machine width above the first peg row and keeps the projectile inside walls',()=>{
    expect(LAUNCH_ZONE.minX).toBe(MACHINE.leftWallX+MACHINE.projectileRadius+10);
    expect(LAUNCH_ZONE.maxX).toBe(MACHINE.rightWallX-MACHINE.projectileRadius-10);
    expect(LAUNCH_ZONE.maxY).toBeLessThan(Math.min(...GRID_SLOTS.map(peg=>peg.y))-MACHINE.projectileRadius);
    expect(isLaunchPoint(LAUNCH_ZONE.minX,LAUNCH_ZONE.minY)).toBe(true);
    expect(isLaunchPoint(MACHINE.leftWallX,LAUNCH_ZONE.minY)).toBe(false);
    expect(MACHINE.exit.width).toBeGreaterThanOrEqual(560);
    expect(MACHINE.exit.x-MACHINE.exit.width/2).toBeLessThanOrEqual(MACHINE.leftWallX+MACHINE.projectileRadius);
    expect(MACHINE.exit.x+MACHINE.exit.width/2).toBeGreaterThanOrEqual(MACHINE.rightWallX-MACHINE.projectileRadius);
    expect(Math.min(...GRID_SLOTS.map(peg=>peg.x))).toBeGreaterThan(MACHINE.leftWallX+MACHINE.projectileRadius+9);
    expect(Math.max(...GRID_SLOTS.map(peg=>peg.x))).toBeLessThan(MACHINE.rightWallX-MACHINE.projectileRadius-9);
  });
  it('maps pointer distance to clamped launch strength',()=>{
    expect(aimVelocity({x:0,y:0},{x:0,y:0})).toEqual({x:0,y:AIM_SPEED.min,speed:AIM_SPEED.min});
    expect(aimVelocity({x:0,y:0},{x:0,y:1000}).speed).toBe(AIM_SPEED.max);
    const mid=aimVelocity({x:0,y:0},{x:90,y:0});expect(mid.speed).toBeCloseTo(9);expect(mid.x).toBeCloseTo(9);
  });
  it('rotates fan projectile velocities without changing speed',()=>{
    const original={x:0,y:10},left=rotateVelocity(original,-12),right=rotateVelocity(original,12);
    expect(Math.hypot(left.x,left.y)).toBeCloseTo(10);expect(left.x).toBeGreaterThan(0);expect(right.x).toBeLessThan(0);
  });
  it('returns teleport points inside the clear upper playfield',()=>{
    for(let seed=0;seed<100;seed++){const point=teleportPoint(seed);expect(point.x).toBeGreaterThanOrEqual(TELEPORT_ZONE.minX);expect(point.x).toBeLessThanOrEqual(TELEPORT_ZONE.maxX);expect(point.y).toBeGreaterThanOrEqual(TELEPORT_ZONE.minY);expect(point.y).toBeLessThanOrEqual(TELEPORT_ZONE.maxY)}
  });
});
