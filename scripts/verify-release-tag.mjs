import { readFileSync } from "node:fs";

const tag = process.env.TAG;
if (!tag) {
	console.error("TAG env var is required");
	process.exit(1);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
if (tag !== manifest.version) {
	console.error(`Tag ${tag} does not match manifest version ${manifest.version}`);
	process.exit(1);
}

console.log(`Tag ${tag} matches manifest version ${manifest.version}`);
