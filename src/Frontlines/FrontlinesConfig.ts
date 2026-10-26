/***********************************************************************************
***************************** Frontlines Config ************************************
***********************************************************************************/

export interface FrontlineSettings {
    timeLimit: number,
    captureTime: number,
    captureNeutralizationTime: number,
    mCOMFuseTime: number,
    maxUnitsRemaining: number,
    redeployTime: number,
    sectorTimer: number,
    daytime: number,
    nighttime: number
}

export const frontlinesSettings: FrontlineSettings = {
    timeLimit: 60, //minutes
    captureTime: 40, //seconds
    captureNeutralizationTime: 30, //seconds
    mCOMFuseTime: 40, //seconds
    maxUnitsRemaining: 100,
    redeployTime: 15, //seconds
    sectorTimer: 30, //seconds
    daytime: 14, //minutes
    nighttime: 10, //minutes
};

// ID scheme, see levels/MAP_REQUIREMENTS.md
export const FIRST_SECTOR_ID = 201;
export const LAST_SECTOR_ID = 209;
export const MIN_SECTORS = 5;
export const MAX_SECTORS = 7;
export const MAX_CHILDREN_PER_SECTOR = 8;
export const FIXED_HQ_TEAM1_ID = 100;
export const FIXED_HQ_TEAM2_ID = 150;
export const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

// Neutral owner of capture points and sectors. Team 3 is a workaround until the in-game team 0 bug is fixed; then return mod.GetTeam(0).
export function neutralTeam(): mod.Team {
    return mod.GetTeam(3);
}

export function getEnemyTeam(team: mod.Team): mod.Team {
    if (mod.Equals(team, mod.GetTeam(1))) {
        return mod.GetTeam(2);
    } else if (mod.Equals(team, mod.GetTeam(2))) {
        return mod.GetTeam(1);
    }
    throw new Error("GetEnemyTeam: Invalid team provided (" + mod.GetObjId(team) + ")");
}

export function sectorAreaTriggerId(sectorId: number): number {
    return sectorId + 10;
}

export function sectorHqId(sectorId: number): number {
    return sectorId + 20;
}

export function hqAreaTriggerId(hqId: number): number {
    return hqId + 1;
}

// capture points and MCOMs share the block 400-497
export function childBaseId(sectorId: number): number {
    return 400 + (sectorId - 200) * 10;
}

export function vehicleSpawnerBaseId(sectorId: number): number {
    return 300 + (sectorId - 200) * 10;
}
