import { ModHelpers } from '../utils/ModHelpers.ts';
import { BLUE, RED, REDVEC, BLUEVEC, Color } from './FrontlinesConfig.ts';
import { ISector } from './FrontlinesTypes.ts';

/*-----------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------- Frontlines UI -----------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------------------------*/

export class FrontlinesUI {
    rootCountdown: mod.UIWidget | undefined;
    CountdownText: mod.UIWidget | undefined;
    Mcom1team1imageWidget: mod.UIWidget | undefined;
    Mcom2team1imageWidget: mod.UIWidget | undefined;
    Mcom1team2imageWidget: mod.UIWidget | undefined;
    Mcom2team2imageWidget: mod.UIWidget | undefined;

    rootRoundWin: mod.UIWidget | undefined;
    RoundWinText: mod.UIWidget | undefined;
    SwitchingText: mod.UIWidget | undefined;

    rootCapture: mod.UIWidget | undefined;

    rootMCOMInteract: mod.UIWidget | undefined;
    MCOMInteractBarBG: mod.UIWidget | undefined;
    MCOMInteractBarFill: mod.UIWidget | undefined;

    rootCapturePoint: mod.UIWidget | undefined;
    DistributionBG: mod.UIWidget | undefined;
    Team1CountText: mod.UIWidget | undefined;
    Team2CountText: mod.UIWidget | undefined;
    CapturePointLetterText: mod.UIWidget | undefined;

    rootMCOM: mod.UIWidget | undefined;
    UnitsRemainingBG: mod.UIWidget | undefined;
    UnitsRemainingFill: mod.UIWidget | undefined;
    UnitsRemainingText: mod.UIWidget | undefined;

    rootBounds: mod.UIWidget | undefined;
    BoundsText: mod.UIWidget | undefined;

    Team1ScoreText: mod.UIWidget | undefined;
    Team2ScoreText: mod.UIWidget | undefined;
    Bar1BG: mod.UIWidget | undefined;
    Bar2BG: mod.UIWidget | undefined;
    Bar1Fill: mod.UIWidget | undefined;
    Bar2Fill: mod.UIWidget | undefined;
    WinTimerText: mod.UIWidget | undefined;

    sectorElementSpace: number = 0;

    constructor() {

    }

    ShowTeamMCOMS(team: mod.Team) {
        this.Mcom1team1imageWidget = ModHelpers.ParseUI(
            {
                name: "MCOM1Team1Image",
                type: "Image",
                position: [-130, 140],
                size: [25, 25],
                anchor: mod.UIAnchor.TopCenter,
                visible: true,
                padding: 0,
                bgColor: [0.2, 0.2, 0.2],
                bgAlpha: 0,
                bgFill: mod.UIBgFill.None,
                imageType: mod.UIImageType.SpawnBeacon,
                imageColor: BLUE,
                imageAlpha: 1,
                teamId: team
            }
        );

        this.Mcom2team1imageWidget = ModHelpers.ParseUI(
            {
                name: "MCOM2Team1Image",
                type: "Image",
                position: [-90, 140],
                size: [25, 25],
                anchor: mod.UIAnchor.TopCenter,
                visible: true,
                padding: 0,
                bgColor: [0.2, 0.2, 0.2],
                bgAlpha: 0,
                bgFill: mod.UIBgFill.None,
                imageType: mod.UIImageType.SpawnBeacon,
                imageColor: BLUE,
                imageAlpha: 1,
                teamId: team
            }
        );

        this.Mcom1team2imageWidget = ModHelpers.ParseUI(
            {
                name: "MCOM1Team2Image",
                type: "Image",
                position: [90, 140],
                size: [25, 25],
                anchor: mod.UIAnchor.TopCenter,
                visible: true,
                padding: 0,
                bgColor: [0.2, 0.2, 0.2],
                bgAlpha: 0,
                bgFill: mod.UIBgFill.None,
                imageType: mod.UIImageType.SpawnBeacon,
                imageColor: RED,
                imageAlpha: 1,
                teamId: team
            }
        );

        this.Mcom2team2imageWidget = ModHelpers.ParseUI(
            {
                name: "MCOM2Team2",
                type: "Image",
                position: [130, 140],
                size: [25, 25],
                anchor: mod.UIAnchor.TopCenter,
                visible: true,
                padding: 0,
                bgColor: [0.2, 0.2, 0.2],
                bgAlpha: 0,
                bgFill: mod.UIBgFill.None,
                imageType: mod.UIImageType.SpawnBeacon,
                imageColor: RED,
                imageAlpha: 1,
                teamId: team
            }
        );

    }

    ShowBoundsUI(player: mod.Player, show: boolean) {
        if (!show) {
            if (!this.rootBounds) {
                return;
            }
            mod.SetUIWidgetVisible(this.rootBounds, false);
            return;
        }

        if (this.rootBounds) {
            mod.SetUIWidgetVisible(this.rootBounds, true);
            return;
        }
        this.rootBounds = ModHelpers.ParseUI({
            type: "Container",
            name: "rootBounds",
            size: [1920, 1080],
            position: [0, 0],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: [0, 0, 0],
            bgAlpha: 0.9,
            playerId: player
        })

        this.BoundsText = ModHelpers.ParseUI({
            type: "Text",
            name: "BoundsText",
            parent: this.rootBounds,
            textSize: 60,
            position: [0, 200, 0],
            size: [800, 300],
            anchor: mod.UIAnchor.TopCenter,
            textAnchor: mod.UIAnchor.Center,
            textColor: [1, 0, 0],
            bgFill: mod.UIBgFill.Solid,
            bgColor: [0.2, 0.2, 1],
            bgAlpha: 0,
            textLabel: mod.Message(mod.stringkeys.boundsMSG, 10),
            playerId: player
        })

        if (!this.rootBounds) {
            return;
        }
        mod.SetUIWidgetVisible(this.rootBounds, true);
    }

    ShowCaptureUI(team: mod.Team, sectors: ISector[]) {
        this.rootCapture = ModHelpers.ParseUI({
            type: "Container",
            name: "rootCapture",
            size: [300, 100],
            position: [0, 40],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Solid,
            bgColor: [0, 0, 0],
            bgAlpha: 0,
            teamId: team,
        })

        this.WinTimerText = ModHelpers.ParseUI({
            type: "Text",
            name: "winTimer",
            parent: this.rootCapture,
            textSize: 18,
            position: [0, 100, 0],
            size: [75, 20],
            anchor: mod.UIAnchor.TopCenter,
            textAnchor: mod.UIAnchor.Center,
            textColor: [1, 1, 1],
            bgFill: mod.UIBgFill.Solid,
            bgColor: [0.2, 0.2, 1],
            bgAlpha: 0,
            teamId: team,
            textLabel: mod.Message(mod.stringkeys.time1MSG, 4, 0),
        })

        this.sectorElementSpace = 240 - sectors.length * 60;

        if (this.rootCapture) {
            mod.AddUIImage(
                "team1Image",                             // String: name
                mod.CreateVector(this.sectorElementSpace - 60, 0, 0),              // Vektor: position
                mod.CreateVector(40, 40, 0),              // Vektor: size
                mod.UIAnchor.BottomLeft,                  // UIAnchor: anchor
                this.rootCapture,                    // UIWidget: parent
                true,                                     // Bool: visible
                0,                                        // Zahl: padding
                mod.CreateVector(0, 0, 0),                // Vektor: bgColor 
                0,                                        // Zahl: bgAlpha
                mod.UIBgFill.Solid,                        // UIBgFill: bgFill
                mod.UIImageType.CrownOutline,             // UIImageType: imageType
                BLUEVEC,                // Vektor: imageColor 
                1,
                team
            );
        }

        let message: mod.Message = mod.Message(mod.stringkeys.a);

        for (const sector of sectors) {
            switch (sector.letter) {
                case "A":
                    message = mod.Message(mod.stringkeys.a);
                    break;
                case "B":
                    message = mod.Message(mod.stringkeys.b);
                    break;
                case "C":
                    message = mod.Message(mod.stringkeys.c);
                    break
                case "D":
                    message = mod.Message(mod.stringkeys.d);
                    break
                case "E":
                    message = mod.Message(mod.stringkeys.e);
                    break
                case "F":
                    message = mod.Message(mod.stringkeys.f);
                    break
                case "G":
                    message = mod.Message(mod.stringkeys.f);
                    break
                case "H":
                    message = mod.Message(mod.stringkeys.f);
                    break
                case "I":
                    message = mod.Message(mod.stringkeys.f);
                    break
            }

            if (mod.Equals(team, mod.GetTeam(1))) {
                this.AddSectorUIElement("ST1" + sector.letter, message, team);
            }
            else {
                this.AddSectorUIElement("ST2" + sector.letter, message, team);
            }

        }

        if (this.rootCapture) {
            //outer right line
            mod.AddUIContainer("SectorOut" + "Line", mod.CreateVector(this.sectorElementSpace - 20, 15, 0), mod.CreateVector(22.5, 5, 0), mod.UIAnchor.BottomLeft, this.rootCapture, true, 0, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Solid, mod.UIDepth.AboveGameUI, team);

        }


        if (this.rootCapture) {
            mod.AddUIImage(
                "team2Image",                             // String: name
                mod.CreateVector(this.sectorElementSpace, 0, 0),              // Vektor: position
                mod.CreateVector(40, 40, 0),              // Vektor: size
                mod.UIAnchor.BottomLeft,                  // UIAnchor: anchor
                this.rootCapture,                    // UIWidget: parent
                true,                                     // Bool: visible
                0,                                        // Zahl: padding
                mod.CreateVector(0, 0, 0),                // Vektor: bgColor
                0,                                        // Zahl: bgAlpha
                mod.UIBgFill.Solid,                        // UIBgFill: bgFill
                mod.UIImageType.CrownOutline,             // UIImageType: imageType
                REDVEC,                // Vektor: imageColor
                1,
                team                                    // Zahl: imageAlpha
            );
        }

        if (!this.rootCapture) {
            return;
        }
        mod.SetUIWidgetVisible(this.rootCapture, true);

    }

    ShowMCOMUI(team: mod.Team, color: Color, show: boolean) {
        if (!show) {
            if (!this.rootMCOM) {
                return;
            }
            mod.SetUIWidgetVisible(this.rootMCOM, false);
            return;
        }

        if (this.rootMCOM) {
            mod.SetUIWidgetVisible(this.rootMCOM, true);
            return;
        }
        this.rootMCOM = ModHelpers.ParseUI(
            {
                name: "rootMCOM",
                type: "Container",
                position: [755.88, 53.7],
                size: [408.25, 87.78],
                anchor: mod.UIAnchor.TopLeft,
                visible: true,
                padding: 0,
                bgColor: [0.4392, 0.9216, 1],
                bgAlpha: 1,
                bgFill: mod.UIBgFill.None,
                teamId: team,
                children: [
                    {
                        name: "UnitsRemainingBG",
                        type: "Container",
                        position: [80, 10],
                        size: [80, 20],
                        anchor: mod.UIAnchor.TopLeft,
                        visible: true,
                        padding: 0,
                        bgColor: [0.1, 0.1, 0.1],
                        bgAlpha: 0.6,
                        bgFill: mod.UIBgFill.Solid,
                        children: [
                            {
                                name: "UnitsRemainingFill",
                                type: "Container",
                                position: [0, 0],
                                size: [1, 20],
                                anchor: mod.UIAnchor.CenterRight,
                                visible: true,
                                padding: 0,
                                bgColor: color,
                                bgAlpha: 1,
                                bgFill: mod.UIBgFill.Solid
                            },
                            {
                                name: "UnitsRemainingText",
                                type: "Text",
                                position: [-10, 0],
                                size: [101.99, 54.97],
                                anchor: mod.UIAnchor.Center,
                                visible: true,
                                padding: 0,
                                bgColor: [0.2, 0.2, 0.2],
                                bgAlpha: 1,
                                bgFill: mod.UIBgFill.None,
                                textLabel: mod.stringkeys.UnitsRemainingText,
                                textColor: [1, 1, 1],
                                textAlpha: 1,
                                textSize: 23,
                                textAnchor: mod.UIAnchor.Center
                            }
                        ]
                    },
                    {
                        name: "Team1Image",
                        type: "Image",
                        position: [0, 0],
                        size: [40, 40],
                        anchor: mod.UIAnchor.TopLeft,
                        visible: true,
                        padding: 0,
                        bgColor: [0.2, 0.2, 0.2],
                        bgAlpha: 1,
                        bgFill: mod.UIBgFill.None,
                        imageType: mod.UIImageType.CrownOutline,
                        imageColor: BLUEVEC,
                        imageAlpha: 1
                    },
                    {
                        name: "Team2Image",
                        type: "Image",
                        position: [60, 0],
                        size: [40, 40],
                        anchor: mod.UIAnchor.TopRight,
                        visible: true,
                        padding: 0,
                        bgColor: [0.2, 0.2, 0.2],
                        bgAlpha: 1,
                        bgFill: mod.UIBgFill.None,
                        imageType: mod.UIImageType.CrownOutline,
                        imageColor: REDVEC,
                        imageAlpha: 1
                    }
                ]
            }
        );

        if (!this.rootMCOM) {
            return;
        }
        mod.SetUIWidgetVisible(this.rootMCOM, true);
    }

    AddSectorUIElement(name: string, message: mod.Message, team: mod.Team) {
        if (!this.rootCapture) {
            return;
        }
        mod.AddUIContainer(name + "BG", mod.CreateVector(this.sectorElementSpace, 0, 0), mod.CreateVector(40, 40, 0), mod.UIAnchor.BottomLeft, this.rootCapture, true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.OutlineThin, mod.UIDepth.AboveGameUI, team);
        mod.AddUIContainer(name + "Fill1", mod.CreateVector(this.sectorElementSpace, 0, 0), mod.CreateVector(40, 0, 0), mod.UIAnchor.BottomLeft, this.rootCapture, true, 0, BLUEVEC, 0.8, mod.UIBgFill.Solid, mod.UIDepth.AboveGameUI, team);
        mod.AddUIContainer(name + "Fill2", mod.CreateVector(this.sectorElementSpace, 60, 0), mod.CreateVector(40, 0, 0), mod.UIAnchor.TopLeft, this.rootCapture, true, 0, REDVEC, 0.8, mod.UIBgFill.Solid, mod.UIDepth.AboveGameUI, team);
        mod.AddUIText(name + "Text", mod.CreateVector(this.sectorElementSpace, 0, 0), mod.CreateVector(40, 40, 0), mod.UIAnchor.BottomLeft, this.rootCapture, true, 0, mod.CreateVector(0, 0, 0), 0, mod.UIBgFill.Solid, message, 30, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, team);
        mod.AddUIText(name + "Timer", mod.CreateVector(this.sectorElementSpace, 0, 0), mod.CreateVector(40, 40, 0), mod.UIAnchor.BottomLeft, this.rootCapture, true, 0, mod.CreateVector(0, 0, 0), 0, mod.UIBgFill.Solid, message, 30, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, team);
        mod.AddUIContainer(name + "Line", mod.CreateVector(this.sectorElementSpace - 21, 15, 0), mod.CreateVector(22.5, 5, 0), mod.UIAnchor.BottomLeft, this.rootCapture, true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.Solid, mod.UIDepth.AboveGameUI, team);
        this.sectorElementSpace += 60;
    }

    // Deletes children before parents; widgets created via mod.AddUI* without a stored handle are not tracked.
    destroy(): void {
        const widgets: (mod.UIWidget | undefined)[] = [
            this.BoundsText, this.rootBounds,
            this.CountdownText, this.rootCountdown,
            this.Mcom1team1imageWidget, this.Mcom2team1imageWidget, this.Mcom1team2imageWidget, this.Mcom2team2imageWidget,
            this.RoundWinText, this.SwitchingText, this.rootRoundWin,
            this.MCOMInteractBarFill, this.MCOMInteractBarBG, this.rootMCOMInteract,
            this.DistributionBG, this.Team1CountText, this.Team2CountText, this.CapturePointLetterText, this.rootCapturePoint,
            this.UnitsRemainingBG, this.UnitsRemainingFill, this.UnitsRemainingText, this.rootMCOM,
            this.Team1ScoreText, this.Team2ScoreText, this.Bar1BG, this.Bar2BG, this.Bar1Fill, this.Bar2Fill, this.WinTimerText,
            this.rootCapture
        ];

        for (const widget of widgets) {
            if (widget) {
                mod.DeleteUIWidget(widget);
            }
        }
    }

}
