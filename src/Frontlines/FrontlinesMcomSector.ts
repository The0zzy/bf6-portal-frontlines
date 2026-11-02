import { neutralTeam, getEnemyTeam } from './FrontlinesConfig.ts';
import { FrontlinesMcom } from './FrontlinesMcom.ts';
import { FrontlinesSector } from './FrontlinesSector.ts';

export class FrontlinesMcomSector extends FrontlinesSector {
    readonly mcoms: FrontlinesMcom[];

    constructor(sector: mod.Sector, id: number, areaTrigger: mod.AreaTrigger, hq: mod.HQ, owner: mod.Team, mcoms: FrontlinesMcom[]) {
        super(sector, id, areaTrigger, hq);
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
        return this.mcoms.filter(mcom => !mcom.destroyed).length;
    }

    // Owned MCOMs are fully disabled; activate() re-enables them when the sector becomes current.
    override setOwner(team: mod.Team): void {
        super.setOwner(team);
        for (const mcom of this.mcoms) {
            mod.SetMCOMOwner(mcom.mcom, team);
            // mod.SetMCOMArmType(mcom.mcom, mod.MCOMArmType.Bomb);
            mod.EnableGameModeObjective(mcom.mcom, false);
        }
    }

    // The owner stays the defender while contested; only its HQ is closed.
    activate(): void {
        mod.EnableHQ(this.hq, false);
        for (const mcom of this.mcoms) {
            mod.SetMCOMArmType(mcom.mcom, mod.MCOMArmType.Default);
            mod.EnableGameModeObjective(mcom.mcom, true);
        }
    }

    destroyMcom(mcomId: number): void {
        const mcom = this.mcoms.find(m => mod.GetObjId(m.mcom) === mcomId);
        if (mcom) {
            mcom.destroyMCOM();
        } else {
            console.log(`ERROR: destroyMcom() - MCOM with ID ${mcomId} not found in this sector!`);
        }
    }
}
