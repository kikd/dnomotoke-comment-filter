import { build } from "esbuild";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
const requested = process.argv[2];
if (requested && !["chromium", "firefox"].includes(requested)) throw Error("Unknown build target");
for (const target of requested ? [requested] : ["chromium", "firefox"]) {
  const out = "dist/" + target;
  await mkdir(out, { recursive: true });
  await build({ entryPoints: { content: "src/content/index.ts", options: "src/options/index.ts", background: "src/background.ts" },
    bundle: true, outdir: out, format: "iife", target: target === "chromium" ? "chrome102" : "firefox140", legalComments: "eof",
    banner: { js: "/*! Includes webextension-polyfill 0.12.0 (Mozilla and contributors), MPL-2.0. Library source: https://github.com/mozilla/webextension-polyfill/tree/0.12.0 . See THIRD_PARTY_NOTICES.txt and LICENSE-webextension-polyfill.txt. */" } });
  const json = async path => JSON.parse(await readFile(path, "utf8"));
  await writeFile(out + "/manifest.json", JSON.stringify({ ...await json("manifests/base.json"), ...await json("manifests/" + target + ".json") }, null, 2));
  await copyFile("src/options/options.html", out + "/options.html");
  for (const file of ["content.css", "options.css"]) await copyFile("styles/" + file, out + "/" + file);
  await mkdir(out + "/icons", { recursive: true });
  for (const size of [16, 32, 48, 64, 96, 128]) {
    const name = "icon-" + size + ".png";
    await copyFile("assets/icons/" + name, out + "/icons/" + name);
  }
  await copyFile("node_modules/webextension-polyfill/LICENSE", out + "/LICENSE-webextension-polyfill.txt");
  await copyFile("THIRD_PARTY_NOTICES.txt", out + "/THIRD_PARTY_NOTICES.txt");
  await copyFile("src/options/licenses.html", out + "/licenses.html");
  await mkdir(out + "/third-party/webextension-polyfill", { recursive: true });
  for (const name of ["browser-polyfill.js", "browser-polyfill.js.map"]) {
    await copyFile("node_modules/webextension-polyfill/dist/" + name, out + "/third-party/webextension-polyfill/" + name);
  }
  await copyFile("node_modules/webextension-polyfill/package.json", out + "/third-party/webextension-polyfill/package.json");
  console.log("Built " + out);
}
