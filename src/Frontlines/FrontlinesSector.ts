import { FIRST_SECTOR_ID, LETTERS, neutralTeam, sectorMessageKeys } from './FrontlinesConfig.ts';

export abstract class FrontlinesSector {
    readonly sector: mod.Sector;
    readonly id: number;
    readonly areaTrigger: mod.AreaTrigger;
    readonly letter: string;
    readonly labelMessageKey: string;
    readonly conquerMessageKey: string;
    readonly looseMessageKey: string;
    ownerTeam: mod.Team = neutralTeam();

    constructor(sector: mod.Sector, id: number, areaTrigger: mod.AreaTrigger) {
        this.sector = sector;
        this.id = id;
        this.areaTrigger = areaTrigger;
        this.letter = LETTERS[id - FIRST_SECTOR_ID];
        const keys = sectorMessageKeys(this.letter);
        this.labelMessageKey = keys.label;
        this.conquerMessageKey = keys.conquer;
        this.looseMessageKey = keys.loose;
    }

    setOwner(team: mod.Team): void {
        this.ownerTeam = team;
    }

    enableSectorAndArea(enable: boolean): void {
        mod.EnableGameModeObjective(this.sector, enable);
        mod.EnableAreaTrigger(this.areaTrigger, enable);
    }

    getConquerMessage(): mod.Message {
        return mod.Message(this.conquerMessageKey);
    }

    getLooseMessage(): mod.Message {
        return mod.Message(this.looseMessageKey);
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