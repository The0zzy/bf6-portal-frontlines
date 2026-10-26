import { UI } from 'bf6-portal-utils/ui';
import { UIContainer } from 'bf6-portal-utils/ui/components/container';
import { UIImage } from 'bf6-portal-utils/ui/components/image';
import { UIText } from 'bf6-portal-utils/ui/components/text';
import { BLUE, RED } from './FrontlinesConfig.ts';
import type { Color } from './FrontlinesConfig.ts';
import type { FrontlinesSector } from './FrontlinesSector.ts';

/*-----------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------- Frontlines UI -----------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------------------------*/

export interface SectorWidgets {
    fill1: UIContainer; // bottom (blue)
    fill2: UIContainer; // top (red)
    line: UIContainer;
    text: UIText;
    timer: UIText;
}

interface TeamWidgets {
    team: mod.Team;
    sectors: Map<FrontlinesSector, SectorWidgets>;
    rootCapture: UIContainer | undefined;
    winTimerText: UIText | undefined;
    rootMCOM: UIContainer | undefined;
    unitsRemainingFill: UIContainer | undefined;
    unitsRemainingText: UIText | undefined;
}

const UNITS_BAR_WIDTH = 80;

export class FrontlinesUI {
    private readonly teams: Record<1 | 2, TeamWidgets> = {
        1: FrontlinesUI.createTeamWidgets(mod.GetTeam(1)),
        2: FrontlinesUI.createTeamWidgets(mod.GetTeam(2)),
    };

    private static createTeamWidgets(team: mod.Team): TeamWidgets {
        return {
            team,
            sectors: new Map<FrontlinesSector, SectorWidgets>(),
            rootCapture: undefined,
            winTimerText: undefined,
            rootMCOM: undefined,
            unitsRemainingFill: undefined,
            unitsRemainingText: undefined,
        };
    }

    private forEachTeam(callback: (widgets: TeamWidgets) => void): void {
        callback(this.teams[1]);
        callback(this.teams[2]);
    }

    show(sectors: FrontlinesSector[]): void {
        this.forEachTeam(widgets => this.showSectorsUI(widgets, sectors));
    }

    private showSectorsUI(widgets: TeamWidgets, sectors: FrontlinesSector[]): void {
        const team = widgets.team;
        const root = new UIContainer({
            x: 0,
            y: 40,
            width: 300,
            height: 100,
            anchor: UI.Anchor.TopCenter,
            bgFill: UI.BgFill.Solid,
            receiver: team,
        });
        widgets.rootCapture = root;

        widgets.winTimerText = new UIText({
            parent: root,
            x: 0,
            y: 100,
            width: 75,
            height: 20,
            anchor: UI.Anchor.TopCenter,
            padding: 8,
            bgColor: { r: 0.2, g: 0.2, b: 1 },
            bgFill: UI.BgFill.Solid,
            label: mod.Message(mod.stringkeys.frontlines.time1MSG, 4, 0),
            textSize: 18,
            textColor: UI.COLORS.WHITE,
            textAnchor: UI.Anchor.Center,
            receiver: team,
        });

        let sectorElementSpace = 240 - sectors.length * 60;

        new UIImage({
            parent: root,
            x: sectorElementSpace - 60,
            y: 0,
            width: 40,
            height: 40,
            anchor: UI.Anchor.BottomLeft,
            imageType: UI.ImageType.CrownOutline,
            imageColor: UI.COLORS.BF_BLUE_BRIGHT,
            receiver: team,
        });

        for (const sector of sectors) {
            this.addSectorUIElement(widgets, sector, mod.Message(sector.labelMessageKey), sectorElementSpace);
            sectorElementSpace += 60;
        }

        new UIContainer({
            parent: root,
            x: sectorElementSpace - 20,
            y: 15,
            width: 23,
            height: 5,
            anchor: UI.Anchor.BottomLeft,
            bgColor: UI.COLORS.BLACK,
            bgAlpha: 0.8,
            bgFill: UI.BgFill.Solid,
            receiver: team,
        });
    }

    private showMCOMUI(widgets: TeamWidgets, color: Color, show: boolean): void {
        const team = widgets.team;
        if (widgets.rootMCOM) {
            widgets.rootMCOM.visible = show;
            return;
        }
        if (!show) {
            return;
        }

        const root = new UIContainer({
            x: 756,
            y: 54,
            width: 408,
            height: 88,
            anchor: UI.Anchor.TopLeft,
            bgColor: UI.COLORS.BF_BLUE_BRIGHT,
            bgAlpha: 1,
            receiver: team,
        });
        widgets.rootMCOM = root;

        const unitsBG = new UIContainer({
            parent: root,
            x: 80,
            y: 10,
            width: UNITS_BAR_WIDTH,
            height: 20,
            anchor: UI.Anchor.TopLeft,
            bgColor: { r: 0.1, g: 0.1, b: 0.1 },
            bgAlpha: 0.6,
            bgFill: UI.BgFill.Solid,
        });

        widgets.unitsRemainingFill = new UIContainer({
            parent: unitsBG,
            x: 0,
            y: 0,
            width: 1,
            height: 20,
            anchor: UI.Anchor.CenterRight,
            bgColor: { r: color[0], g: color[1], b: color[2] },
            bgFill: UI.BgFill.Solid,
        });

        widgets.unitsRemainingText = new UIText({
            parent: unitsBG,
            x: -10,
            y: 0,
            width: 102,
            height: 55,
            anchor: UI.Anchor.Center,
            label: mod.Message(mod.stringkeys.frontlines.UnitsRemainingText),
            textSize: 23,
            textColor: UI.COLORS.WHITE,
            textAnchor: UI.Anchor.Center,
        });

        new UIImage({
            parent: root,
            x: 0,
            y: 0,
            width: 40,
            height: 40,
            anchor: UI.Anchor.TopLeft,
            imageType: UI.ImageType.CrownOutline,
            imageColor: UI.COLORS.BF_BLUE_BRIGHT,
        });

        new UIImage({
            parent: root,
            x: 60,
            y: 0,
            width: 40,
            height: 40,
            anchor: UI.Anchor.TopRight,
            imageType: UI.ImageType.CrownOutline,
            imageColor: UI.COLORS.BF_RED_BRIGHT,
        });
    }

    showMcomPhase(team1Remaining: number, team2Remaining: number, maxUnits: number): void {
        this.forEachTeam(widgets => {
            if (widgets.rootCapture) {
                widgets.rootCapture.visible = false;
            }
            // Team 1 sees red, team 2 sees blue
            this.showMCOMUI(widgets, widgets === this.teams[1] ? RED : BLUE, true);
        });
        this.setUnitsRemaining(team1Remaining, team2Remaining, maxUnits);
    }

    showCapturePhase(): void {
        this.forEachTeam(widgets => {
            if (widgets.rootCapture) {
                widgets.rootCapture.visible = true;
            }
            if (widgets.rootMCOM) {
                widgets.rootMCOM.visible = false;
            }
        });
    }

    private addSectorUIElement(widgets: TeamWidgets, sector: FrontlinesSector, message: mod.Message, x: number): void {
        const root = widgets.rootCapture;
        if (!root) {
            return;
        }
        const team = widgets.team;


        new UIContainer({
            parent: root,
            x,
            y: 0,
            width: 40,
            height: 40,
            anchor: UI.Anchor.BottomLeft,
            bgColor: UI.COLORS.BLACK,
            bgAlpha: 1,
            bgFill: UI.BgFill.OutlineThin,
            receiver: team,
        });

        const fill1 = new UIContainer({
            parent: root,
            x,
            y: 0,
            width: 40,
            height: 0,
            anchor: UI.Anchor.BottomLeft,
            bgColor: UI.COLORS.BF_BLUE_BRIGHT,
            bgAlpha: 0.8,
            bgFill: UI.BgFill.Solid,
            receiver: team,
        });

        const fill2 = new UIContainer({
            parent: root,
            x,
            y: 60,
            width: 40,
            height: 0,
            anchor: UI.Anchor.TopLeft,
            bgColor: UI.COLORS.BF_RED_BRIGHT,
            bgAlpha: 0.8,
            bgFill: UI.BgFill.Solid,
            receiver: team,
        });

        const text = new UIText({
            parent: root,
            x,
            y: 0,
            width: 40,
            height: 40,
            anchor: UI.Anchor.BottomLeft,
            label: message,
            textSize: 30,
            textColor: UI.COLORS.WHITE,
            textAnchor: UI.Anchor.Center,
            receiver: team,
        });

        const timer = new UIText({
            parent: root,
            x,
            y: 0,
            width: 40,
            height: 40,
            anchor: UI.Anchor.BottomLeft,
            label: message,
            textSize: 30,
            textColor: UI.COLORS.WHITE,
            textAnchor: UI.Anchor.Center,
            receiver: team,
        });

        const line = new UIContainer({
            parent: root,
            x: x - 21,
            y: 15,
            width: 23,
            height: 5,
            anchor: UI.Anchor.BottomLeft,
            bgColor: UI.COLORS.BLACK,
            bgAlpha: 1,
            bgFill: UI.BgFill.Solid,
            receiver: team,
        });

        widgets.sectors.set(sector, { fill1, fill2, line, text, timer });
    }

    setTimer(seconds: number): void {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        let label: mod.Message;
        if (minutes < 10 && remainingSeconds < 10) {
            label = mod.Message(mod.stringkeys.frontlines.time1MSG, minutes, remainingSeconds);
        }
        else if (minutes < 10) {
            label = mod.Message(mod.stringkeys.frontlines.time2MSG, minutes, remainingSeconds);
        }
        else if (remainingSeconds < 10) {
            label = mod.Message(mod.stringkeys.frontlines.time3MSG, minutes, remainingSeconds);
        }
        else {
            label = mod.Message(mod.stringkeys.frontlines.time4MSG, minutes, remainingSeconds);
        }

        this.forEachTeam(widgets => {
            if (widgets.winTimerText) {
                widgets.winTimerText.label = label;
            }
        });
    }

    setUnitsRemaining(team1Remaining: number, team2Remaining: number, maxUnits: number): void {
        // Only one side loses units per MCOM phase, both teams see that (lower) value.
        const remaining = Math.min(team1Remaining, team2Remaining);
        this.forEachTeam(widgets => {
            if (widgets.unitsRemainingText) {
                widgets.unitsRemainingText.label = mod.Message(mod.stringkeys.frontlines.UnitsRemainingText, remaining);
            }
            if (widgets.unitsRemainingFill) {
                widgets.unitsRemainingFill.width = Math.round((remaining / maxUnits) * UNITS_BAR_WIDTH);
            }
        });
    }

    updateSector(sector: FrontlinesSector, fracTeam1: number, fracTeam2: number): void {
        this.updateSectorForTeam(this.teams[1], sector, fracTeam1, fracTeam2);
        // Team 2 sees blue = team 2, red = team 1 (mirrored)
        this.updateSectorForTeam(this.teams[2], sector, fracTeam2, fracTeam1);
    }

    private updateSectorForTeam(widgets: TeamWidgets, sector: FrontlinesSector, fracOwn: number, fracEnemy: number): void {
        const sectorWidgets = widgets.sectors.get(sector);
        if (!widgets.rootCapture || !sectorWidgets) {
            return;
        }

        // Blue at the bottom, red at the top. The neutral area lies between fill1 (grows from the bottom) and fill2 (grows from the top).
        sectorWidgets.fill1.size = { width: 40, height: Math.round(fracOwn * 40) };
        sectorWidgets.fill1.bgColor = UI.COLORS.BF_BLUE_BRIGHT;
        sectorWidgets.fill2.size = { width: 40, height: Math.round(fracEnemy * 40) };
        sectorWidgets.fill2.bgColor = UI.COLORS.BF_RED_BRIGHT;

        // Line = Ownership
        sectorWidgets.line.bgColor = mod.Equals(sector.ownerTeam, widgets.team)
            ? UI.COLORS.BF_BLUE_BRIGHT
            : UI.COLORS.BF_RED_BRIGHT;
    }

    destroy(): void {
        this.forEachTeam(widgets => {
            widgets.rootCapture?.delete();
            widgets.rootMCOM?.delete();
            widgets.sectors.clear();
            widgets.rootCapture = undefined;
            widgets.winTimerText = undefined;
            widgets.rootMCOM = undefined;
            widgets.unitsRemainingFill = undefined;
            widgets.unitsRemainingText = undefined;
        });
    }
}
