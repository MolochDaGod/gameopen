import fs from "fs";
import path from "path";

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory() && e.name !== "node_modules") walk(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const root = path.resolve("src");
const files = walk(root);
const missing = new Set();
const re = /from\s+['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g;

for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(t))) {
    const rel = m[1] || m[2];
    if (!rel) continue;
    if (rel.includes("?") || /\.(css|json|glsl|wasm|png|jpg|svg|glb|mp3|ogg)$/i.test(rel)) continue;
    const base = path.resolve(path.dirname(f), rel);
    const candidates = [
      base,
      base + ".ts",
      base + ".tsx",
      base + ".js",
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
    ];
    if (!candidates.some((c) => fs.existsSync(c))) {
      missing.add(`${rel}  <-  ${path.relative(root, f).replace(/\\/g, "/")}`);
    }
  }
}

console.log([...missing].sort().join("\n") || "NONE");
