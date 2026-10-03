/*
    ============================
    Godot Map Setup Requirements
    ============================

    The game logic automatically discovers all sectors, areas, HQs and capture points
    based solely on their ID numbers. No manual configuration inside the code is required.
    A correct Godot map setup is the only requirement.

    -------------------------
    Sector and Object ID Rules
    -------------------------

    â¢ sectorIDs:        101â110
    â¢ areaIDs:          301â310        (areaID = sectorID + 200)
    â¢ hqIDs:            401â410        (hqID = sectorID + 300)

    â¢ capturePointIDs per sector:
        Sector 101 â 1001â1010
        Sector 102 â 1101â1110
        Sector 103 â 1201â1210
        Sector 104 â 1301â1310
        ...
        Formula:
            baseID = 1001 + (sectorID - 101) * 100
            capturePointIDs = baseID ... baseID + 9

    -------------------------
    Example Configurations
    -------------------------

    Sector 1 (sectorID 101):
        sectorID:       101
        areaID:         301
        hqID:           401
        capturePoints:  1001, 1002, 1003 ...

    Sector 2 (sectorID 102):
        sectorID:       102
        areaID:         302
        hqID:           402
        capturePoints:  1101, 1102, 1103 ...

    -------------------------
    Important Notes
    -------------------------

    â¢ All IDs must be assigned correctly in the Godot map.
    â¢ If an ID is missing or incorrect, the corresponding object will not be detected.
    â¢ The code automatically loads:
        - Sectors via mod.GetSector(sectorID)
        - Areas via mod.GetArea(areaID)
        - HQs via mod.GetHQ(hqID)
        - Capture Points via mod.GetCapturePoint(capturePointID)
    â¢ No additional setup or registration is needed in the code.
*/

//Frontlines Settings
const timeLimit = 60;
const captureTime = 40;
const captureNeutralizationTime = 30;
const mCOMFuseTime = 40;
const maxUnitsRemaining = 100;
const redeployTime = 15;
const sectorTimer = 30;

//imports
import { ParseUI } from "modlib";
import * as modlib from "modlib";

interface FrontlineSettings {
    timeLimit: number,
    captureTime: number,
    captureNeutralizationTime: number,
    mCOMFuseTime: number,
    maxUnitsRemaining: number,
    redeployTime: number,
    sectorTimer: number
}

//data structures
interface PlayerData {
    ui: FrontlinesUI | undefined;
    stats: IPlayerStats;
    currentCapturePointOd: number;
    inBounds: boolean;
    isCrouching: boolean;
    wasCrouching: boolean;
    isProne: boolean;
    wasProne: boolean;
    isInteracting: boolean;
    wasInteracting: boolean;
    isZooming: boolean;
    wasZooming: boolean;
}

interface IPlayerStats {
    captures: number,
    kd: number,
    kills: number,
    deaths: number,
    assists: number
}

interface ICapturePoint {
    letter: string,
    playerIds: number[];
    player2Ids: number[];
}

interface IMCOM {
    letter: string,
    sectorId: number,
    areaId: number,
    customMCOM: CustomMCOM;
    playerIds: number[];
    player2Ids: number[];
}

interface ICustomMcom {
    id: number;
    areaId: number;
    ownerTeam: mod.Team;
    active: boolean;
    destroyed: boolean;
}

interface ISector {
    letter: string;
    id: number;
    areaId: number;
    hqId: number;
    captureStatus: number;
    ownerTeam: mod.Team | undefined;
    capturePoints: Map<number, ICapturePoint>;
}

class CustomMCOM {
    data: ICustomMcom = {
        id: 0,
        areaId: 901,
        ownerTeam: mod.GetTeam(1),
        active: false,
        destroyed: false,
    }

    mcomObj: mod.MCOM = mod.GetMCOM(this.data.id);
    team1Icon: mod.WorldIcon | undefined;
    team2Icon: mod.WorldIcon | undefined;

    alarmSFX: mod.SFX | undefined;

    currentArmTime: number;
    currentFuseTime: number;
    fused: boolean;

    constructor(pId: number, pAreaId: number, pOwnerTeam: mod.Team) {
        this.data.id = pId;
        this.data.areaId = pAreaId;
        this.data.ownerTeam = pOwnerTeam;

        this.currentArmTime = 0;
        this.currentFuseTime = 0;
        this.fused = false;

        this.mcomObj = mod.GetMCOM(this.data.id);

        if (this.mcomObj) {
            this.alarmSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_GameModes_Rush_Alarm_SimpleLoop3D, mod.GetObjectPosition(this.mcomObj), mod.CreateVector(1, 1, 1));
        }
    }

    activateMCOM(activate: boolean): void {
        if (!activate) {
            this.data.active = false

            mod.EnableGameModeObjective(mod.GetMCOM(this.data.id), false);

            return;
        }

        mod.EnableGameModeObjective(mod.GetMCOM(this.data.id), true);

        this.data.active = true;
    }

    destroyMCOM(team: mod.Team): void {
        this.data.active = false;
        this.data.destroyed = true;


        let mcomDestroyedMessage1: mod.Message = mod.Message(mod.stringkeys.youDestroyedMCOM);
        let mcomDestroyedMessage2: mod.Message = mod.Message(mod.stringkeys.teamDestroyedMCOM);

        if (mod.Equals(this.data.ownerTeam, mod.GetTeam(1))) {
            let vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
            mod.PlayVO(vo, mod.VoiceOverEvents2D.MComDestroyedEnemy, mod.VoiceOverFlags.Alpha, mod.GetTeam(1));

            mod.PlayVO(vo, mod.VoiceOverEvents2D.MComDestroyedFriendly, mod.VoiceOverFlags.Alpha, mod.GetTeam(2));

            mcomDestroyedMessage2 = mod.Message(mod.stringkeys.youDestroyedMCOM);
            mcomDestroyedMessage1 = mod.Message(mod.stringkeys.teamDestroyedMCOM);

        }
        else {
            let vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
            mod.PlayVO(vo, mod.VoiceOverEvents2D.MComDestroyedEnemy, mod.VoiceOverFlags.Alpha, mod.GetTeam(2));

            mod.PlayVO(vo, mod.VoiceOverEvents2D.MComDestroyedFriendly, mod.VoiceOverFlags.Alpha, mod.GetTeam(1));

            mcomDestroyedMessage1 = mod.Message(mod.stringkeys.youDestroyedMCOM);
            mcomDestroyedMessage2 = mod.Message(mod.stringkeys.teamDestroyedMCOM);

            mod.Wait(8).then(() => {
                if (vo) {
                    mod.UnspawnObject(vo);
                }
            })
        }

        if (this.alarmSFX) {
            mod.StopSound(this.alarmSFX);
        }

        playTextSequence({
            background: {
                position: [100, 100],
                anchor: mod.UIAnchor.TopLeft,
                size: [400, 40],
                color: [0, 0.5, 0],
                alpha: 0.8,
            },
            texts: [
                {
                    message: mcomDestroyedMessage1,
                    duration: 5,
                    fadeInSpeed: 0.1,
                    fadeOutDuration: 0.2,
                    textSize: 30,
                    color: [1, 1, 1],
                    shrinkScale: 0.85,
                    moveDown: 20,
                    offsetY: 0
                },
            ],
            team: mod.GetTeam(1)
        });

        playTextSequence({
            background: {
                position: [100, 100],
                anchor: mod.UIAnchor.TopLeft,
                size: [400, 40],
                color: [0, 0.5, 0],
                alpha: 0.8,
            },
            texts: [
                {
                    message: mcomDestroyedMessage2,
                    duration: 5,
                    fadeInSpeed: 0.1,
                    fadeOutDuration: 0.2,
                    textSize: 30,
                    color: [1, 1, 1],
                    shrinkScale: 0.85,
                    moveDown: 20,
                    offsetY: 0
                },
            ],
            team: mod.GetTeam(2)
        });

        if (this.team1Icon && this.team2Icon) {
            mod.UnspawnObject(this.team1Icon);
            mod.UnspawnObject(this.team2Icon);
        }

        switch (this.data.id) {
            case 601:
                if (fUITeam1 && fUITeam1.Mcom1team1imageWidget) {
                    mod.DeleteUIWidget(fUITeam1.Mcom1team1imageWidget);
                }
                if (fUITeam2 && fUITeam2.Mcom1team1imageWidget) {
                    mod.DeleteUIWidget(fUITeam2.Mcom1team1imageWidget);
                }
                break;
            case 602:
                if (fUITeam1 && fUITeam1.Mcom2team1imageWidget) {
                    mod.DeleteUIWidget(fUITeam1.Mcom2team1imageWidget);
                }
                if (fUITeam2 && fUITeam2.Mcom2team1imageWidget) {
                    mod.DeleteUIWidget(fUITeam2.Mcom2team1imageWidget);
                }
                break;
            case 603:
                if (fUITeam1 && fUITeam1.Mcom1team2imageWidget) {
                    mod.DeleteUIWidget(fUITeam1.Mcom1team2imageWidget);
                }
                if (fUITeam2 && fUITeam2.Mcom1team2imageWidget) {
                    mod.DeleteUIWidget(fUITeam2.Mcom1team2imageWidget);
                }
                break;
            case 604:
                if (fUITeam1 && fUITeam1.Mcom2team2imageWidget) {
                    mod.DeleteUIWidget(fUITeam1.Mcom2team2imageWidget);
                }
                if (fUITeam2 && fUITeam2.Mcom2team2imageWidget) {
                    mod.DeleteUIWidget(fUITeam2.Mcom2team2imageWidget);
                }
                break;
        }

        let vfx = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Grenade_AntiTank_Detonation, mod.GetObjectPosition(this.mcomObj), mod.CreateVector(1, 1, 1));
        mod.EnableVFX(vfx, true);

        mod.Wait(4).then(() => {
            if (!vfx) {
                return;
            }
            mod.UnspawnObject(vfx);
        })

        //check all mcoms destroyed
        if (mod.Equals(this.data.ownerTeam, mod.GetTeam(1))) {
            for (const mcom of mComTeam1) {
                if (mcom.customMCOM.data.destroyed == false) {
                    return;
                }
            }

            mod.EndGameMode(mod.GetTeam(2));
        }
        else {
            for (const mcom of mComTeam2) {
                if (mcom.customMCOM.data.destroyed == false) {
                    return;
                }
            }

            mod.EndGameMode(mod.GetTeam(1));
        }


    }
}

/*-----------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------- Global Variables --------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------------------------*/

const RED = [0.89, 0.447, 0.333] as const;
const BLUE = [0.447, 0.796, 0.922] as const;

type Color = typeof RED | typeof BLUE;

const REDVEC = mod.CreateVector(0.659, 0.329, 0.247);
const BLUEVEC = mod.CreateVector(0.373, 0.608, 0.729);

let hq1AreaId: number = 2001;
let hq2AreaId: number = 3001;

let fUITeam1: FrontlinesUI | undefined;
let fUITeam2: FrontlinesUI | undefined;

let playerDataMap: Map<number, PlayerData> = new Map();
let aiSoldierMap: Map<number, mod.Player> = new Map()
let capturePointMap: Map<number, ICapturePoint> = new Map();

let matchTimer: number = 2400;
let secondTimerRunning = false;

let currentSectorIndex: number = 0;

let unitsRemainingTeam1: number = 200;
let unitsRemainingTeam2: number = 200;

/***********************************************************************************
***************************** Frontlines Setup *************************************
***********************************************************************************/

let frontlinesSettings: FrontlineSettings = {
    timeLimit: timeLimit,
    captureTime: captureTime,
    captureNeutralizationTime: captureNeutralizationTime,
    mCOMFuseTime: mCOMFuseTime,
    maxUnitsRemaining: maxUnitsRemaining,
    redeployTime: redeployTime,
    sectorTimer: sectorTimer
}

/***********************************************************************************
***************************** MCOM Setup *******************************************
***********************************************************************************/

let mComTeam1: IMCOM[] =
    [
        {
            letter: "A",
            sectorId: 10,
            areaId: 41,
            customMCOM: new CustomMCOM(601, 901, mod.GetTeam(1)),
            playerIds: [],
            player2Ids: [],
        },
        {
            letter: "B",
            sectorId: 10,
            areaId: 41,
            customMCOM: new CustomMCOM(602, 902, mod.GetTeam(1)),
            playerIds: [],
            player2Ids: [],
        },
    ];

let mComTeam2: IMCOM[] =
    [
        {
            letter: "A",
            sectorId: 20,
            areaId: 42,
            customMCOM: new CustomMCOM(603, 903, mod.GetTeam(2)),
            playerIds: [],
            player2Ids: [],
        },
        {
            letter: "B",
            sectorId: 20,
            areaId: 42,
            customMCOM: new CustomMCOM(604, 904, mod.GetTeam(2)),
            playerIds: [],
            player2Ids: [],
        },
    ];

/***********************************************************************************
******************************Sector and Flag Setup*********************************   
***********************************************************************************/

let sectors: ISector[] = [];

// outdated

// let sectors: ISector[] = [
//     {
//         letter: "A",
//         id: 101,
//         areaId: 301,
//         hqId: 401,
//         captureStatus: 0,
//         ownerTeam: mod.GetTeam(1),
//         capturePoints: new Map([
//             [201, { letter: "A", playerIds: [], player2Ids: [] }],
//         ]),
//     },
//     {
//         letter: "B",
//         id: 102,
//         areaId: 302,
//         hqId: 402,
//         captureStatus: 0,
//         ownerTeam: undefined,
//         capturePoints: new Map([
//             [202, { letter: "A", playerIds: [], player2Ids: [] }],
//             [203, { letter: "B", playerIds: [], player2Ids: [] }],
//         ]),

//     },
//     {
//         letter: "C",
//         id: 103,
//         areaId: 303,
//         hqId: 403,
//         captureStatus: 0,
//         ownerTeam: mod.GetTeam(2),
//         capturePoints: new Map([
//             [204, { letter: "A", playerIds: [], player2Ids: [] }],
//         ]),

//     }
// ];

/*----------------------------------------------------------------------------------------------------*/

let team1PlayersCount: number = 0;
let team2PlayersCount: number = 0;

/*-----------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------- UI ----------------------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------------------------*/

class FrontlinesUI {
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
        this.Mcom1team1imageWidget = modlib.ParseUI(
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

        this.Mcom2team1imageWidget = modlib.ParseUI(
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

        this.Mcom1team2imageWidget = modlib.ParseUI(
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

        this.Mcom2team2imageWidget = modlib.ParseUI(
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
        this.rootBounds = ParseUI({
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

        this.BoundsText = ParseUI({
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

    ShowCaptureUI(team: mod.Team) {
        this.rootCapture = ParseUI({
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

        this.WinTimerText = ParseUI({
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
        this.rootMCOM = modlib.ParseUI(
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

}

// -------------------- Text Sequence System --------------------

interface TextElement {
    message: mod.Message;
    anchor?: mod.UIAnchor;
    delay?: number;
    duration?: number;
    fadeInSpeed?: number;
    fadeOutDuration?: number;
    textSize?: number;
    color?: [number, number, number];
    shrinkScale?: number;
    moveDown?: number;
    offsetY?: number;
}

interface BackgroundConfig {
    position?: [number, number];
    size: [number, number];
    color: [number, number, number];
    alpha: number;
    anchor?: mod.UIAnchor;
}

interface SequenceConfig {
    background: BackgroundConfig;
    texts: TextElement[];
    player?: mod.Player;
    team?: mod.Team;
}

function animateText(
    elem: TextElement,
    root: mod.UIWidget,
    bg: BackgroundConfig,
    currentYOffset: number,
    onFinished?: () => void
): void {
    const textSize = elem.textSize ?? 36;
    const color = elem.color ?? [1, 1, 1];

    currentYOffset += elem.offsetY ?? 20;

    const textWidget = ParseUI({
        type: "Text",
        parent: root,
        size: [0, 0],
        position: [0, currentYOffset],
        anchor: elem.anchor ?? mod.UIAnchor.Center,
        textAnchor: mod.UIAnchor.Center,
        bgFill: mod.UIBgFill.None,
        textSize: textSize,
        textColor: color,
        textLabel: elem.message
    });

    if (!textWidget) {
        // Nothing to animate; still notify completion to avoid hanging the root
        if (onFinished) onFinished();
        return;
    }

    mod.SetUIWidgetVisible(textWidget, false);

    // Start fade-in sequence 
    const start = () => {
        mod.SetUIWidgetVisible(textWidget, true);

        // Fade-In
        const fadeSpeed = elem.fadeInSpeed ?? 0.03;
        const steps = Math.max(1, Math.floor(1 / fadeSpeed));
        const targetSize = mod.CreateVector(bg.size[0], textSize + 10, 1);

        let i = 0;
        const fadeInStep = () => {
            const progress = i / steps;
            const newSize = mod.CreateVector(
                mod.XComponentOf(targetSize) * progress,
                mod.YComponentOf(targetSize) * progress,
                1
            );
            mod.SetUIWidgetSize(textWidget, newSize);
            i++;
            if (i <= steps) {
                mod.Wait(fadeSpeed).then(fadeInStep);
            } else {
                // Hold then fade out
                const hold = elem.duration ?? 2.0;
                mod.Wait(hold).then(() => fadeOut());
            }
        };

        fadeInStep();
    };

    if (elem.delay && elem.delay > 0) {
        mod.Wait(elem.delay).then(start);
    } else {
        start();
    }

    // Fade-Out sequence
    const fadeOut = () => {
        const fadeOutDur = elem.fadeOutDuration ?? 1.0;
        const fadeSteps = Math.max(1, Math.floor(fadeOutDur / 0.05));
        const shrinkScale = elem.shrinkScale ?? 0.8;
        const moveDown = elem.moveDown ?? 15;

        const baseSize = mod.GetUIWidgetSize(textWidget);
        const basePos = mod.GetUIWidgetPosition(textWidget);
        if (!baseSize || !basePos) {
            // If cannot read size/pos, just hide and finish
            mod.SetUIWidgetVisible(textWidget, false);
            if (onFinished) onFinished();
            return;
        }

        let j = 0;
        const fadeOutStep = () => {
            const progress = j / fadeSteps;
            const scale = 1 - progress * (1 - shrinkScale);
            const moveY = mod.YComponentOf(basePos) + progress * moveDown;

            const newSize = mod.CreateVector(
                mod.XComponentOf(baseSize) * scale,
                mod.YComponentOf(baseSize) * scale,
                1
            );

            mod.SetUIWidgetSize(textWidget, newSize);
            mod.SetUIWidgetPosition(
                textWidget,
                mod.CreateVector(mod.XComponentOf(basePos), moveY, 1)
            );

            j++;
            if (j < fadeSteps) {
                mod.Wait(0.05).then(fadeOutStep);
            } else {
                // hide text and notify completion
                mod.SetUIWidgetVisible(textWidget, false);
                if (onFinished) onFinished();
            }
        };

        fadeOutStep();
    };
}

export function playTextSequence(config: SequenceConfig): void {
    const bg = config.background;

    const root = ParseUI({
        type: "Container",
        size: bg.size,
        position: bg.position ?? [0, 0],
        anchor: bg.anchor ?? mod.UIAnchor.Center,
        bgFill: mod.UIBgFill.Solid,
        bgColor: bg.color,
        bgAlpha: bg.alpha,
        playerId: config.player,
        teamId: config.team
    });
    if (!root) return;

    let currentYOffset = 0;
    let finishedCount = 0;
    const total = config.texts.length;

    // Completion callback: hide background after all texts are done
    const onFinished = () => {
        finishedCount++;
        if (finishedCount >= total) {
            mod.SetUIWidgetVisible(root, false);
            mod.DeleteUIWidget(root);
        }
    };

    // Schedule all text animations
    config.texts.forEach(elem => {
        const offset = currentYOffset;
        // currentYOffset += (elem.offsetY ?? 20) + (elem.textSize ?? 36);
        animateText(elem, root, bg, offset, onFinished);
    });
}

/*-----------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------- Helper Functions ------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------------------------*/

interface PlaySoundProps {
    sfxAsset: mod.RuntimeSpawn_Common; // Custom asset reference for spawning sound at runtime
    position?: mod.Vector | undefined; // Optional 3D world position for spatial playback
    volume?: number | undefined; // Optional volume multiplier: 0 is off, 1 is regular volume, 2 is double volume
    range?: number | undefined; // Optional range: only for 3D, falloff distance, radius from full to source to silence at edge of radius. Default: 1 -> radius for sound in game, 2 -> doubles it, 0 -> unhearable
    seconds?: number | undefined; // Duration in seconds for which the sound should play
    player?: mod.Player | undefined;  // Optional player to target (for local playback)
    sfx?: mod.SFX | undefined;
}

function PlaySFX(props: PlaySoundProps) {
    // Determines default values for missing properties
    const position = props.position ?? mod.CreateVector(0, 0, 0);
    const seconds = props.seconds ?? 5;
    const volume = props.volume ?? 1;
    const range = props.range ?? 1;
    let playerValid = props.player && mod.IsPlayerValid(props.player);

    let sfx: mod.SFX = props.sfx ?? mod.SpawnObject(props.sfxAsset, position, mod.CreateVector(0, 0, 0));

    if (!props.position && playerValid) {
        mod.PlaySound(sfx, volume, props.player!);
    }
    else if (!props.position) {
        mod.PlaySound(sfx, volume);
    }
    else if (playerValid) {
        mod.PlaySound(sfx, volume, position, range, props.player!);
    } else {
        mod.PlaySound(sfx, volume, position, range);
    }

    mod.Wait(seconds).then(() => {
        mod.StopSound(sfx);
        if (!props.sfx) {
            mod.UnspawnObject(sfx);
        }
    });
}

function updateTimerUI(prophunt_ui: FrontlinesUI): void {
    const minutes = Math.floor(matchTimer / 60);
    const seconds = matchTimer % 60;

    let subMinutes = '';
    let subSeconds = '';

    if (!prophunt_ui.WinTimerText) {
        return;
    }

    if (minutes < 10 && seconds < 10) {
        mod.SetUITextLabel(prophunt_ui.WinTimerText, mod.Message(mod.stringkeys.time1MSG, minutes, seconds));
    }
    else if (minutes < 10) {
        mod.SetUITextLabel(prophunt_ui.WinTimerText, mod.Message(mod.stringkeys.time2MSG, minutes, seconds));
    }
    else if (seconds < 10) {
        mod.SetUITextLabel(prophunt_ui.WinTimerText, mod.Message(mod.stringkeys.time3MSG, minutes, seconds));
    }
    else {
        mod.SetUITextLabel(prophunt_ui.WinTimerText, mod.Message(mod.stringkeys.time4MSG, minutes, seconds));

    }
}

function getRandomInt(max: number) {
    return Math.floor(Math.random() * max);
}

function GetPlayerFromId(playerId: number): mod.Player | null {
    const players = mod.AllPlayers();
    for (let i = 0; i < mod.CountOf(players); i++) {
        const p = mod.ValueInArray(players, i);
        if (modlib.getPlayerId(p) === playerId) {
            return p;
        }
    }
    return null;
}

function updateProgressBar(progressBarBG: mod.UIWidget, progressBarFill: mod.UIWidget, value: number, min: number, max: number): void {
    if (value < min) value = min;
    if (value > max) value = max;

    let progress: number = (value - min) / (max - min);

    const bgSize = mod.GetUIWidgetSize(progressBarBG);

    let newSize: mod.Vector = mod.CreateVector(mod.XComponentOf(bgSize) * progress, mod.YComponentOf(bgSize), mod.ZComponentOf(bgSize));

    mod.SetUIWidgetSize(progressBarFill, newSize);

}

function getAllNearbyPlayer(location: mod.Vector, radius: number): any[] {
    const allPlayers = [
        ...modlib.getPlayersInTeam(mod.GetTeam(1)),
        ...modlib.getPlayersInTeam(mod.GetTeam(2))
    ];

    let nearbyPlayers: any[] = [];
    for (const player of allPlayers) {
        if (mod.DistanceBetween(location, mod.GetObjectPosition(player)) <= radius) {
            nearbyPlayers.push(player);
        }
    }

    return nearbyPlayers; //Player[] as type
}

function getPlayersInTeam(team: number): any[] {
    let players = modlib.ConvertArray(mod.AllPlayers());
    let playersInTeam = [];
    for (const player of players) {
        if (mod.Equals(mod.GetTeam(player), mod.GetTeam(team))) {
            playersInTeam.push(player);
        }
    }

    return playersInTeam;
}

function secondTimer(): void {
    secondTimerRunning = true;
    mod.Wait(1).then(() => {
        //Timer update
        matchTimer--;
        if (fUITeam1 && fUITeam2) {
            updateTimerUI(fUITeam1);
            updateTimerUI(fUITeam2);
        }
        if (matchTimer == 0) {
            //Time over
            if (currentSectorIndex > sectors.length - 1) {
                mod.EndGameMode(mod.GetTeam(1));
            }
            else {
                mod.EndGameMode(mod.GetTeam(2));
            }

            return;
        }
        secondTimer();
    })
}

function findCapturePoint(capturePoint: mod.CapturePoint): ICapturePoint | undefined {
    for (const sector of sectors) {
        let point = sector.capturePoints.get(mod.GetObjId(capturePoint));
        if (point) {
            return point;
        }
    }
    return undefined;
}

function getConquerMessageFromSector(): mod.Message {
    let result = mod.Message(mod.stringkeys.conquerSectorAMSG);

    let sector = sectors[currentSectorIndex];
    if (sectors) {
        switch (sector.letter) {
            case "A":
                mod.Message(mod.stringkeys.conquerSectorAMSG);
                break;
            case "B":
                mod.Message(mod.stringkeys.conquerSectorBMSG);
                break;
            case "C":
                mod.Message(mod.stringkeys.conquerSectorCMSG);
                break;
        }
    }

    return result;
}

function getLooseMessageFromSector(): mod.Message {
    let result = mod.Message(mod.stringkeys.conquerSectorAMSG);

    let sector = sectors[currentSectorIndex];
    if (sectors) {
        switch (sector.letter) {
            case "A":
                mod.Message(mod.stringkeys.looseSectorAMSG);
                break;
            case "B":
                mod.Message(mod.stringkeys.looseSectorBMSG);
                break;
            case "C":
                mod.Message(mod.stringkeys.looseSectorCMSG);
                break;
            case "D":
                mod.Message(mod.stringkeys.looseSectorDMSG);
                break;
            case "E":
                mod.Message(mod.stringkeys.looseSectorEMSG);
                break;
            case "F":
                mod.Message(mod.stringkeys.looseSectorFMSG);
                break;
            case "G":
                mod.Message(mod.stringkeys.looseSectorGMSG);
                break;
        }
    }

    return result;
}

function autoTeamBalanceJoin(joinedPlayer: mod.Player): void {
    if (mod.GetSoldierState(joinedPlayer, mod.SoldierStateBool.IsAISoldier)) {
        return;
    }
    console.log("Team1Count:" + team1PlayersCount + " Team2Count:" + team2PlayersCount);

    if (team1PlayersCount < team2PlayersCount) {
        mod.SetTeam(joinedPlayer, mod.GetTeam(1));
        team1PlayersCount++;
    }
    else if (team1PlayersCount > team2PlayersCount) {
        mod.SetTeam(joinedPlayer, mod.GetTeam(2));
        team2PlayersCount++;
    }
    else {
        mod.SetTeam(joinedPlayer, mod.GetTeam(1));
        team1PlayersCount++;
    }
}

function autoTeamBalanceLeave(moveLastPlayers: boolean, minMoveDiff: number): void {
    let team1Players = modlib.getPlayersInTeam(mod.GetTeam(1));
    let team2Players = modlib.getPlayersInTeam(mod.GetTeam(2));

    team1PlayersCount = team1Players.length;
    team2PlayersCount = team2Players.length;

    if (moveLastPlayers) {
        const diff = team1PlayersCount - team2PlayersCount;
        if (diff * -1 < minMoveDiff) {
            return;
        }

        if (diff > 0) {
            for (let i = 0; i < diff; i++) {
                let playerIndex = team1PlayersCount - i;
                let playerToMove = team1Players[playerIndex];

                mod.SetTeam(playerToMove, mod.GetTeam(2));
            }
        }
        else {
            for (let i = 0; i < diff; i++) {
                let playerIndex = team2PlayersCount - i;
                let playerToMove = team2Players[playerIndex];

                mod.SetTeam(playerToMove, mod.GetTeam(1));
            }

        }
    }
}

/*-----------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------- Gameplay Functions ------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------------------------*/

function updateSectorsState(): void {
    let currentSector = sectors[currentSectorIndex];

    //disable all sectors
    for (const sectorObj of sectors) {

        // let sectorObject = mod.GetSector(sectorObj.id);
        // if (sectorObject) {
        //     mod.EnableGameModeObjective(sectorObject, false);
        // }

        //disable all areas
        // let area = mod.GetAreaTrigger(sectorObj.areaId);
        // if (area) {
        //     mod.EnableAreaTrigger(area, false);
        // }

        for (const [id, data] of sectorObj.capturePoints) {
            let point = mod.GetCapturePoint(id);
            if (point) {
                mod.EnableGameModeObjective(point, false);
            }
        }
    }

    //disable mcom sectors
    mod.EnableGameModeObjective(mod.GetSector(mComTeam1[0].sectorId), false);
    mod.EnableGameModeObjective(mod.GetSector(mComTeam2[0].sectorId), false);

    for (const mcom of mComTeam1) {
        mcom.customMCOM.activateMCOM(false);

        //disable all areas
        let area = mod.GetAreaTrigger(mcom.areaId);
        if (area) {
            mod.EnableAreaTrigger(area, false);
        }

    }

    for (const mcom of mComTeam2) {
        mod.EnableGameModeObjective(mod.GetMCOM(mcom.customMCOM.data.id), false);
        mcom.customMCOM.activateMCOM(false);

        //disable all areas
        let area = mod.GetAreaTrigger(mcom.areaId);
        if (area) {
            mod.EnableAreaTrigger(area, false);
        }
    }

    //hq mcoms reached
    if (currentSectorIndex == -1) {
        mod.LoadMusic(mod.MusicPackages.Core);
        mod.PlayMusic(mod.MusicEvents.Core_LastPhaseBegin);

        unitsRemainingTeam1 = frontlinesSettings.maxUnitsRemaining;
        unitsRemainingTeam2 = frontlinesSettings.maxUnitsRemaining;

        if (fUITeam1 && fUITeam2) {
            if (fUITeam1.rootCapture) {
                mod.SetUIWidgetVisible(fUITeam1.rootCapture, false);
            }
            if (fUITeam2.rootCapture) {
                mod.SetUIWidgetVisible(fUITeam2.rootCapture, false);
            }

            fUITeam1.ShowMCOMUI(mod.GetTeam(1), RED, true);
            fUITeam2.ShowMCOMUI(mod.GetTeam(2), BLUE, true);

            if (fUITeam1.rootMCOM) {
                let remainingTeam1Text = mod.FindUIWidgetWithName("UnitsRemainingText", fUITeam1.rootMCOM);
                if (remainingTeam1Text) {
                    mod.SetUITextLabel(remainingTeam1Text, mod.Message(mod.stringkeys.UnitsRemainingText, unitsRemainingTeam2));
                    let unitsRemainingFill = mod.FindUIWidgetWithName("UnitsRemainingFill", fUITeam1.rootMCOM);
                    if (unitsRemainingFill) {
                        mod.SetUIWidgetSize(unitsRemainingFill, mod.CreateVector((unitsRemainingTeam2 / frontlinesSettings.maxUnitsRemaining) * 100, 25, 0));
                    }
                }
            }

            if (fUITeam2.rootMCOM) {
                let remainingTeam2Text = mod.FindUIWidgetWithName("UnitsRemainingText", fUITeam2.rootMCOM);
                if (remainingTeam2Text) {
                    mod.SetUITextLabel(remainingTeam2Text, mod.Message(mod.stringkeys.UnitsRemainingText, unitsRemainingTeam2));
                    let unitsRemainingFill = mod.FindUIWidgetWithName("UnitsRemainingFill", fUITeam2.rootMCOM);
                    if (unitsRemainingFill) {
                        mod.SetUIWidgetSize(unitsRemainingFill, mod.CreateVector((unitsRemainingTeam2 / frontlinesSettings.maxUnitsRemaining) * 100, 25, 0));
                    }
                }
            }
        }

        let sector = mod.GetSector(mComTeam1[0].sectorId);
        if (sector) {
            mod.EnableGameModeObjective(sector, true);
        }

        for (const mcom of mComTeam1) {
            mod.SetMCOMOwner(mod.GetMCOM(mcom.customMCOM.data.id), mod.GetTeam(1));
            mcom.customMCOM.activateMCOM(true);

            //enable new area
            let area = mod.GetAreaTrigger(mcom.areaId);
            if (area) {
                mod.EnableAreaTrigger(area, true);
            }
        }

        return;
    }
    else if (currentSectorIndex == sectors.length) {
        mod.LoadMusic(mod.MusicPackages.Core);
        mod.PlayMusic(mod.MusicEvents.Core_LastPhaseBegin);
        unitsRemainingTeam1 = frontlinesSettings.maxUnitsRemaining;
        unitsRemainingTeam2 = frontlinesSettings.maxUnitsRemaining;


        if (fUITeam1 && fUITeam2) {
            fUITeam1.ShowMCOMUI(mod.GetTeam(1), RED, true);
            fUITeam2.ShowMCOMUI(mod.GetTeam(2), BLUE, true);

            if (fUITeam1.rootCapture) {
                mod.SetUIWidgetVisible(fUITeam1.rootCapture, false);
            }
            if (fUITeam2.rootCapture) {
                mod.SetUIWidgetVisible(fUITeam2.rootCapture, false);
            }

            if (fUITeam1.rootMCOM) {
                let remainingTeam1Text = mod.FindUIWidgetWithName("UnitsRemainingText", fUITeam1.rootMCOM);
                if (remainingTeam1Text) {
                    mod.SetUITextLabel(remainingTeam1Text, mod.Message(mod.stringkeys.UnitsRemainingText, unitsRemainingTeam1));
                    let unitsRemainingFill = mod.FindUIWidgetWithName("UnitsRemainingFill", fUITeam1.rootMCOM);
                    if (unitsRemainingFill) {
                        mod.SetUIWidgetSize(unitsRemainingFill, mod.CreateVector((unitsRemainingTeam1 / frontlinesSettings.maxUnitsRemaining) * 100, 25, 0));
                    }
                }
            }

            if (fUITeam2.rootMCOM) {
                let remainingTeam2Text = mod.FindUIWidgetWithName("UnitsRemainingText", fUITeam2.rootMCOM);
                if (remainingTeam2Text) {
                    mod.SetUITextLabel(remainingTeam2Text, mod.Message(mod.stringkeys.UnitsRemainingText, unitsRemainingTeam1));
                    let unitsRemainingFill = mod.FindUIWidgetWithName("UnitsRemainingFill", fUITeam2.rootMCOM);
                    if (unitsRemainingFill) {
                        mod.SetUIWidgetSize(unitsRemainingFill, mod.CreateVector((unitsRemainingTeam1 / frontlinesSettings.maxUnitsRemaining) * 100, 25, 0));
                    }
                }
            }
        }

        let sector = mod.GetSector(mComTeam2[0].sectorId);
        if (sector) {
            mod.EnableGameModeObjective(sector, true);
        }

        for (const mcom of mComTeam2) {
            mod.SetMCOMOwner(mod.GetMCOM(mcom.customMCOM.data.id), mod.GetTeam(2));
            mcom.customMCOM.activateMCOM(true);
            console.log('mcom: ' + mcom.customMCOM.data.id + ' activated');

            //enable new area
            let area = mod.GetAreaTrigger(mcom.areaId);
            if (area) {
                mod.EnableAreaTrigger(area, true);
            }
        }

        return;
    }

    //enable new sector
    let sectorObject = mod.GetSector(currentSector.id);
    if (sectorObject) {
        mod.EnableGameModeObjective(sectorObject, true);

        if (fUITeam1 && fUITeam2) {
            if (fUITeam1.rootCapture) {
                mod.SetUIWidgetVisible(fUITeam1.rootCapture, true);
            }
            if (fUITeam2.rootCapture) {
                mod.SetUIWidgetVisible(fUITeam2.rootCapture, true);
            }
            if (fUITeam1.rootMCOM) {
                mod.SetUIWidgetVisible(fUITeam1.rootMCOM, false);
            }
            if (fUITeam2.rootMCOM) {
                mod.SetUIWidgetVisible(fUITeam2.rootMCOM, false);
            }

        }

        //enable new area
        let area = mod.GetAreaTrigger(currentSector.areaId);
        if (area) {
            mod.EnableAreaTrigger(area, true);
        }

        for (const [id, data] of currentSector.capturePoints) {
            let point = mod.GetCapturePoint(id);
            if (point) {
                mod.EnableGameModeObjective(point, true);
                //reset capture point
                mod.SetCapturePointOwner(point, mod.GetTeam(3));
                console.log("CurrentSector: " + currentSector.letter + " ObjectiveEnabled: " + data.letter + " ID: " + id);
                //mod.SetCapturePointOwner(point, mod.GetTeam(0));
            }
        }
    }
}

function startCapture(): void {
    let middleSectorIndex = Math.ceil(sectors.length / 2) - 1;

    currentSectorIndex = middleSectorIndex;
    // currentSectorIndex = 3;

    for (const sector of sectors) {
        //disable all HQs
        let hq = mod.GetHQ(sector.hqId);
        if (hq) {
            mod.EnableHQ(hq, false);
        }
    }

    let hq1 = mod.GetHQ(sectors[currentSectorIndex - 1].hqId);
    if (hq1) {
        mod.SetHQTeam(hq1, mod.GetTeam(1));
        mod.EnableHQ(hq1, true);

    }

    let hq2 = mod.GetHQ(sectors[currentSectorIndex + 1].hqId);
    if (hq2) {
        mod.SetHQTeam(hq2, mod.GetTeam(2));
        mod.EnableHQ(hq2, true);
    }

    updateSectorsState();
}

function checkSectorCaptured(): { captured: boolean, team: mod.Team | null, letter: string } {
    let currentSector = sectors[currentSectorIndex];
    if (!currentSector)
        return { captured: false, team: null, letter: 'A' };

    let ownerTeam = null;

    for (const [id, pointData] of currentSector.capturePoints) {
        let capturePoint = mod.GetCapturePoint(id);
        if (!capturePoint) continue;

        let team = mod.GetCurrentOwnerTeam(capturePoint);

        if (team === null || team === undefined || mod.Equals(team, mod.GetTeam(3))) {
            return { captured: false, team: null, letter: pointData.letter };
        }

        if (ownerTeam === null) {
            ownerTeam = team;
        }

        else if (!mod.Equals(team, ownerTeam)) {
            return { captured: false, team: null, letter: pointData.letter };
        }
    }

    return { captured: ownerTeam !== null, team: ownerTeam, letter: 'A' };
}

function nextSector(team: mod.Team): void {
    mod.LoadMusic(mod.MusicPackages.Core);
    mod.PlayMusic(mod.MusicEvents.Core_PhaseBegin);

    mod.Wait(5).then(() => {
        mod.UnloadMusic(mod.MusicPackages.Core);
    })

    for (const sector of sectors) {
        //disable all HQs
        let hq = mod.GetHQ(sector.hqId);
        if (hq) {
            mod.EnableHQ(hq, false);
        }
    }

    if (mod.Equals(team, mod.GetTeam(1))) {
        const sectorConquerMessage: mod.Message = getConquerMessageFromSector();
        const sectorLooseMessage: mod.Message = getLooseMessageFromSector();

        mod.Wait(6).then(() => {
            let vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
            mod.PlayVO(vo, mod.VoiceOverEvents2D.SectorTakenAttacker, mod.VoiceOverFlags.Alpha, team);


            mod.Wait(6).then(() => {
                if (vo) {
                    mod.UnspawnObject(vo);
                }
            })
        })

        currentSectorIndex++;

        //MCOM Sector reached
        // if (currentSectorIndex > sectors.length) {
        //     hq1 = mod.GetHQ(sectors[sectors.length - 1].hqId);
        //     if (hq1) {
        //         mod.EnableHQ(hq1, true);
        //         mod.SetHQTeam(hq1, team);
        //     }
        // }

        // if (currentSectorIndex == -1) {
        //     let hq2 = mod.GetHQ(sectors[0].hqId);
        //     if (hq2) {
        //         mod.EnableHQ(hq2, true);
        //         mod.SetHQTeam(hq2, mod.GetTeam(2));
        //     }
        // }

        playTextSequence({
            background: {
                position: [100, 100],
                anchor: mod.UIAnchor.TopLeft,
                size: [400, 40],
                color: [0, 0.5, 0],
                alpha: 0.8,
            },
            texts: [
                {
                    message: sectorConquerMessage,
                    duration: 5,
                    fadeInSpeed: 0.1,
                    fadeOutDuration: 0.2,
                    textSize: 30,
                    color: [1, 1, 1],
                    shrinkScale: 0.85,
                    moveDown: 20,
                    offsetY: 0
                },
                {
                    message: mod.Message(mod.stringkeys.conquerNextSectorMSG),
                    delay: 6,
                    duration: 5,
                    fadeInSpeed: 0.1,
                    fadeOutDuration: 0.2,
                    textSize: 30,
                    color: [1, 1, 1],
                    shrinkScale: 0.85,
                    moveDown: 20,
                    offsetY: 0
                },
            ],
            team: mod.GetTeam(1)
        });

        playTextSequence({
            background: {
                position: [100, 100],
                anchor: mod.UIAnchor.TopLeft,
                size: [400, 40],
                color: [0, 0.5, 0],
                alpha: 0.8,
            },
            texts: [
                {
                    message: sectorLooseMessage,
                    duration: 5,
                    fadeInSpeed: 0.1,
                    fadeOutDuration: 0.2,
                    textSize: 30,
                    color: [1, 1, 1],
                    shrinkScale: 0.85,
                    moveDown: 20,
                    offsetY: 0
                },
                {
                    message: mod.Message(mod.stringkeys.defendNextSectorMSG),
                    delay: 6,
                    duration: 5,
                    fadeInSpeed: 0.1,
                    fadeOutDuration: 0.2,
                    textSize: 30,
                    color: [1, 1, 1],
                    shrinkScale: 0.85,
                    moveDown: 20,
                    offsetY: 0
                },
            ],
            team: mod.GetTeam(2)
        });
    }
    else {
        const sectorConquerMessage: mod.Message = getConquerMessageFromSector();
        const sectorLooseMessage: mod.Message = getLooseMessageFromSector();

        mod.Wait(6).then(() => {
            let vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
            mod.PlayVO(vo, mod.VoiceOverEvents2D.SectorTakenAttacker, mod.VoiceOverFlags.Alpha, team);


            mod.Wait(6).then(() => {
                if (vo) {
                    mod.UnspawnObject(vo);
                }
            })
        })

        currentSectorIndex--;

        playTextSequence({
            background: {
                position: [100, 100],
                anchor: mod.UIAnchor.TopLeft,
                size: [400, 40],
                color: [0, 0.5, 0],
                alpha: 0.8,
            },
            texts: [
                {
                    message: sectorConquerMessage,
                    duration: 5,
                    fadeInSpeed: 0.1,
                    fadeOutDuration: 0.2,
                    textSize: 30,
                    color: [1, 1, 1],
                    shrinkScale: 0.85,
                    moveDown: 20,
                    offsetY: 0
                },
                {
                    message: mod.Message(mod.stringkeys.conquerNextSectorMSG),
                    delay: 6,
                    duration: 5,
                    fadeInSpeed: 0.1,
                    fadeOutDuration: 0.2,
                    textSize: 30,
                    color: [1, 1, 1],
                    shrinkScale: 0.85,
                    moveDown: 20,
                    offsetY: 0
                },
            ],
            team: mod.GetTeam(2)
        });

        playTextSequence({
            background: {
                position: [100, 100],
                anchor: mod.UIAnchor.TopLeft,
                size: [400, 40],
                color: [0, 0.5, 0],
                alpha: 0.8,
            },
            texts: [
                {
                    message: sectorLooseMessage,
                    duration: 5,
                    fadeInSpeed: 0.1,
                    fadeOutDuration: 0.2,
                    textSize: 30,
                    color: [1, 1, 1],
                    shrinkScale: 0.85,
                    moveDown: 20,
                    offsetY: 0
                },
                {
                    message: mod.Message(mod.stringkeys.defendNextSectorMSG),
                    delay: 6,
                    duration: 5,
                    fadeInSpeed: 0.1,
                    fadeOutDuration: 0.2,
                    textSize: 30,
                    color: [1, 1, 1],
                    shrinkScale: 0.85,
                    moveDown: 20,
                    offsetY: 0
                },
            ],
            team: mod.GetTeam(1)
        });
    }

    updateSectorsState();

    //enable new HQ for pusher
    let lastSector = sectors[currentSectorIndex - 1];

    let hq1 = mod.GetHQ(lastSector.hqId);
    if (hq1) {
        mod.SetHQTeam(hq1, mod.GetTeam(1));
        mod.EnableHQ(hq1, true);

        console.log("PusherHQ:" + lastSector.hqId);
    }

    mod.Wait(2).then(() => {
        //enable new HQ for defender
        // let defenderTeam = mod.Equals(team, mod.GetTeam(1))? mod.GetTeam(2): mod.GetTeam(1);

        let lastDefenderSector = sectors[currentSectorIndex + 1];

        let hq2 = mod.GetHQ(lastDefenderSector.hqId);
        if (hq2) {
            mod.SetHQTeam(hq2, mod.GetTeam(2));
            mod.EnableHQ(hq2, true);

            console.log("DefenderHQ:" + lastDefenderSector.hqId);
        }
    })

    //deactivate objectives and spawn icons
    let currentSector = sectors[currentSectorIndex];
    let objectiveIcons: mod.WorldIcon[] = [];

    for (const [id, data] of currentSector.capturePoints) {
        let point = mod.GetCapturePoint(id);
        if (point) {
            mod.EnableGameModeObjective(point, false);
        }

        //spawn objective Icons
        objectiveIcons.push(mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, mod.GetObjectPosition(point), mod.CreateVector(0, 0, 0), mod.CreateVector(1, 1, 1)));
        for (const icon of objectiveIcons) {
            mod.EnableWorldIconImage(icon, true);
            mod.SetWorldIconImage(icon, mod.WorldIconImages.Flag);
            mod.SetWorldIconColor(icon, mod.CreateVector(1, 1, 1));
        }
    }

    //ai behaviour
    for (let [key, value] of aiSoldierMap) {
        let points = Array.from(currentSector.capturePoints.keys());

        let goalPoint: mod.CapturePoint | undefined = mod.GetCapturePoint(points[getRandomInt(points.length - 1)]);
        if (goalPoint) {
            mod.AIValidatedMoveToBehavior(value, mod.GetObjectPosition(goalPoint));
        }
    }

    //next sector timer
    let sectorTimer = frontlinesSettings.sectorTimer;

    let timer1: mod.UIWidget | undefined;
    let timer2: mod.UIWidget | undefined;
    let text1: mod.UIWidget | undefined;
    let text2: mod.UIWidget | undefined;

    if (fUITeam1 && fUITeam1.rootCapture) {
        timer1 = mod.FindUIWidgetWithName("ST1" + sectors[currentSectorIndex].letter + "Timer", fUITeam1.rootCapture);
        text1 = mod.FindUIWidgetWithName("ST1" + sectors[currentSectorIndex].letter + "Text", fUITeam1.rootCapture);
        mod.SetUIWidgetVisible(text1, false);
        mod.SetUIWidgetVisible(timer1, true);
    }

    if (fUITeam2 && fUITeam2.rootCapture) {
        timer2 = mod.FindUIWidgetWithName("ST2" + sectors[currentSectorIndex].letter + "Timer", fUITeam2.rootCapture);
        text2 = mod.FindUIWidgetWithName("ST2" + sectors[currentSectorIndex].letter + "Text", fUITeam2.rootCapture);
        mod.SetUIWidgetVisible(text2, false);
        mod.SetUIWidgetVisible(timer2, true);
    }

    timer();

    function timer() {

        sectorTimer--;

        if (timer1) {
            mod.SetUITextLabel(timer1, mod.Message(mod.stringkeys.sectorTimer, sectorTimer));
        }

        if (timer2) {
            mod.SetUITextLabel(timer2, mod.Message(mod.stringkeys.sectorTimer, sectorTimer));
        }

        if (sectorTimer <= 0) {

            if (text1) mod.SetUIWidgetVisible(text1, true);
            if (text2) mod.SetUIWidgetVisible(text2, true);

            if (timer1) mod.SetUIWidgetVisible(timer1, false);
            if (timer2) mod.SetUIWidgetVisible(timer2, false);

            //activate capture points
            for (const [id, data] of currentSector.capturePoints) {
                let point = mod.GetCapturePoint(id);
                if (point) {
                    mod.EnableGameModeObjective(point, true);
                }
            }

            //clear world icons
            for (const icon of objectiveIcons) {
                mod.EnableWorldIconImage(icon, false);
                mod.UnspawnObject(icon);
            }

            objectiveIcons = [];

            //ai behaviour
            for (let [key, value] of aiSoldierMap) {

                mod.AIBattlefieldBehavior(value);
            }

            return;
        }

        mod.Wait(1).then(timer);
    }

}

function createSectors(): void {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

    for (let sectorId = 101; sectorId <= 110; sectorId++) {
        const sector = mod.GetSector(sectorId);
        if (!sector) continue;

        const capturePoints: Map<number, ICapturePoint> = new Map();

        const baseId = (sectorId - 101) * 100 + 1001;

        for (let cpId = baseId; cpId < baseId + 10; cpId++) {
            const capturePoint = mod.GetCapturePoint(cpId);
            if (capturePoint) {
                capturePoints.set(cpId, {
                    letter: letters[cpId - baseId],
                    playerIds: [],
                    player2Ids: []
                });

                //  console.log("Sector: " + letters[sectorId - 101] + " CapturePoint: " + letters[cpId - baseId]);
            }
        }

        const newSector: ISector = {
            letter: letters[sectorId - 101],
            id: sectorId,
            areaId: sectorId + 200,
            hqId: sectorId + 300,
            captureStatus: 0,
            ownerTeam: undefined,
            capturePoints: capturePoints
        };

        sectors.push(newSector);

    }

    // set owner teams of sectors
    const middleIndex = Math.floor(sectors.length / 2);

    // left side team 1
    for (let i = 0; i < middleIndex; i++) {
        sectors[i].ownerTeam = mod.GetTeam(1);
    }

    // right side team 2
    for (let i = middleIndex + 1; i < sectors.length; i++) {
        sectors[i].ownerTeam = mod.GetTeam(2);
    }
}

function updateScoreboard(player: mod.Player, data: PlayerData): void {
    mod.SetScoreboardPlayerValues(player, data.stats.captures, data.stats.kd, data.stats.kills, data.stats.deaths, data.stats.assists);
}

function setModeSettings(): void {
    matchTimer = frontlinesSettings.timeLimit * 60;

    for (const sector of sectors) {
        for (const point of sector.capturePoints) {
            mod.EnableCapturePointDeploying(mod.GetCapturePoint(point[0]), false);
            mod.SetCapturePointCapturingTime(mod.GetCapturePoint(point[0]), frontlinesSettings.captureTime);
            mod.SetCapturePointNeutralizationTime(mod.GetCapturePoint(point[0]), frontlinesSettings.captureNeutralizationTime);

            mod.SetAllObjectivesUIEnabled(true);
        }
    }

    for (const mcom of mComTeam1) {
        mod.SetMCOMFuseTime(mod.GetMCOM(mcom.customMCOM.data.id), frontlinesSettings.mCOMFuseTime);
    }

    for (const mcom of mComTeam2) {
        mod.SetMCOMFuseTime(mod.GetMCOM(mcom.customMCOM.data.id), frontlinesSettings.mCOMFuseTime);
    }
}

function enableOutOfBounds(player: mod.Player): void {
    let timer: number = 10;

    let playerData = playerDataMap.get(modlib.getPlayerId(player));
    if (playerData && playerData.ui) {
        playerData.inBounds = false;
        playerData.ui.ShowBoundsUI(player, true);
    }

    function loop() {
        if (playerData) {
            if (playerData.inBounds) {
                return;
            }
        }
        timer--;

        if (playerData && playerData.ui && playerData.ui.BoundsText) {
            mod.SetUITextLabel(playerData.ui.BoundsText, mod.Message(mod.stringkeys.boundsMSG, timer));
        }

        if (timer <= 0) {
            if (playerData && playerData.ui) {
                playerData.ui.ShowBoundsUI(player, false);
            }

            mod.UndeployPlayer(player);
            return;
        }

        mod.Wait(1).then(loop);
    }

    loop();
    return;
}

function checkPlayerEnteredAllowedZone(player: mod.Player, eventAreaTrigger: mod.AreaTrigger): void {
    console.log('EventAreaTrigger Id: ' + mod.GetObjId(eventAreaTrigger));
    //disable outofbounds
    let playerData = playerDataMap.get(modlib.getPlayerId(player));
    if (playerData && playerData.ui) {
        playerData.inBounds = true;
        playerData.ui.ShowBoundsUI(player, false);
    }

    //check if in enemy hq
    if (mod.Equals(mod.GetTeam(player), mod.GetTeam(1))) {
        console.log('InAreaTrigger Id: ' + hq2AreaId);

        if (hq2AreaId == mod.GetObjId(eventAreaTrigger)) {
            console.log('in enemy hq team 2');
            enableOutOfBounds(player);
            return;
        }

    }
    else {
        if (hq1AreaId == mod.GetObjId(eventAreaTrigger)) {
            console.log('in enemy hq team 1');
            enableOutOfBounds(player);
            return;
        }
    }

    for (const sector of sectors) {
        if (sector.areaId == mod.GetObjId(eventAreaTrigger)) {
            //neutral sector
            if (sector.ownerTeam == undefined) {
                console.log('neutral sector');
                return;
            }
            //current objective sector
            if (sectors[currentSectorIndex].id == sector.id) {
                console.log('current objective sector');
                return;
            }
            //check if enemy area of sector
            if (mod.Equals(mod.GetTeam(player), sector.ownerTeam) == false) {
                //Out of bounds
                console.log('in enemy sector');
                enableOutOfBounds(player);
            }
        }

    }
}


/*-----------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------- Events ------------------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------------------------*/

export function OnPlayerEnterAreaTrigger(eventPlayer: mod.Player, eventAreaTrigger: mod.AreaTrigger): void {
    checkPlayerEnteredAllowedZone(eventPlayer, eventAreaTrigger);
    // outdated
    // let area = mod.GetAreaTrigger(sectors[currentSectorIndex].areaId)
    // if (!area) {
    //     return;
    // }
    // if (mod.Equals(area, eventAreaTrigger)) {
    //     let playerData = playerDataMap.get(modlib.getPlayerId(eventPlayer));

    //     if (playerData && playerData.ui) {
    //         playerData.inBounds = true;
    //         playerData.ui.ShowBoundsUI(eventPlayer, false);
    //     }
    // }
    //mcom arm/fuse area
    // else if (currentSectorIndex == -1) {
    //     for (const mcom of mComTeam1) {
    //         let areaObj = mod.GetAreaTrigger(mcom.customMCOM.data.interactionAreaId);
    //         if (areaObj) {
    //             if (mod.Equals(areaObj, eventAreaTrigger)) {

    //                 return;
    //             }
    //         }
    //     }
    // }
    // else if (currentSectorIndex == 3) {
    //     for (const mcom of mComTeam2) {
    //         let areaObj = mod.GetAreaTrigger(mcom.customMCOM.data.interactionAreaId);
    //         if (areaObj) {
    //             if (mod.Equals(areaObj, eventAreaTrigger)) {

    //                 return;
    //             }
    //         }
    //     }
    // }
}

export function OnMCOMArmed(eventMCOM: mod.MCOM): void {
    // outdated
    // let ownerMCOM: IMCOM | undefined;

    // let sfxArmed = mod.GetSFX(mod.RuntimeSpawn_Common.SFX_GameModes_Rush_Armed_OneShot3D);
    // if (sfxArmed) {
    //     mod.PlaySound(sfxArmed, 1, mod.GetObjectPosition(eventMCOM), 1);
    // }

    // let sfxAlarm = mod.GetSFX(mod.RuntimeSpawn_Common.SFX_GameModes_Rush_Alarm_SimpleLoop3D);
    // if (sfxAlarm) {
    //     mod.PlaySound(sfxAlarm, 1, mod.GetObjectPosition(eventMCOM), 1);
    // }

    // for (const mcom of mComTeam1) {
    //     let mcomObj = mod.GetMCOM(mcom.customMCOM.data.id);
    //     if (mod.Equals(mcomObj, eventMCOM)) {
    //         ownerMCOM = mcom;
    //     }
    // }

    // for (const mcom of mComTeam2) {
    //     let mcomObj = mod.GetMCOM(mcom.customMCOM.data.id);
    //     if (mod.Equals(mcomObj, eventMCOM)) {
    //         ownerMCOM = mcom;
    //     }
    // }

    // if (!ownerMCOM) {
    //     return;
    // }

    // //vo
    // if (mod.Equals(ownerMCOM.customMCOM.data.ownerTeam, mod.GetTeam(1))) {
    //     let vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
    //     mod.PlayVO(vo, mod.VoiceOverEvents2D.MComDefuseEnemy, mod.VoiceOverFlags.Alpha, mod.GetTeam(2));

    //     mod.PlayVO(vo, mod.VoiceOverEvents2D.MComArmFriendly, mod.VoiceOverFlags.Alpha, mod.GetTeam(1));

    //     mod.Wait(8).then(() => {
    //         if (vo) {
    //             mod.UnspawnObject(vo);
    //         }
    //     })


    // }
    // else {
    //     let vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
    //     mod.PlayVO(vo, mod.VoiceOverEvents2D.MComArmFriendly, mod.VoiceOverFlags.Alpha, mod.GetTeam(1));

    //     mod.PlayVO(vo, mod.VoiceOverEvents2D.MComArmEnemy, mod.VoiceOverFlags.Alpha, mod.GetTeam(2));

    //     mod.Wait(8).then(() => {
    //         if (vo) {
    //             mod.UnspawnObject(vo);
    //         }
    //     })
    // }
}

export function OnMCOMDefused(eventMCOM: mod.MCOM): void {
    // let sfxDefused = mod.GetSFX(mod.RuntimeSpawn_Common.SFX_GameModes_Rush_Armed_OneShot3D);
    // if (sfxDefused) {
    //     mod.PlaySound(sfxDefused, 1, mod.GetObjectPosition(eventMCOM), 1);
    // }

    // let sfxAlarm = mod.GetSFX(mod.RuntimeSpawn_Common.SFX_GameModes_Rush_Alarm_SimpleLoop3D);
    // if (sfxAlarm) {
    //     mod.StopSound(sfxAlarm);
    // }
}

export function OnMCOMDestroyed(eventMCOM: mod.MCOM): void {
    //Find destroyed MCOM
    for (const mcom of mComTeam1) {
        if (mcom.customMCOM.data.id === mod.GetObjId(eventMCOM)) {
            mcom.customMCOM.data.destroyed = true;
        }
    }

    for (const mcom of mComTeam2) {
        if (mcom.customMCOM.data.id === mod.GetObjId(eventMCOM)) {
            mcom.customMCOM.data.destroyed = true;
        }
    }

    //Check if all MCOMS destroyed
    const allTeam1Destroyed = mComTeam1.every(m => m.customMCOM.data.destroyed === true);
    if (allTeam1Destroyed) {
        mod.EndGameMode(mod.GetTeam(2));
        return;
    }

    const allTeam2Destroyed = mComTeam2.every(m => m.customMCOM.data.destroyed === true);
    if (allTeam2Destroyed) {
        mod.EndGameMode(mod.GetTeam(1));
        return;
    }
}

export function OnCapturePointCaptured(eventCapturePoint: mod.CapturePoint): void {
    if (mod.Equals(mod.GetCurrentOwnerTeam(eventCapturePoint), mod.GetTeam(1))) {
        let vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
        let voiceFlag: mod.VoiceOverFlags = mod.VoiceOverFlags.Alpha;
        let letter = 'A';

        for (const capture of sectors[currentSectorIndex].capturePoints) {
            let point = mod.GetCapturePoint(capture[0]);
            if (point) {
                if (mod.Equals(point, eventCapturePoint)) {
                    letter = capture[1].letter;

                    for (const playerId of capture[1].playerIds) {
                        let playerData = playerDataMap.get(playerId);

                        if (playerData) {
                            playerData.stats.captures++;

                            updateScoreboard(mod.GetPlayer(playerId), playerData);
                        }
                    }
                }
            }
        }

        switch (letter) {
            case 'A':
                voiceFlag = mod.VoiceOverFlags.Alpha;
                break;
            case 'B':
                voiceFlag = mod.VoiceOverFlags.Bravo;
                break;
            case 'C':
                voiceFlag = mod.VoiceOverFlags.Charlie;
                break;

        }
        mod.PlayVO(vo, mod.VoiceOverEvents2D.ObjectiveCaptured, voiceFlag, mod.GetTeam(1));
        mod.PlayVO(vo, mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, voiceFlag, mod.GetTeam(2));

        mod.Wait(6).then(() => {
            if (vo) {
                mod.UnspawnObject(vo);
            }
        })
    }
    else {
        let vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
        let voiceFlag: mod.VoiceOverFlags = mod.VoiceOverFlags.Alpha;
        let letter = 'A';

        for (const capture of sectors[currentSectorIndex].capturePoints) {
            let point = mod.GetCapturePoint(capture[0]);
            if (point) {
                if (mod.Equals(point, eventCapturePoint)) {
                    letter = capture[1].letter;

                    for (const playerId of capture[1].player2Ids) {
                        let playerData = playerDataMap.get(playerId);

                        if (playerData) {
                            playerData.stats.captures++;

                            updateScoreboard(mod.GetPlayer(playerId), playerData);
                        }
                    }
                }
            }
        }

        switch (letter) {
            case 'A':
                voiceFlag = mod.VoiceOverFlags.Alpha;
                break;
            case 'B':
                voiceFlag = mod.VoiceOverFlags.Bravo;
                break;
            case 'C':
                voiceFlag = mod.VoiceOverFlags.Charlie;
                break;

        }
        mod.PlayVO(vo, mod.VoiceOverEvents2D.ObjectiveCaptured, voiceFlag, mod.GetTeam(2));
        mod.PlayVO(vo, mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, voiceFlag, mod.GetTeam(1));

        mod.Wait(6).then(() => {
            if (vo) {
                mod.UnspawnObject(vo);
            }
        })
    }

    let result = checkSectorCaptured();

    if (!result || !result.team) {
        return;
    }


    if (result.captured) {
        if (result.team) {
            sectors[currentSectorIndex].ownerTeam = result.team;
            nextSector(result.team);
        }
    }
}

export function OnPlayerEnterCapturePoint(eventPlayer: mod.Player, eventCapturePoint: mod.CapturePoint): void {
    const playerId = modlib.getPlayerId(eventPlayer);
    let capturePoint = findCapturePoint(eventCapturePoint);

    //add to capture data
    if (capturePoint) {
        if (mod.Equals(mod.GetTeam(eventPlayer), mod.GetTeam(1))) {
            if (capturePoint.playerIds) {
                capturePoint.playerIds.push(playerId);
            }
        }
        else {
            if (capturePoint.player2Ids) {
                capturePoint.player2Ids.push(playerId);
            }
        }

    }
}


export function OnPlayerExitCapturePoint(eventPlayer: mod.Player, eventCapturePoint: mod.CapturePoint): void {
    const playerId = modlib.getPlayerId(eventPlayer);
    let capturePoint = findCapturePoint(eventCapturePoint);

    //delete from capture data
    if (capturePoint) {
        if (mod.Equals(mod.GetTeam(eventPlayer), mod.GetTeam(1))) {
            if (capturePoint.playerIds) {
                capturePoint.playerIds = capturePoint.playerIds.filter(id => id !== playerId);
            }
        }
        else {
            if (capturePoint.player2Ids) {
                capturePoint.player2Ids = capturePoint.player2Ids.filter(id => id !== playerId);
            }
        }

    }
}

export function OngoingCapturePoint(eventCapturePoint: mod.CapturePoint): void {
    for (const sector of sectors) {

        let point = sector.capturePoints.get(mod.GetObjId(eventCapturePoint));
        if (!point) continue;

        let team1ProgressSum = 0;
        let team2ProgressSum = 0;
        let activePoints = 0;

        // Progress pro Capture Point sammeln
        for (const [id, pointData] of sector.capturePoints) {
            let cp = mod.GetCapturePoint(id);
            if (!cp) continue;

            activePoints++;

            let progress = mod.GetCaptureProgress(cp); // 0â1
            let owner = mod.GetOwnerProgressTeam(cp);

            if (mod.Equals(owner, mod.GetTeam(1))) {
                team1ProgressSum += progress;
            } else if (mod.Equals(owner, mod.GetTeam(2))) {
                team2ProgressSum += progress;
            }
        }

        if (activePoints === 0) continue;

        let neutralProgressSum = activePoints - (team1ProgressSum + team2ProgressSum);

        // clamp
        if (neutralProgressSum < 0) neutralProgressSum = 0;

        // Fraktionen berechnen
        let fracTeam1 = team1ProgressSum / activePoints;
        let fracTeam2 = team2ProgressSum / activePoints;
        let fracNeutral = neutralProgressSum / activePoints;

        //
        // TEAM 1 UI
        //
        if (fUITeam1 && fUITeam1.rootCapture) {

            let fill1 = mod.FindUIWidgetWithName("ST1" + sector.letter + "Fill1", fUITeam1.rootCapture); // bottom (blue)
            let fill2 = mod.FindUIWidgetWithName("ST1" + sector.letter + "Fill2", fUITeam1.rootCapture); // top (red)
            let line = mod.FindUIWidgetWithName("ST1" + sector.letter + "Line", fUITeam1.rootCapture);

            if (fill1 && fill2) {

                // Blau unten
                mod.SetUIWidgetSize(fill1, mod.CreateVector(40, fracTeam1 * 40, 0));
                mod.SetUIWidgetBgColor(fill1, BLUEVEC);

                // Rot oben
                mod.SetUIWidgetSize(fill2, mod.CreateVector(40, fracTeam2 * 40, 0));
                mod.SetUIWidgetBgColor(fill2, REDVEC);

                // Neutraler Bereich liegt automatisch zwischen Fill1 und Fill2,
                // weil Fill1 von unten wÃ¤chst und Fill2 von oben.
                // â Kein extra UIâElement nÃ¶tig.
            }

            // Line = Ownership
            if (line) {
                if (mod.Equals(sector.ownerTeam, mod.GetTeam(1))) {
                    mod.SetUIWidgetBgColor(line, BLUEVEC);
                } else {
                    mod.SetUIWidgetBgColor(line, REDVEC);
                }
            }
        }

        //
        // TEAM 2 UI (gespiegelt)
        //
        if (fUITeam2 && fUITeam2.rootCapture) {

            let fill1 = mod.FindUIWidgetWithName("ST2" + sector.letter + "Fill1", fUITeam2.rootCapture); // bottom (blue)
            let fill2 = mod.FindUIWidgetWithName("ST2" + sector.letter + "Fill2", fUITeam2.rootCapture); // top (red)
            let line = mod.FindUIWidgetWithName("ST2" + sector.letter + "Line", fUITeam2.rootCapture);

            if (fill1 && fill2) {

                // Team 2 sieht Blau = Team2, Rot = Team1
                mod.SetUIWidgetSize(fill1, mod.CreateVector(40, fracTeam2 * 40, 0));
                mod.SetUIWidgetBgColor(fill1, BLUEVEC);

                mod.SetUIWidgetSize(fill2, mod.CreateVector(40, fracTeam1 * 40, 0));
                mod.SetUIWidgetBgColor(fill2, REDVEC);
            }

            // Line = Ownership (gespiegelt)
            if (line) {
                if (mod.Equals(sector.ownerTeam, mod.GetTeam(2))) {
                    mod.SetUIWidgetBgColor(line, BLUEVEC);
                } else {
                    mod.SetUIWidgetBgColor(line, REDVEC);
                }
            }
        }
    }
}

export function OnPlayerEarnedKill(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDeathType: mod.DeathType, eventWeaponUnlock: mod.WeaponUnlock): void {
    let playerData = playerDataMap.get(modlib.getPlayerId(eventPlayer));

    if (playerData) {
        playerData.stats.kills++;
        playerData.stats.kd = playerData.stats.deaths > 0
            ? playerData.stats.kills / playerData.stats.deaths
            : playerData.stats.kills;


        updateScoreboard(eventPlayer, playerData);
    }

    let playerData2 = playerDataMap.get(modlib.getPlayerId(eventOtherPlayer));

    if (playerData2) {
        playerData2.stats.deaths++;
        playerData2.stats.kd = playerData2.stats.deaths > 0
            ? playerData2.stats.kills / playerData2.stats.deaths
            : playerData2.stats.kills;


        updateScoreboard(eventOtherPlayer, playerData2);
    }
}

export function OnPlayerEarnedKillAssist(eventPlayer: mod.Player, eventOtherPlayer: mod.Player): void {
    let playerData = playerDataMap.get(modlib.getPlayerId(eventPlayer));

    if (playerData) {
        playerData.stats.assists++;

        updateScoreboard(eventPlayer, playerData);
    }
}

export function OngoingPlayer(eventPlayer: mod.Player): void {


}

export function OnRayCastHit(eventPlayer: mod.Player, eventPoint: mod.Vector, eventNormal: mod.Vector): void {

}

export function OnPlayerLeaveGame(eventNumber: number): void {
    autoTeamBalanceLeave(true, 2);
}

export function OnPlayerJoinGame(eventPlayer: mod.Player): void {
    mod.Wait(2).then(() => {

        let fUI = new FrontlinesUI();
        playerDataMap.set(modlib.getPlayerId(eventPlayer), {
            ui: fUI,
            stats: {
                captures: 0,
                kd: 0,
                kills: 0,
                deaths: 0,
                assists: 0
            },
            currentCapturePointOd: -1,
            inBounds: true,
            isCrouching: false,
            wasCrouching: false,
            isProne: false,
            wasProne: false,
            isInteracting: false,
            wasInteracting: false,
            isZooming: false,
            wasZooming: false
        });
        mod.SetRedeployTime(eventPlayer, frontlinesSettings.redeployTime);

        if (mod.GetSoldierState(eventPlayer, mod.SoldierStateBool.IsAISoldier)) {
            aiSoldierMap.set(modlib.getPlayerId(eventPlayer), eventPlayer);
        }

        if (mod.Equals(mod.GetTeam(eventPlayer), mod.GetTeam(2))) {
            const id = modlib.getPlayerId(eventPlayer);
            let data = playerDataMap.get(id);
            if (!data) {
                return;
            }
            data.ui = new FrontlinesUI();

            if (!data.ui) {
                return;
            }
        }
        else {

            const id = modlib.getPlayerId(eventPlayer);
            let data = playerDataMap.get(id);
            if (!data) {
                return;
            }
            data.ui = new FrontlinesUI();

            if (!data.ui) {
                return;
            }

        }
    })

}

function OnPlayerSwitchTeam(eventPlayer: mod.Player, eventTeam: mod.Team): void {

}

export function OnPlayerDeployed(eventPlayer: mod.Player): void {
    if (mod.Equals(mod.GetTeam(eventPlayer), mod.GetTeam(1))) {

        if (currentSectorIndex == sectors.length) {

            if (unitsRemainingTeam1 <= 0) return;

            unitsRemainingTeam1--;


            if (unitsRemainingTeam1 <= 0) {
                unitsRemainingTeam1 = 0;
                nextSector(mod.GetTeam(2));
            }

            updateUnitsUI(unitsRemainingTeam1);
        }

    } else {

        if (currentSectorIndex == -1) {

            if (unitsRemainingTeam2 <= 0) return;

            unitsRemainingTeam2--;

            if (unitsRemainingTeam2 <= 0) {
                unitsRemainingTeam2 = 0;
                nextSector(mod.GetTeam(1));
            }

            updateUnitsUI(unitsRemainingTeam2);
        }

    }
}

function updateUnitsUI(unitsRemaining: number): void {
    const teamsUI = [fUITeam1, fUITeam2];

    for (const teamUI of teamsUI) {
        if (teamUI && teamUI.rootMCOM) {
            let remainingText = mod.FindUIWidgetWithName("UnitsRemainingText", teamUI.rootMCOM);
            if (remainingText) {
                mod.SetUITextLabel(remainingText, mod.Message(mod.stringkeys.UnitsRemainingText, unitsRemaining));
                let unitsRemainingFill = mod.FindUIWidgetWithName("UnitsRemainingFill", teamUI.rootMCOM);
                if (unitsRemainingFill) {
                    let fillPercentage = (unitsRemaining / frontlinesSettings.maxUnitsRemaining) * 100;
                    mod.SetUIWidgetSize(unitsRemainingFill, mod.CreateVector(fillPercentage, 25, 0));
                }
            }
        }
    }
}

export function OnPlayerUnDeployed(eventPlayer: mod.Player): void {
    mod.SetRedeployTime(eventPlayer, frontlinesSettings.redeployTime);
}

export async function OnGameModeStarted() {
    createSectors();
    setModeSettings();
    mod.SetGameModeTimeLimit(frontlinesSettings.timeLimit * 60 * 2);
    mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams);
    mod.SetScoreboardColumnNames(mod.Message(mod.stringkeys.captures), mod.Message(mod.stringkeys.kd), mod.Message(mod.stringkeys.kills), mod.Message(mod.stringkeys.deaths), mod.Message(mod.stringkeys.assists))
    mod.SetScoreboardColumnWidths(40, 40, 40, 40, 40);
    for (const sector of sectors) {
        console.log("Sector: " + sector.letter + " HQId: " + sector.hqId);
    }

    mod.SetAllObjectivesUIEnabled(true);

    fUITeam1 = new FrontlinesUI();
    fUITeam1.ShowCaptureUI(mod.GetTeam(1));

    fUITeam2 = new FrontlinesUI();
    fUITeam2.ShowCaptureUI(mod.GetTeam(2));

    startCapture();

    let mcom = mod.GetMCOM(601);
    if (mcom) {
        mod.EnableGameModeObjective(mcom, false);
        mod.SetMCOMArmType(mcom, mod.MCOMArmType.Default);
    }

    mcom = mod.GetMCOM(602);
    if (mcom) {
        mod.EnableGameModeObjective(mcom, false);
        mod.SetMCOMArmType(mcom, mod.MCOMArmType.Default);
    }

    mcom = mod.GetMCOM(603);
    if (mcom) {
        mod.EnableGameModeObjective(mcom, false);
        mod.SetMCOMArmType(mcom, mod.MCOMArmType.Default);
    }

    mcom = mod.GetMCOM(604);
    if (mcom) {
        mod.EnableGameModeObjective(mcom, false);
        mod.SetMCOMArmType(mcom, mod.MCOMArmType.Default);
    }

    secondTimer();
}