import { FIRST_SECTOR_ID, LETTERS, neutralTeam } from './FrontlinesConfig.ts';

export abstract class FrontlinesSector {
    readonly sector: mod.Sector;
    readonly id: number;
    readonly areaTrigger: mod.AreaTrigger;
    readonly letter: string;
    ownerTeam: mod.Team = neutralTeam();

    constructor(sector: mod.Sector, id: number, areaTrigger: mod.AreaTrigger) {
        this.sector = sector;
        this.id = id;
        this.areaTrigger = areaTrigger;
        this.letter = LETTERS[id - FIRST_SECTOR_ID];
    }

    setOwner(team: mod.Team): void {
        this.ownerTeam = team;
    }

    enableSectorAndArea(enable: boolean): void {
        mod.EnableGameModeObjective(this.sector, enable);
        mod.EnableAreaTrigger(this.areaTrigger, enable);
    }

    getLabel(): mod.Message {
        switch (this.letter) {
            case "B":
                return mod.Message(mod.stringkeys.frontlines.b);
            case "C":
                return mod.Message(mod.stringkeys.frontlines.c);
            case "D":
                return mod.Message(mod.stringkeys.frontlines.d);
            case "E":
                return mod.Message(mod.stringkeys.frontlines.e);
            case "F":
                return mod.Message(mod.stringkeys.frontlines.f);
            case "G":
                return mod.Message(mod.stringkeys.frontlines.g);
            case "H":
                return mod.Message(mod.stringkeys.frontlines.h);
            case "I":
                return mod.Message(mod.stringkeys.frontlines.i);
            default:
                return mod.Message(mod.stringkeys.frontlines.a);
        }
    }

    getConquerMessage(): mod.Message {
        switch (this.letter) {
            case "B":
                return mod.Message(mod.stringkeys.frontlines.conquerSectorBMSG);
            case "C":
                return mod.Message(mod.stringkeys.frontlines.conquerSectorCMSG);
            case "D":
                return mod.Message(mod.stringkeys.frontlines.conquerSectorDMSG);
            case "E":
                return mod.Message(mod.stringkeys.frontlines.conquerSectorEMSG);
            case "F":
                return mod.Message(mod.stringkeys.frontlines.conquerSectorFMSG);
            case "G":
                return mod.Message(mod.stringkeys.frontlines.conquerSectorGMSG);
            case "H":
                return mod.Message(mod.stringkeys.frontlines.conquerSectorHMSG);
            case "I":
                return mod.Message(mod.stringkeys.frontlines.conquerSectorIMSG);
            default:
                return mod.Message(mod.stringkeys.frontlines.conquerSectorAMSG);
        }
    }

    getLooseMessage(): mod.Message {
        switch (this.letter) {
            case "B":
                return mod.Message(mod.stringkeys.frontlines.looseSectorBMSG);
            case "C":
                return mod.Message(mod.stringkeys.frontlines.looseSectorCMSG);
            case "D":
                return mod.Message(mod.stringkeys.frontlines.looseSectorDMSG);
            case "E":
                return mod.Message(mod.stringkeys.frontlines.looseSectorEMSG);
            case "F":
                return mod.Message(mod.stringkeys.frontlines.looseSectorFMSG);
            case "G":
                return mod.Message(mod.stringkeys.frontlines.looseSectorGMSG);
            case "H":
                return mod.Message(mod.stringkeys.frontlines.looseSectorHMSG);
            case "I":
                return mod.Message(mod.stringkeys.frontlines.looseSectorIMSG);
            default:
                return mod.Message(mod.stringkeys.frontlines.looseSectorAMSG);
        }
    }

    /**
     * Sets this sector as the current one to be captured.
     */
    abstract activate(): void;

    /**
     * Deactivates this sector, disabling it for the whole game mode (shouldn't be needed).
     */
    abstract deactivate(): void;

    /**
     * Returns whether this sector has been fully captured by a team. 
     * Returns the team owning all capture points, or the neutral team if it hasn't been fully captured.
     */
    abstract isCapturedByTeam(): mod.Team;

    /**
     * Returns the capture progress (0-1) of the given team on this sector.
     */
    abstract getCaptureProgress(team: mod.Team): number;
}