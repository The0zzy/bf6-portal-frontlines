import { FIRST_SECTOR_ID, LETTERS } from './FrontlinesConfig.ts';

export class FrontlinesSector {
    readonly sector: mod.Sector;
    readonly id: number;
    readonly letter: string;
    readonly areaId: number;
    readonly hqId: number;
    readonly capturePoints: Map<number, mod.CapturePoint>;
    ownerTeam: mod.Team | undefined = undefined;

    constructor(sector: mod.Sector, id: number, capturePoints: Map<number, mod.CapturePoint>) {
        this.sector = sector;
        this.id = id;
        this.letter = LETTERS[id - FIRST_SECTOR_ID];
        this.areaId = id + 200;
        this.hqId = id + 300;
        this.capturePoints = capturePoints;
    }
}