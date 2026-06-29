import { Events } from "bf6-portal-utils/events";

export class Frontlines {

    private static instance: Frontlines | null = null;
    captureChain: mod.CapturePoint[] = [];
    captureChainIndex: number = 0;
    captureTime: number = 30; // seconds
    neutralizationTime: number = 10; // seconds
    preparationTime: number = 30; // seconds
    preparationTimeStart: Date | null = null;
    mcomCaptureTime: number = 30; // seconds
    mcomCaptureTimeStart: Date | null = null;
    mcomFuseTime: number = 10; // seconds
    mcoms: mod.MCOM[] = [];
    eventSubscriptions: (() => void)[] = [];


    static init() {
        if (Frontlines.instance) {
            return;
        }
        Frontlines.instance = new Frontlines();
        Frontlines.instance.init();
    }

    init() {
        // Disable all capture points at the start of the game
        const allCapturePoints = mod.AllCapturePoints();
        for (let i = 0; i < mod.CountOf(allCapturePoints); i++) {
            const capturePoint = mod.ValueInArray(allCapturePoints, i);
            mod.EnableGameModeObjective(capturePoint, false);
        }

        // Frontlines capture point object ID range: 0-9
        for (let i = 0; i < 10; i++) {
            const capturePoint = mod.GetCapturePoint(i);
            if (capturePoint) {
                this.captureChain.push(capturePoint);
            }
        }

        // set the initial capture chain index to the middle of the chain
        this.captureChainIndex = Math.floor(this.captureChain.length / 2);

        this.updateCapturePoints();

        this.subscribeToEvents();
    }

    updateCapturePoints() {
        // Update the capture points based on the current capture chain index
        for (let i = 0; i < this.captureChain.length; i++) {
            const capturePoint = this.captureChain[i];
            mod.EnableGameModeObjective(capturePoint, i === this.captureChainIndex);
            mod.EnableCapturePointDeploying(capturePoint, false);
            mod.SetCapturePointCapturingTime(capturePoint, this.captureTime);
            mod.SetMaxCaptureMultiplier(capturePoint, 1.0);
            mod.SetCapturePointNeutralizationTime(capturePoint, this.neutralizationTime);
        }
    }


    onCapturePointCaptured(capturePoint: mod.CapturePoint) {
        if (mod.GetCurrentOwnerTeam(capturePoint) === mod.GetTeam(1)) {
            if (this.captureChainIndex == this.captureChain.length - 1) {
                // Team 1 has captured the last capture point, start mcom capture sequence
                this.startMcomCaptureSequence(mod.GetTeam(1));
            } else {
                this.captureChainIndex++;
            }
        } else {
            if (this.captureChainIndex == 0) {
                // Team 2 has captured the first capture point, start mcom capture sequence
                this.startMcomCaptureSequence(mod.GetTeam(2));
            } else {
                this.captureChainIndex--;
            }
        }
    }

    startMcomCaptureSequence(attackerTeam: mod.Team) {
        mod.SendErrorReport(mod.Message(mod.stringkeys.frontlines.debug.mcom_phase));
    }

    subscribeToEvents() {
        this.eventSubscriptions.push(
            Events.OnCapturePointCaptured.subscribe(
                (capturePoint: mod.CapturePoint) => this.onCapturePointCaptured(capturePoint)
            )
        );
    }

    static destroy() {
        if (Frontlines.instance) {
            Frontlines.instance.eventSubscriptions.forEach(unsubscribe => unsubscribe());
            Frontlines.instance.eventSubscriptions = [];
            Frontlines.instance = null;
        }
    }
}