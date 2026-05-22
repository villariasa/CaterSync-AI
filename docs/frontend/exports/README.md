Exports README
=============

This folder contains the packaged assets designers should produce and developers will consume.

Contents expected in the ZIP
- icons/svg/: optimized SVG icons (24px and 48px versions where applicable)
- icons/png/: 2x PNG fallbacks for mobile (48px)
- tokens/: design_tokens.json (Figma Tokens export)
- README.md: this file

Usage rules
- File names: kebab-case (e.g., icon-search.svg)
- Icons: use `currentColor` for stroke/fill where possible so the app can recolor icons at runtime.
- PNG fallbacks: only include when the icon uses rasterized effects or when platform SVG support is uncertain.

To create the ZIP locally (from `docs/frontend`):

```bash
cd docs/frontend
mkdir -p exports/icons/svg exports/icons/png exports/tokens
# copy exported files into the folders above
zip -r exports/catersync-design-exports.zip exports/
```
