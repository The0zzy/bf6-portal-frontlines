import { neutralTeam } from './FrontlinesConfig.ts';

export abstract class FrontlinesSector {
    readonly sector: mod.Sector;
    readonly id: number;
    readonly areaTrigger: mod.AreaTrigger;
    ownerTeam: mod.Team = neutralTeam();

    constructor(sector: mod.Sector, id: number, areaTrigger: mod.AreaTrigger) {
        this.sector = sector;
        this.id = id;
        this.areaTrigger = areaTrigger;
    }

    setOwner(team: mod.Team): void {
        this.ownerTeam = team;
    }

    enableSectorAndArea(): void {
        mod.EnableGameModeObjective(this.sector, true);
        mod.EnableAreaTrigger(this.areaTrigger, true);
    }

    abstract activate(): void;
    abstract deactivate(): void;
    abstract isCaptured(): boolean;
}