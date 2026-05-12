import js from "@eslint/js";
import globals from "globals";
import obsidianmd from "eslint-plugin-obsidianmd";
import { DEFAULT_ACRONYMS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/acronyms.js";
import { DEFAULT_BRANDS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			"main.js",
			"node_modules/**",
			"beastvault-old/**",
			"obsidian-releases/**",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	...obsidianmd.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/no-misused-promises": [
				"error",
				{ checksVoidReturn: false },
			],
			"obsidianmd/no-static-styles-assignment": "off",
			"obsidianmd/ui/sentence-case": [
				"error",
				{
					acronyms: [...DEFAULT_ACRONYMS, "SRD", "FSB"],
					brands: [...DEFAULT_BRANDS, "Fantasy Statblocks", "Arrowed's Adversary Bank"],
				},
			],
		},
	},
);
