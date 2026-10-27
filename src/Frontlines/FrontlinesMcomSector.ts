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

    // The attacker progresses with each destroyed MCOM, the owner holds the remaining share.
    getCaptureProgress(team: mod.Team): number {
        const destroyedShare = this.mcoms.filter(mcom => mcom.destroyed).length / this.mcoms.length;
        if (mod.Equals(team, this.ownerTeam)) {
            return 1 - destroyedShare;
        }
        if (mod.Equals(team, getEnemyTeam(this.ownerTeam))) {
            return destroyedShare;
        }
        return 0;
    }

    getObjectiveCount(): number {
        return this.mcoms.length;
    }

    // MCOMs stay enabled so the native objectives UI keeps its layout; Bomb arm type keeps them unarmable.
    override setOwner(team: mod.Team): void {
        this.ownerTeam = team;
        for (const mcom of this.mcoms) {
            mod.SetMCOMOwner(mcom.mcom, team);
            mod.SetMCOMArmType(mcom.mcom, mod.MCOMArmType.Bomb);
            mod.EnableGameModeObjective(mcom.mcom, true);
        }
    }

    activate(): void {
        for (const mcom of this.mcoms) {
            mod.SetMCOMArmType(mcom.mcom, mod.MCOMArmType.Default);
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
