# OneFile HTML Build Design

## Goal

Add a separate production command that packages the current Vite, TypeScript, and Phaser game into one offline-playable HTML file while preserving the existing web build.

## Chosen approach

Use the existing Vite build as the source of truth, then run a dependency-free Node post-processing script. The script will inline the generated JavaScript and CSS, encode the ten sprite sheets as data URLs, and write `dist-onefile/PachinkoKingdom.html`.

This is preferred over replacing the normal build because hosting still benefits from separate cacheable assets. It is preferred over adding a Vite plugin because the Phaser sprite paths are dynamic and still need explicit handling.

## Components and data flow

1. `npm run build` performs the unchanged type-check and Vite production build into `dist`.
2. `src/phaser/scenes/BootScene.ts` resolves each sprite through an optional global inline-asset map, falling back to the current `assets/sprites/...` path during normal web builds.
3. `scripts/make-onefile.mjs` reads `dist/index.html`, inlines its generated CSS and module JavaScript, creates the sprite data map from `dist/assets/sprites`, and writes the standalone HTML to `dist-onefile`.
4. `npm run build:onefile` runs both stages in order.

## Error handling

The packer fails with a non-zero exit code if the Vite output has an unexpected number of module scripts, if embedded sprites are missing, or if the resulting document still contains an external script or stylesheet reference. It validates the output-directory path before clearing its own previous output.

## Compatibility and scope

The generated file must work when opened directly from disk in a modern desktop browser. Game logic, Phaser configuration, save format, and the existing `npm run build` output remain unchanged. No additional npm package is introduced.

## Verification

- Run the full logical test suite.
- Run `npm run build:onefile` and require exit code 0.
- Confirm `dist-onefile` contains only `PachinkoKingdom.html`.
- Confirm the HTML contains inline JavaScript, CSS, and PNG data URLs, with no external script or stylesheet reference.
- Open the file from disk and verify the Phaser canvas reaches the game screen without resource-load errors.
