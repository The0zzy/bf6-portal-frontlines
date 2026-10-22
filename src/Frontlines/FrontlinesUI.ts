import { UI } from 'bf6-portal-utils/ui';
import { UIContainer } from 'bf6-portal-utils/ui/components/container';
import { UIImage } from 'bf6-portal-utils/ui/components/image';
import { UIText } from 'bf6-portal-utils/ui/components/text';
import type { Color } from './FrontlinesConfig.ts';
import type { ISector } from './FrontlinesTypes.ts';

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

const UNITS_BAR_WIDTH = 80;

export class FrontlinesUI {
    private readonly sectors = new Map<string, SectorWidgets>();
    private sectorElementSpace: number = 0;

    rootCapture: UIContainer | undefined;
    WinTimerText: UIText | undefined;

    rootMCOM: UIContainer | undefined;
    UnitsRemainingFill: UIContainer | undefined;
    UnitsRemainingText: UIText | undefined;

    getSector(letter: string): SectorWidgets | undefined {
        return this.sectors.get(letter);
    }

    ShowCaptureUI(team: mod.Team, sectors: ISector[]) {
        const root = new UIContainer({
            x: 0,
            y: 40,
            width: 300,
            height: 100,
            anchor: UI.Anchor.TopCenter,
            bgFill: UI.BgFill.Solid,
            receiver: team,
        });
        this.rootCapture = root;

        this.WinTimerText = new UIText({
            parent: root,
            x: 0,
            y: 100,
            width: 75,
            height: 20,
            anchor: UI.Anchor.TopCenter,
            padding: 8,
            bgColor: { r: 0.2, g: 0.2, b: 1 },
            bgFill: UI.BgFill.Solid,
            label: mod.Message(mod.stringkeys.time1MSG, 4, 0),
            textSize: 18,
            textColor: UI.COLORS.WHITE,
            textAnchor: UI.Anchor.Center,
            receiver: team,
        });

        this.sectorElementSpace = 240 - sectors.length * 60;

        new UIImage({
            parent: root,
            x: this.sectorElementSpace - 60,
            y: 0,
            width: 40,
            height: 40,
            anchor: UI.Anchor.BottomLeft,
            imageType: UI.ImageType.CrownOutline,
            imageColor: UI.COLORS.BF_BLUE_BRIGHT,
            receiver: team,
        });

        for (const sector of sectors) {
            let message: mod.Message;
            switch (sector.letter) {
                case "B":
                    message = mod.Message(mod.stringkeys.b);
                    break;
                case "C":
                    message = mod.Message(mod.stringkeys.c);
                    break;
                case "D":
                    message = mod.Message(mod.stringkeys.d);
                    break;
                case "E":
                    message = mod.Message(mod.stringkeys.e);
                    break;
                case "F":
                    message = mod.Message(mod.stringkeys.f);
                    break;
                case "G":
                    message = mod.Message(mod.stringkeys.g);
                    break;
                case "H":
                    message = mod.Message(mod.stringkeys.h);
                    break;
                case "I":
                    message = mod.Message(mod.stringkeys.i);
                    break;
                default:
                    message = mod.Message(mod.stringkeys.a);
                    break;
            }
            this.AddSectorUIElement(sector.letter, message, team);
        }

        new UIContainer({
            parent: root,
            x: this.sectorElementSpace - 20,
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

    ShowMCOMUI(team: mod.Team, color: Color, show: boolean) {
        if (this.rootMCOM) {
            this.rootMCOM.visible = show;
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
        this.rootMCOM = root;

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

        this.UnitsRemainingFill = new UIContainer({
            parent: unitsBG,
            x: 0,
            y: 0,
            width: 1,
            height: 20,
            anchor: UI.Anchor.CenterRight,
            bgColor: { r: color[0], g: color[1], b: color[2] },
            bgFill: UI.BgFill.Solid,
        });

        this.UnitsRemainingText = new UIText({
            parent: unitsBG,
            x: -10,
            y: 0,
            width: 102,
            height: 55,
            anchor: UI.Anchor.Center,
            label: mod.Message(mod.stringkeys.UnitsRemainingText),
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

    private AddSectorUIElement(letter: string, message: mod.Message, team: mod.Team) {
        const root = this.rootCapture;
        if (!root) {
            return;
        }

        const x = this.sectorElementSpace;

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

        this.sectors.set(letter, { fill1, fill2, line, text, timer });
        this.sectorElementSpace += 60;
    }

    setUnitsRemaining(remaining: number, max: number): void {
        if (this.UnitsRemainingText) {
            this.UnitsRemainingText.label = mod.Message(mod.stringkeys.UnitsRemainingText, remaining);
        }
        if (this.UnitsRemainingFill) {
            this.UnitsRemainingFill.width = Math.round((remaining / max) * UNITS_BAR_WIDTH);
        }
    }

    destroy(): void {
        this.rootCapture?.delete();
        this.rootMCOM?.delete();
        this.sectors.clear();
        this.rootCapture = undefined;
        this.WinTimerText = undefined;
        this.rootMCOM = undefined;
        this.UnitsRemainingFill = undefined;
        this.UnitsRemainingText = undefined;
    }
}
