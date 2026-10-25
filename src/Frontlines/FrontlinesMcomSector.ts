import { FrontlinesMcom } from './FrontlinesMcom.ts';
import { FrontlinesSector } from './FrontlinesSector.ts';

export class FrontlinesMcomSector extends FrontlinesSector {
    readonly mcoms: FrontlinesMcom[];

    constructor(sector: mod.Sector, id: number, areaTrigger: mod.AreaTrigger, owner: mod.Team, mcoms: FrontlinesMcom[]) {
        super(sector, id, areaTrigger);
        this.ownerTeam = owner;
        this.mcoms = mcoms;
    }

    activate(): void {
        for (const mcom of this.mcoms) {
            mod.SetMCOMOwner(mcom.mcom, this.ownerTeam);
            mod.EnableGameModeObjective(mcom.mcom, true);
        }
    }

    deactivate(): void {
        for (const mcom of this.mcoms) {
            mod.EnableGameModeObjective(mcom.mcom, false);
        }
    }
}
