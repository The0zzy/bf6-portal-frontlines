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

export const RED = [0.89, 0.447, 0.333] as const;
export const BLUE = [0.447, 0.796, 0.922] as const;

export type Color = typeof RED | typeof BLUE;

export const REDVEC = mod.CreateVector(0.659, 0.329, 0.247);
export const BLUEVEC = mod.CreateVector(0.373, 0.608, 0.729);
