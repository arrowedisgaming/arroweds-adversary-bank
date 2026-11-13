import type { RawAdversary } from './ui';

/**
 * Quick stats for improvising an adversary from just a tier and a role.
 *
 * The numbers follow the Daggerheart Homebrew Kit's adversary guidance (attack
 * modifier relative to the tier default, one damage die per tier, die size by
 * role, Hit Point bands) and are tuned to the typical values of the published
 * SRD adversaries of each tier and role. Cells with only one or two published
 * examples are smoothed from the same role at neighbouring tiers.
 */

export const IMPROVISED_TIERS = [1, 2, 3, 4] as const;
export type ImprovisedTier = typeof IMPROVISED_TIERS[number];

export const IMPROVISED_ROLES = [
    'Bruiser', 'Horde', 'Leader', 'Minion', 'Ranged',
    'Skulk', 'Social', 'Solo', 'Standard', 'Support',
] as const;
export type ImprovisedRole = typeof IMPROVISED_ROLES[number];

export const TIER_LEVELS: Record<ImprovisedTier, string> = {
    1: 'Level 1',
    2: 'Levels 2–4',
    3: 'Levels 5–7',
    4: 'Levels 8–10',
};

export const ROLE_SUMMARY: Record<ImprovisedRole, string> = {
    Bruiser: 'Tough, with powerful attacks',
    Horde: 'A group of creatures acting as one',
    Leader: 'Commands or summons other adversaries',
    Minion: 'Easily dispatched, dangerous in numbers',
    Ranged: 'High damage from afar, fragile up close',
    Skulk: 'Mobile ambusher',
    Social: 'A challenge in conversation, not combat',
    Solo: 'A formidable challenge for the whole party',
    Standard: 'Rank and file',
    Support: 'Enhances allies or disrupts the party',
};

export type ImprovisedStats = {
    difficulty: number;
    /** Major/severe thresholds; absent for Minions. */
    thresholds?: [number, number];
    hp: number;
    stress: number;
    attack: number;
    /** Dice notation, or a flat number for Minions. */
    damage: string;
    /** Minion (X) value, or the Horde's halved damage. */
    extra?: string;
};

type Row = [difficulty: number, major: number, severe: number, hp: number, stress: number, attack: number, damage: string, extra?: string];

const STATS: Record<ImprovisedTier, Record<ImprovisedRole, Row>> = {
    1: {
        Bruiser: [13, 8, 15, 6, 3, 1, '1d12+2'],
        Horde: [10, 5, 10, 6, 3, -1, '1d8+2', '1d4+1'],
        Leader: [14, 7, 14, 6, 3, 3, '1d10+3'],
        Minion: [10, 0, 0, 1, 1, -2, '2', '4'],
        Ranged: [10, 4, 7, 3, 2, 1, '1d8+3'],
        Skulk: [12, 5, 9, 3, 3, 1, '1d6+2'],
        Social: [13, 5, 9, 3, 4, -3, '1d4+2'],
        Solo: [13, 8, 15, 8, 3, 3, '1d12+4'],
        Standard: [12, 5, 10, 4, 3, 1, '1d8+1'],
        Support: [12, 5, 9, 4, 4, 1, '1d6+2'],
    },
    2: {
        Bruiser: [15, 14, 28, 7, 4, 2, '2d10+3'],
        Horde: [14, 10, 20, 5, 3, 0, '2d8+2', '2d4+1'],
        Leader: [16, 12, 25, 6, 4, 3, '2d10+2'],
        Minion: [13, 0, 0, 1, 1, 0, '5', '6'],
        Ranged: [14, 9, 18, 5, 4, 3, '2d8+4'],
        Skulk: [14, 9, 18, 4, 4, 2, '2d6+3'],
        Social: [14, 8, 16, 4, 3, -2, '2d4+1'],
        Solo: [15, 13, 26, 8, 5, 3, '2d10+4'],
        Standard: [14, 9, 18, 4, 3, 2, '2d8+2'],
        Support: [14, 9, 18, 4, 5, 2, '2d6+2'],
    },
    3: {
        Bruiser: [17, 22, 40, 7, 4, 3, '3d10+1'],
        Horde: [16, 16, 31, 7, 4, 1, '3d8+4', '2d6+2'],
        Leader: [17, 22, 40, 6, 5, 5, '3d10+3'],
        Minion: [15, 0, 0, 1, 1, 1, '8', '9'],
        Ranged: [17, 19, 30, 6, 5, 4, '3d10+3'],
        Skulk: [15, 16, 30, 6, 4, 3, '3d8+2'],
        Social: [16, 18, 32, 5, 5, 1, '3d6+5'],
        Solo: [18, 20, 35, 10, 6, 5, '3d12+5'],
        Standard: [16, 18, 35, 6, 4, 3, '3d8+4'],
        Support: [16, 18, 33, 5, 5, 3, '3d6+4'],
    },
    4: {
        Bruiser: [20, 40, 70, 8, 5, 4, '4d12+10'],
        Horde: [17, 25, 45, 8, 5, 2, '4d8+6', '2d6+5'],
        Leader: [20, 37, 70, 7, 7, 7, '4d10+10'],
        Minion: [18, 0, 0, 1, 1, 3, '11', '12'],
        Ranged: [19, 25, 45, 5, 5, 5, '4d8+8'],
        Skulk: [18, 28, 50, 6, 5, 5, '4d8+8'],
        Social: [18, 26, 42, 5, 5, 3, '4d6+8'],
        Solo: [20, 35, 68, 11, 8, 8, '4d12+6'],
        Standard: [18, 30, 48, 6, 4, 4, '4d8+8'],
        Support: [19, 26, 45, 5, 4, 5, '4d6+10'],
    },
};

const RANGE: Record<ImprovisedRole, string> = {
    Bruiser: 'Very Close',
    Horde: 'Melee',
    Leader: 'Melee',
    Minion: 'Melee',
    Ranged: 'Far',
    Skulk: 'Melee',
    Social: 'Melee',
    Solo: 'Very Close',
    Standard: 'Melee',
    Support: 'Far',
};

/** How many Horde members each Hit Point represents. */
const HORDE_SIZE = 3;

export function improvisedStats(tier: ImprovisedTier, role: ImprovisedRole): ImprovisedStats {
    const [difficulty, major, severe, hp, stress, attack, damage, extra] = STATS[tier][role];
    return {
        difficulty,
        thresholds: role === 'Minion' ? undefined : [major, severe],
        hp,
        stress,
        attack,
        damage,
        extra,
    };
}

export function formatModifier(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
}

/** One-line stat preview shown in the role picker. */
export function improvisedSummary(tier: ImprovisedTier, role: ImprovisedRole): string {
    const stats = improvisedStats(tier, role);
    return [
        `Difficulty ${stats.difficulty}`,
        stats.thresholds ? stats.thresholds.join('/') : 'No thresholds',
        `${stats.hp} HP`,
        `${stats.stress} Stress`,
        `ATK ${formatModifier(stats.attack)}`,
        stats.damage,
    ].join(' · ');
}

function signatureFeatures(role: ImprovisedRole, stats: ImprovisedStats): NonNullable<RawAdversary['features']> {
    switch (role) {
        case 'Minion':
            return [
                {
                    name: `Minion (${stats.extra})`,
                    type: 'Passive',
                    desc: `This Minion is defeated when they take any damage. For every ${stats.extra} damage a PC deals to this Minion, defeat an additional Minion within range the attack would succeed against.`,
                },
                {
                    name: 'Group Attack',
                    type: 'Action',
                    desc: `Spend a Fear to choose a target and spotlight all of these Minions within Close range of them. Those Minions move into Melee range of the target and make one shared attack roll. On a success, they deal ${stats.damage} physical damage each. Combine this damage.`,
                },
            ];
        case 'Horde':
            return [{
                name: `Horde (${stats.extra})`,
                type: 'Passive',
                desc: `When the Horde has marked half or more of their HP, their standard attack deals ${stats.extra} physical damage instead.`,
            }];
        case 'Solo':
            return [{
                name: 'Relentless (3)',
                type: 'Passive',
                desc: 'This adversary can be spotlighted up to three times per GM turn. Spend Fear as usual to spotlight them.',
            }];
        case 'Bruiser':
        case 'Leader':
            return [{
                name: 'Momentum',
                type: 'Reaction',
                desc: 'When this adversary makes a successful attack against a PC, you gain a Fear.',
            }];
        default:
            return [];
    }
}

/** A complete, runnable stat block for an improvised adversary. */
export function buildImprovisedAdversary(tier: ImprovisedTier, role: ImprovisedRole): RawAdversary {
    const stats = improvisedStats(tier, role);
    const features = signatureFeatures(role, stats);

    const adversary: RawAdversary = {
        name: `IMPROVISED ${role.toUpperCase()}`,
        tier,
        type: role === 'Horde' ? `Horde (${HORDE_SIZE}/HP)` : role,
        desc: '',
        difficulty: stats.difficulty,
        motives: '',
        hp: stats.hp,
        stress: stats.stress,
        attack: stats.attack,
        weapon: 'Attack',
        range: RANGE[role],
        damage: `${stats.damage} phy`,
    };
    if (stats.thresholds) adversary.thresholds = stats.thresholds.join('/');
    adversary.xp = '';
    if (features.length > 0) adversary.features = features;
    return adversary;
}
