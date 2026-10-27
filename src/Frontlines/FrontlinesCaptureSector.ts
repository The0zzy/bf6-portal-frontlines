import { frontlinesSettings, neutralTeam } from './FrontlinesConfig.ts';
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
        for (const point of this.capturePoints.values()) {
            mod.EnableGameModeObjective(point, true);
            mod.SetCapturePointOwner(point, team);
            mod.EnableCapturePointDeploying(point, true);
            mod.SetCapturePointCapturingTime(point, 9999);
            mod.SetCapturePointNeutralizationTime(point, 9999);
            mod.SetMaxCaptureMultiplier(point, 0.1);
        }
    }

    activate(): void {
        this.ownerTeam = neutralTeam();
        for (const point of this.capturePoints.values()) {
            mod.EnableGameModeObjective(point, true);
            mod.SetCapturePointOwner(point, neutralTeam());
            mod.EnableCapturePointDeploying(point, false);
            mod.SetCapturePointCapturingTime(point, frontlinesSettings.captureTime);
            mod.SetCapturePointNeutralizationTime(point, frontlinesSettings.neutralCaptureNeutralizationTime);
            mod.SetMaxCaptureMultiplier(point, 1);
            mod.SetAllObjectivesUIEnabled(true);
        }
    }

    deactivate(): void {
        for (const point of this.capturePoints.values()) {
            mod.EnableGameModeObjective(point, false);
        }
    }

    isCapturedByTeam(): mod.Team {
        const seenOwner = mod.GetCurrentOwnerTeam(this.capturePoints.values().next().value!);
        for (const point of this.capturePoints.values()) {
            const owner = mod.GetCurrentOwnerTeam(point);
            if (!mod.Equals(seenOwner, owner)) {
                return neutralTeam();
            }
        }
        return seenOwner;
    }

    // Average progress over all capture points the team is currently progressing on.
    getCaptureProgress(team: mod.Team): number {
        let progressSum = 0;
        for (const point of this.capturePoints.values()) {
            if (mod.Equals(mod.GetOwnerProgressTeam(point), team)) {
                progressSum += mod.GetCaptureProgress(point);
            }
        }
        return progressSum / this.capturePoints.size;
    }

    getObjectiveCount(): number {
        return this.capturePoints.size;
    }
}
