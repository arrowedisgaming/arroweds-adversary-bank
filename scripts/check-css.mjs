import { readFileSync } from "node:fs";

const filePath = "styles.css";
const css = readFileSync(filePath, "utf8");
const failures = [];

for (const [index, line] of css.split(/\r?\n/).entries()) {
	const lineNumber = index + 1;

	if (/!important\b/.test(line)) {
		failures.push(`${filePath}:${lineNumber}: avoid !important`);
	}

	if (/^\s*text-decoration(?:-[\w-]+)?:/.test(line)) {
		failures.push(`${filePath}:${lineNumber}: avoid text-decoration for Obsidian CSS compatibility`);
	}
}

if (failures.length > 0) {
	console.error(failures.join("\n"));
	process.exitCode = 1;
}
