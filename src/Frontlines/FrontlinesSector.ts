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

    getConquerMessage(): mod.Message {
        switch (this.letter) {
            case "B":
                return mod.Message(mod.stringkeys.conquerSectorBMSG);
            case "C":
                return mod.Message(mod.stringkeys.conquerSectorCMSG);
            case "D":
                return mod.Message(mod.stringkeys.conquerSectorDMSG);
            case "E":
                return mod.Message(mod.stringkeys.conquerSectorEMSG);
            case "F":
                return mod.Message(mod.stringkeys.conquerSectorFMSG);
            case "G":
                return mod.Message(mod.stringkeys.conquerSectorGMSG);
            default:
                return mod.Message(mod.stringkeys.conquerSectorAMSG);
        }
    }

    getLooseMessage(): mod.Message {
        switch (this.letter) {
            case "B":
                return mod.Message(mod.stringkeys.looseSectorBMSG);
            case "C":
                return mod.Message(mod.stringkeys.looseSectorCMSG);
            case "D":
                return mod.Message(mod.stringkeys.looseSectorDMSG);
            case "E":
                return mod.Message(mod.stringkeys.looseSectorEMSG);
            case "F":
                return mod.Message(mod.stringkeys.looseSectorFMSG);
            case "G":
                return mod.Message(mod.stringkeys.looseSectorGMSG);
            default:
                return mod.Message(mod.stringkeys.looseSectorAMSG);
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
}