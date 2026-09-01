# Peg-Field Opening and Instant Deployment Design

**Date:** 2026-09-01

## Goal

Create a clear, peg-free entry space at the top of the pachinko field and replace the bottom rolling transfer presentation with immediate deployment onto the tactics board.

## Final Geometry

- Change the fixed peg grid from 8 columns × 7 rows to 8 columns × 5 rows.
- Keep the existing horizontal positions: `x = 60, 128, 196, 264, 332, 400, 468, 536`.
- Keep the lower five existing vertical positions: `y = 250, 305, 360, 415, 470`.
- Reindex the remaining 40 slots from 0 through 39 in row-major order.
- Do not move the launcher, guide rail, bottom exit, or tactics board.

## Instant Deployment

- Remove the visible bottom transfer lane, its label, and every cross-screen rolling tween.
- When a unit ball touches the bottom exit, resolve its accumulated experience and destroy its Matter body.
- Immediately create the corresponding tactics piece at its saved board cell.
- Play a stationary spawn burst lasting approximately 180 ms at that cell. The effect may use a compact flash and cartoon smoke, but it must not move the piece between panels.
- For multiple balls, deploy the current ball, play the short spawn burst, then launch the next ball.
- After the final ball appears, start battle automatically.

## Behavior

- The upper field from the entrance to `y=250` contains no pegs.
- Normal and special peg collision effects remain unchanged.
- Shop peg dragging continues to target any of the 40 legal slots.
- Removing two rows intentionally lowers the average number of peg hits and experience gained per launch.

## Verification

- Rule tests assert exactly 40 slots, 8 unique X positions, and 5 unique Y positions.
- Geometry tests assert a minimum peg Y of 250 and maximum peg Y of 470.
- Scene review confirms there is no transfer-lane graphic or cross-screen tween and that the stationary spawn burst does not obscure neighboring cells.
- The complete test suite and production build must pass.
