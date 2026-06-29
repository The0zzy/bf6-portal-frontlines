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

    static isPositionValid(object: mod.Object): boolean {
        const position = mod.GetObjectPosition(object);
        const posX = mod.XComponentOf(position);
        const posY = mod.YComponentOf(position);
        const posZ = mod.ZComponentOf(position);
        if (Math.abs(posX) < 1 && Math.abs(posY) < 1 && Math.abs(posZ) < 1) {
            return false;
        }
        return true;
    }

    static isCapturePointValid(capturePointId: number): boolean {
        const cp = mod.GetCapturePoint(capturePointId);
        return Frontlines.isPositionValid(cp);
    }

    static isMcomValid(mcomId: number): boolean {
        const mcom = mod.GetMCOM(mcomId);
        return Frontlines.isPositionValid(mcom);
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
            if (Frontlines.isCapturePointValid(i)) {
                this.captureChain.push(capturePoint);
            }
        }

        // Frontlines HQ object ID range: 100-120 (twice as many as capture points)
        // 9 CPs    = 18 HQs 
        //          + 2 standard HQs 
        //          = 20 total HQs
        // 119 (team 1), 120 (team 2) are the outmost HQs that should always be active
        // 100 (team 1), 101 (team 2) are the next HQs in the chain, and so on
        for (let i = 100; i < 119; i++) {
            const hq = mod.GetHQ(i);
            if (Frontlines.isPositionValid(hq)) {
                mod.EnableGameModeObjective(hq, false);
            }
        }
        for (let standardHQ of [119, 120]) {
            const hq = mod.GetHQ(standardHQ);
            if (Frontlines.isPositionValid(hq)) {
                mod.EnableGameModeObjective(hq, false);
            }
        }

        // Frontlines mcom object ID range: 20-24
        for (let i = 20; i < 25; i++) {
            const mcom = mod.GetMCOM(i);
            if (Frontlines.isMcomValid(i)) {
                mod.EnableGameModeObjective(mcom, false);
                this.mcoms.push(mcom);
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
            Events.OnCapturePointCaptured.subscribe(this.onCapturePointCaptured.bind(this))
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