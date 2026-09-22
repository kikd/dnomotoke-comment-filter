# Build from source

Use Node.js 18.15 or later and npm. From the extracted source directory:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

The output directories are `dist/chromium` (Chrome and Edge) and `dist/firefox`.
TypeScript is bundled with esbuild. Browser API compatibility is provided by the
bundled `webextension-polyfill` package. No remotely hosted extension code is used.

PNG icons are included in `assets/icons` and copied unchanged during normal builds.
Their approved master is `assets/comment-filter-icon-v2.png` (AI-generated artwork
with programmatically corrected interior opacity). To re-export PNG sizes, install
Pillow and run `python scripts/export-icons.py`. This is not required for normal builds.

To produce upload archives after building, run:

```sh
python scripts/package-release.py
```

This packaging script requires only the Python standard library. Upload ZIP files
have `manifest.json` at the archive root and contain only the built extension files.
The separate `*-source.zip` is source code for review, not an installable extension.

Generating a package does not submit it to a store or sign the Firefox extension.
