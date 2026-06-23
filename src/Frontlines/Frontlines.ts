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
        Frontlines.instance.eventSubscriptions.push(
            Events.OnGameModeStarted.subscribe(
                async () => {
                    console.log("Frontlines.init() called");
                }
            )
        );
    }

    destroy() {
        this.eventSubscriptions.forEach(unsubscribe => unsubscribe());
        this.eventSubscriptions = [];
    }
}