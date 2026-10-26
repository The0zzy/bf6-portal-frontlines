import { neutralTeam, getEnemyTeam } from './FrontlinesConfig.ts';
import { FrontlinesMcom } from './FrontlinesMcom.ts';
import { FrontlinesSector } from './FrontlinesSector.ts';

export class FrontlinesMcomSector extends FrontlinesSector {
    readonly mcoms: FrontlinesMcom[];

    constructor(sector: mod.Sector, id: number, areaTrigger: mod.AreaTrigger, owner: mod.Team, mcoms: FrontlinesMcom[]) {
        super(sector, id, areaTrigger);
        this.ownerTeam = owner;
        this.mcoms = mcoms;
    }

    isCapturedByTeam(): mod.Team {
        for (const mcom of this.mcoms) {
            if (!mcom.destroyed) {
                return neutralTeam();
            }
        }
        return getEnemyTeam(this.ownerTeam);
    }

    override setOwner(team: mod.Team): void {
        this.ownerTeam = team;
        for (const mcom of this.mcoms) {
            mod.SetMCOMOwner(mcom.mcom, team);
            mod.EnableGameModeObjective(mcom.mcom, false);
        }
    }

    activate(): void {
        for (const mcom of this.mcoms) {
            mod.EnableGameModeObjective(mcom.mcom, true);
        }
    }

    deactivate(): void {
        for (const mcom of this.mcoms) {
            mod.EnableGameModeObjective(mcom.mcom, false);
        }
    }

    destroyMcom(mcomId: number): void {
        const mcom = this.mcoms.find(m => mod.GetObjId(m.mcom) === mcomId);
        if (mcom) {
            mcom.destroyMCOM();
        }else{
            console.log(`ERROR: destroyMcom() - MCOM with ID ${mcomId} not found in this sector!`);
        }
    }
}
