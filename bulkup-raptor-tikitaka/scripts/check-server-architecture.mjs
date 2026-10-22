import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiRoot = path.join(root, "src", "app", "api");
const forbiddenRouteImports = /(?:@\/server\/database|@\/db\/schema|drizzle-orm)/;
const failures = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

for (const file of walk(apiRoot).filter((file) => file.endsWith("route.ts"))) {
  const source = fs.readFileSync(file, "utf8");
  if (forbiddenRouteImports.test(source) && file.includes("hospital-playbook")) {
    failures.push(`${path.relative(root, file)} imports persistence code directly`);
  }
}

const llmService = fs.readFileSync(path.join(root, "src", "server", "llm-playbook.ts"), "utf8");
if (/(?:@\/server\/database|drizzle-orm|\bdb\.)/.test(llmService)) {
  failures.push("src/server/llm-playbook.ts accesses persistence directly");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Server architecture checks passed.");
}
