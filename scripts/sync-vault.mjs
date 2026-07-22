import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, watch } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import process from "process";

/** Files Obsidian actually loads. Everything else in the repo stays out of the vault. */
export const ARTIFACTS = ["main.js", "manifest.json", "styles.css"];

/** Artifacts esbuild does not rebuild, so they need their own watcher. */
export const STATIC_ARTIFACTS = ["manifest.json", "styles.css"];

const CONFIG_FILE = ".dev-vault";

function expandHome(path) {
	return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

/**
 * Where to mirror build output, from `$OBSIDIAN_PLUGIN_DIR` or the gitignored
 * `.dev-vault` file (one path per line, `#` comments allowed, first wins).
 * Returns null when no dev vault is configured — syncing is opt-in, so CI and
 * fresh clones build normally without one.
 */
export function resolveTarget() {
	const fromEnv = process.env.OBSIDIAN_PLUGIN_DIR?.trim();
	if (fromEnv) return { dir: resolve(expandHome(fromEnv)), origin: "$OBSIDIAN_PLUGIN_DIR" };

	if (existsSync(CONFIG_FILE)) {
		const line = readFileSync(CONFIG_FILE, "utf8")
			.split(/\r?\n/)
			.map((l) => l.trim())
			.find((l) => l && !l.startsWith("#"));
		if (line) return { dir: resolve(expandHome(line)), origin: CONFIG_FILE };
	}

	return null;
}

/**
 * Refuse to write anywhere that isn't this plugin's folder inside an Obsidian
 * vault. A typo in `.dev-vault` should fail loudly, not scatter `main.js` into
 * someone's notes.
 */
function validateTarget(dir, origin) {
	const id = JSON.parse(readFileSync("manifest.json", "utf8")).id;

	if (basename(dir) !== id) {
		throw new Error(`${origin}: expected the folder to be named "${id}", got "${basename(dir)}" (${dir})`);
	}
	if (basename(dirname(dir)) !== "plugins" || basename(dirname(dirname(dir))) !== ".obsidian") {
		throw new Error(`${origin}: expected a path ending in .obsidian/plugins/${id}, got ${dir}`);
	}
	if (!existsSync(dirname(dir))) {
		throw new Error(`${origin}: ${dirname(dir)} does not exist — is the vault path right?`);
	}
	if (existsSync(dir) && !statSync(dir).isDirectory()) {
		throw new Error(`${origin}: ${dir} exists but is not a directory`);
	}
}

/**
 * Copy the built artifacts into the dev vault. No-op (returns false) when no
 * dev vault is configured.
 */
export function syncToVault({ quiet = false } = {}) {
	const target = resolveTarget();
	if (!target) return false;

	validateTarget(target.dir, target.origin);
	mkdirSync(target.dir, { recursive: true });

	const copied = [];
	for (const file of ARTIFACTS) {
		if (!existsSync(file)) continue;
		copyFileSync(file, join(target.dir, file));
		copied.push(file);
	}

	if (!quiet) {
		const stamp = new Date().toLocaleTimeString();
		console.log(`[${stamp}] synced ${copied.join(", ")} -> ${target.dir}`);
	}
	return true;
}

/**
 * Watch the artifacts esbuild doesn't own (manifest.json, styles.css) and
 * re-sync on change.
 *
 * Watches the containing directory rather than the files themselves. `fs.watch`
 * on a path binds to that file's inode, and most editors save atomically by
 * writing a temp file and renaming it over the original — which swaps the inode
 * and leaves the watch attached to a file nothing writes to again. A directory
 * watch survives that. Events are debounced because one save emits several.
 */
export function watchStaticArtifacts() {
	let timer = null;
	const schedule = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			try {
				syncToVault();
			} catch (error) {
				console.error(`sync failed: ${error.message}`);
			}
		}, 100);
	};

	// `filename` is documented as possibly null; sync rather than risk missing a save.
	watch(".", (_event, filename) => {
		if (!filename || STATIC_ARTIFACTS.includes(basename(filename))) schedule();
	});
}
