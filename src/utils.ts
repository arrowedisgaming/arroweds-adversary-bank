import type { Adversary, RawAdversary } from './ui';
import { TFile, TFolder, parseYaml, Notice } from "obsidian";
import ADV_LIBRARY_DATA from '../data/adversaries.json';
import ENV_LIBRARY_DATA from '../data/environments.json';

type UnknownRecord = Record<string, unknown>;
type RawFeature = NonNullable<RawAdversary['features']>[number];

export function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

function asStringOrNumber(value: unknown): string | number | undefined {
    return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function asStringOrStringArray(value: unknown): string | string[] | undefined {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value;
    return undefined;
}

function asThresholds(value: unknown): string | number | number[] | undefined {
    if (typeof value === 'string' || typeof value === 'number') return value;
    if (Array.isArray(value) && value.every(item => typeof item === 'number')) return value;
    return undefined;
}

function asFeature(value: unknown): RawFeature | null {
    if (!isRecord(value)) return null;
    const feature: RawFeature = {};
    feature.name = asString(value.name);
    feature.type = asString(value.type);
    feature.desc = asString(value.desc) ?? asString(value.text);
    feature.uses = asNumber(value.uses);
    feature.countdown = asNumber(value.countdown);
    feature.flavor = asString(value.flavor);
    feature.summon = asStringOrStringArray(value.summon);
    return feature;
}

function asFeatures(value: unknown): RawFeature[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.map(asFeature).filter((feature): feature is RawFeature => feature !== null);
}

export function toRawAdversary(value: unknown): RawAdversary | null {
    if (!isRecord(value) || typeof value.name !== 'string') return null;

    return {
        name: value.name,
        tier: asNumber(value.tier),
        type: asString(value.type),
        desc: asString(value.desc) ?? asString(value.description),
        difficulty: asStringOrNumber(value.difficulty),
        features: asFeatures(value.features),

        tone: asString(value.tone),
        impulses: asString(value.impulses),
        adversaries: asString(value.adversaries),

        hp: asNumber(value.hp),
        stress: asNumber(value.stress),
        thresholds: asThresholds(value.thresholds),
        attack: asStringOrNumber(value.attack),
        xp: asStringOrStringArray(value.xp),
        motives: asString(value.motives),

        weapon: asString(value.weapon),
        range: asString(value.range),
        damage: asString(value.damage),

        conditions: asStringOrStringArray(value.conditions),
        source: asString(value.source),
        id: asString(value.id),
        raw: asString(value.raw),
    };
}

export function toRawAdversaries(value: unknown): RawAdversary[] {
    const entries = Array.isArray(value) ? value : [value];
    return entries
        .map(toRawAdversary)
        .filter((entry): entry is RawAdversary => entry !== null);
}

export const ADV_LIBRARY: RawAdversary[] = toRawAdversaries(ADV_LIBRARY_DATA);
export const ENV_LIBRARY: RawAdversary[] = toRawAdversaries(ENV_LIBRARY_DATA);

export const ADV_TEMPLATE = `\`\`\`daggerheart
name:
tier:
type:
desc:
difficulty:

attack:
thresholds:
hp:
stress:
xp:
motives:

weapon:
range:
damage:

features:
- name:
  type:
  desc:
\`\`\`
`

export const ENV_TEMPLATE = `\`\`\`daggerheart
name:
tier:
type:
desc:
difficulty:

tone:
impulses:
adversaries:

features:
- name:
  type:
  desc:
  flavor:
\`\`\`
`

export const DICE_PATTERN = /(\b\d+d\d+(?:\+\d+d\d+)*(?:\+\d+)?\b)/g;

export const DH_CONDITIONS = [
    'Vulnerable',
    'Restrained',
    'Frightened',
    'Disoriented',
    'Weakened',
    'Hidden',
    'Empowered',
    'Slowed',
] as const;

export type Condition = typeof DH_CONDITIONS[number];

export function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function autoSuffixName(baseName: string, editorContent: string): string {
    const pattern = new RegExp(`^name:\\s*${escapeRegex(baseName)}(?:\\s+(\\d+))?\\s*$`, 'gmi');
    let maxSuffix = 0;
    let match;
    while ((match = pattern.exec(editorContent)) !== null) {
        const suffix = match[1] ? parseInt(match[1]) : 1;
        maxSuffix = Math.max(maxSuffix, suffix);
    }
    if (maxSuffix > 0) {
        return `${baseName} ${maxSuffix + 1}`;
    }
    return baseName;
}

export function hexToRgb(hex: string) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    const num = parseInt(hex, 16);
    const rgb = [num >> 16, (num >> 8) & 255, num & 255];
    return `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
}

export function processAdversary(obj: RawAdversary, filePath: string): Adversary {
    if (typeof obj.attack === 'number') {
        obj.attack = obj.attack > 0 ? `+${obj.attack}` : `${obj.attack}`;
    }
    if (typeof obj.thresholds === "string") {
        obj.thresholds = obj.thresholds.split(/[,/]/)
            .filter((s: string) => s.trim().toLowerCase() != 'none')
            .map((s: string) => parseInt(s));
    }
    if (typeof obj.thresholds === "number") {
        obj.thresholds = [obj.thresholds];
    }
    if (typeof obj.xp === "string") {
        obj.xp = obj.xp.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    }
    if (typeof obj.difficulty === "number") {
        obj.difficulty = obj.difficulty.toString();
    }

    obj.id ??= `${filePath}::${obj.name || ''}`;
    obj.hp ??= 0;
    obj.stress ??= 0;
    obj.xp ??= [];
    obj.thresholds ??= [];
    obj.features ??= [];

    return {
        name: obj.name,
        tier: obj.tier,
        type: obj.type,
        desc: obj.desc,
        difficulty: obj.difficulty,
        features: obj.features,

        tone: obj.tone,
        impulses: obj.impulses,
        adversaries: obj.adversaries,

        hp: obj.hp,
        stress: obj.stress,
        thresholds: obj.thresholds,
        attack: obj.attack,
        xp: obj.xp,
        motives: obj.motives,

        weapon: obj.weapon,
        range: obj.range,
        damage: obj.damage,

        id: obj.id,
    };
}

export async function walkFolder(folder: TFolder, callback: (file: TFile) => Promise<void>) {
    for (const child of folder.children) {
        if (child instanceof TFile) {
            await callback(child);
        } else if (child instanceof TFolder) {
            await walkFolder(child, callback); // recurse
        }
    }
}

export function tryParseYaml(source: string, silent: boolean = true): unknown {
    try {
        const parsed: unknown = parseYaml(source) ?? {};
        // Arrays and objects are fine
        return typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        console.error(e);
        if (!silent) new Notice(String(e), 10000);
        return {};
    }
}
