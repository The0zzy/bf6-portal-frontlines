import { FIRST_SECTOR_ID, LETTERS } from './FrontlinesConfig.ts';

export class FrontlinesSector {
    readonly sector: mod.Sector;
    readonly id: number;
    readonly letter: string;
    readonly areaTrigger: mod.AreaTrigger;
    readonly hq: mod.HQ;
    readonly capturePoints: Map<number, mod.CapturePoint>;
    ownerTeam: mod.Team | undefined = undefined;

    constructor(sector: mod.Sector, id: number, areaTrigger: mod.AreaTrigger, hq: mod.HQ, capturePoints: Map<number, mod.CapturePoint>) {
        this.sector = sector;
        this.id = id;
        this.letter = LETTERS[id - FIRST_SECTOR_ID];
        this.areaTrigger = areaTrigger;
        this.hq = hq;
        this.capturePoints = capturePoints;
    }
}