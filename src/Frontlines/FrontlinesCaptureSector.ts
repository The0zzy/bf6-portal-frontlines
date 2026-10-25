import { neutralTeam } from './FrontlinesConfig.ts';
import { FrontlinesSector } from './FrontlinesSector.ts';

export class FrontlinesCaptureSector extends FrontlinesSector {
    readonly hq: mod.HQ;
    readonly capturePoints: Map<number, mod.CapturePoint>;

    constructor(sector: mod.Sector, id: number, areaTrigger: mod.AreaTrigger, hq: mod.HQ, capturePoints: Map<number, mod.CapturePoint>) {
        super(sector, id, areaTrigger);
        this.hq = hq;
        this.capturePoints = capturePoints;
    }

    override setOwner(team: mod.Team): void {
        super.setOwner(team);
        mod.SetHQTeam(this.hq, team);
        mod.EnableHQ(this.hq, true);
    }

    activate(): void {
        for (const [id, point] of this.capturePoints) {
            mod.EnableGameModeObjective(point, true);
            mod.SetCapturePointOwner(point, neutralTeam());
            console.log("CurrentSector: " + this.letter + " ObjectiveEnabled: " + id);
        }
    }

    deactivate(): void {
        for (const point of this.capturePoints.values()) {
            mod.EnableGameModeObjective(point, false);
        }
    }
}
