import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const dist = new URL("../dist/", import.meta.url);

await mkdir(new URL("./src", dist), { recursive: true });
await cp(new URL("../src/popup.html", import.meta.url), new URL("./src/popup.html", dist));
await cp(new URL("../src/popup.css", import.meta.url), new URL("./src/popup.css", dist));
await cp(new URL("../icons", import.meta.url), new URL("./icons", dist), { recursive: true });

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
await writeFile(join(root.pathname, "dist", "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
