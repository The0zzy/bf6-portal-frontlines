import { frontlinesSettings, neutralTeam } from './FrontlinesConfig.ts';
import { FrontlinesSector } from './FrontlinesSector.ts';

export class FrontlinesCaptureSector extends FrontlinesSector {
    readonly capturePoints: Map<number, mod.CapturePoint>;
    private lockEndTime: number = 0;

    constructor(sector: mod.Sector, id: number, areaTrigger: mod.AreaTrigger, hq: mod.HQ, capturePoints: Map<number, mod.CapturePoint>) {
        super(sector, id, areaTrigger, hq);
        this.capturePoints = capturePoints;
    }

    override setOwner(team: mod.Team): void {
        super.setOwner(team);
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
        mod.EnableHQ(this.hq, false);
        for (const point of this.capturePoints.values()) {
            mod.EnableGameModeObjective(point, true);
            mod.SetCapturePointOwner(point, neutralTeam());
            mod.EnableCapturePointDeploying(point, false);
            mod.SetAllObjectivesUIEnabled(true);
        }
        this.applyCaptureSpeed(false);
    }

    lockCapture(seconds: number): void {
        this.lockEndTime = mod.GetMatchTimeElapsed() + seconds;
        this.applyCaptureSpeed(true);
        mod.Wait(seconds).then(() => this.applyCaptureSpeed(false));
    }

    override getCaptureLockRemaining(): number {
        return Math.max(0, Math.ceil(this.lockEndTime - mod.GetMatchTimeElapsed()));
    }

    deactivate(): void {
        for (const point of this.capturePoints.values()) {
            mod.EnableGameModeObjective(point, false);
        }
    }

    private applyCaptureSpeed(locked: boolean): void {
        for (const point of this.capturePoints.values()) {
            mod.SetCapturePointCapturingTime(point, locked ? 9999 : frontlinesSettings.captureTime);
            mod.SetCapturePointNeutralizationTime(point, locked ? 9999 : frontlinesSettings.neutralCaptureNeutralizationTime);
            mod.SetMaxCaptureMultiplier(point, locked ? 0.1 : 1);
        }
    }

    // A point only counts once its owner is at 100% progress, so an ongoing capture or neutralization blocks the sector.
    isCapturedByTeam(): mod.Team {
        const seenOwner = mod.GetCurrentOwnerTeam(this.capturePoints.values().next().value!);
        for (const point of this.capturePoints.values()) {
            const owner = mod.GetCurrentOwnerTeam(point);
            if (!mod.Equals(seenOwner, owner) || mod.GetCaptureProgress(point) < 1) {
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

    countCapturePointsOwnedBy(team: mod.Team): number {
        let count = 0;
        for (const point of this.capturePoints.values()) {
            if (mod.Equals(mod.GetCurrentOwnerTeam(point), team)) {
                count++;
            }
        }
        return count;
    }
}
