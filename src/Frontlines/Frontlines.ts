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

    sectorIDs:        101 - 110
    areaIDs:          301 - 310        (areaID = sectorID + 200)
    hqIDs:            401 - 410        (hqID = sectorID + 300)

    capturePointIDs per sector:
        Sector 101  -  1001 - 1010
        Sector 102  -  1101 - 1110
        Sector 103  -  1201 - 1210
        Sector 104  -  1301 - 1310
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

    - All IDs must be assigned correctly in the Godot map.
    - If an ID is missing or incorrect, the corresponding object will not be detected.
    - The code automatically loads:
        - Sectors via mod.GetSector(sectorID)
        - Areas via mod.GetArea(areaID)
        - HQs via mod.GetHQ(hqID)
        - Capture Points via mod.GetCapturePoint(capturePointID)
    -  No additional setup or registration is needed in the code.
*/

import { Events } from 'bf6-portal-utils/events';
import { BLUE, RED, REDVEC, BLUEVEC, frontlinesSettings, type Color } from './FrontlinesConfig.ts';
import type { ICapturePoint, ISector } from './FrontlinesTypes.ts';
import { FrontlinesUI } from './FrontlinesUI.ts';
import { CustomMCOM } from './CustomMCOM.ts';

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

interface IMCOM {
    letter: string,
    sectorId: number,
    areaId: number,
    customMCOM: CustomMCOM;
    playerIds: number[];
    player2Ids: number[];
}

/*-----------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------- Global Variables --------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------------------------*/

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

let isDay: boolean = true;

/***********************************************************************************
***************************** Frontlines Setup *************************************
***********************************************************************************/

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

/*----------------------------------------------------------------------------------------------------*/

let team1PlayersCount: number = 0;
let team2PlayersCount: number = 0;

/*-----------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------- Helper Functions ------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------------------------*/

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

function getPlayerData(player: mod.Player | number): PlayerData {
    const playerId = typeof player === 'number' ? player : mod.GetObjId(player);
    let data = playerDataMap.get(playerId);
    if (!data) {
        data = {
            ui: undefined,
            stats: { captures: 0, kd: 0, kills: 0, deaths: 0, assists: 0 },
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
        };
        playerDataMap.set(playerId, data);
    }
    return data;
}

function secondTimer(): void {
    secondTimerRunning = true;
    mod.Wait(1).then(() => {
        // Timer update
        matchTimer--;
        if (fUITeam1 && fUITeam2) {
            updateTimerUI(fUITeam1);
            updateTimerUI(fUITeam2);
        }
        if (matchTimer == 0) {
            // Time over
            if (currentSectorIndex > sectors.length - 1) {
                mod.EndGameMode(mod.GetTeam(1));
            } else {
                mod.EndGameMode(mod.GetTeam(2));
            }
            return;
        }

        // Day/Night cycle
        const totalGameDuration = frontlinesSettings.daytime + frontlinesSettings.nighttime;
        const minutesPassed = Math.floor(matchTimer / 60) % totalGameDuration;
        const allPlayers = mod.GetAllPlayers();
        if (minutesPassed < frontlinesSettings.daytime) {
            if (!isDay) {
                console.log("Transitioning to day.");
                for (let i = 0; i < mod.CountOf(allPlayers); i++) {
                    const player = mod.ValueInArray(allPlayers, i);
                    mod.EnableScreenEffect(player, mod.ScreenEffects.Night, false);
                    mod.RemoveEquipment(player, mod.Gadgets.Mask_NVG);
                }

                isDay = true;
            }
        } else {
            if (isDay) {
                console.log("Transitioning to night.");
                for (let i = 0; i < mod.CountOf(allPlayers); i++) {
                    const player = mod.ValueInArray(allPlayers, i);
                    mod.EnableScreenEffect(player, mod.ScreenEffects.Night, true);
                    mod.AddEquipment(player, mod.Gadgets.Mask_NVG);
                }

                isDay = false;
            }
        }
        secondTimer();
    });
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
                result = mod.Message(mod.stringkeys.conquerSectorAMSG);
                break;
            case "B":
                result = mod.Message(mod.stringkeys.conquerSectorBMSG);
                break;
            case "C":
                result = mod.Message(mod.stringkeys.conquerSectorCMSG);
                break;
            case "D":
                result = mod.Message(mod.stringkeys.conquerSectorDMSG);
                break;
            case "E":
                result = mod.Message(mod.stringkeys.conquerSectorEMSG);
                break;
            case "F":
                result = mod.Message(mod.stringkeys.conquerSectorFMSG);
                break;
            case "G":
                result = mod.Message(mod.stringkeys.conquerSectorGMSG);
                break;
        }
    }

    return result;
}

function getLooseMessageFromSector(): mod.Message {
    let result = mod.Message(mod.stringkeys.looseSectorAMSG);

    let sector = sectors[currentSectorIndex];
    if (sectors) {
        switch (sector.letter) {
            case "A":
                result = mod.Message(mod.stringkeys.looseSectorAMSG);
                break;
            case "B":
                result = mod.Message(mod.stringkeys.looseSectorBMSG);
                break;
            case "C":
                result = mod.Message(mod.stringkeys.looseSectorCMSG);
                break;
            case "D":
                result = mod.Message(mod.stringkeys.looseSectorDMSG);
                break;
            case "E":
                result = mod.Message(mod.stringkeys.looseSectorEMSG);
                break;
            case "F":
                result = mod.Message(mod.stringkeys.looseSectorFMSG);
                break;
            case "G":
                result = mod.Message(mod.stringkeys.looseSectorGMSG);
                break;
        }
    }

    return result;
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

    const conquerNextSectorMessage: mod.Message = mod.Message(mod.stringkeys.conquerNextSectorMSG);
    const defendNextSectorMessage: mod.Message = mod.Message(mod.stringkeys.defendNextSectorMSG);
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

        let notification1 = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(notification1, mod.WorldIconImages.Flag);
        mod.SetSizeForGameEventNotificationData(notification1, mod.GameEventNotificationSizes.Normal);
        mod.SetColorForGameEventNotificationData(notification1, mod.GameEventNotificationColors.Neutral)
        mod.SetStyleForGameEventNotificationData(notification1, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(notification1, sectorConquerMessage, conquerNextSectorMessage);
        //mod.SetObjectiveForGameEventNotificationData(notification, this.mcomObj);
        mod.SendGameEventNotification(notification1, mod.GetTeam(2));

        let notification2 = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(notification2, mod.WorldIconImages.Flag);
        mod.SetSizeForGameEventNotificationData(notification2, mod.GameEventNotificationSizes.Normal);
        mod.SetColorForGameEventNotificationData(notification2, mod.GameEventNotificationColors.Neutral)
        mod.SetStyleForGameEventNotificationData(notification2, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(notification2, sectorLooseMessage, defendNextSectorMessage);
        mod.SendGameEventNotification(notification2, mod.GetTeam(1));

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

        let notification = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(notification, mod.WorldIconImages.Flag);
        mod.SetSizeForGameEventNotificationData(notification, mod.GameEventNotificationSizes.Normal);
        mod.SetColorForGameEventNotificationData(notification, mod.GameEventNotificationColors.Neutral)
        mod.SetStyleForGameEventNotificationData(notification, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(notification, sectorConquerMessage, conquerNextSectorMessage);
        //mod.SetObjectiveForGameEventNotificationData(notification, this.mcomObj);
        mod.SendGameEventNotification(notification, mod.GetTeam(1));
        mod.SetMessageForGameEventNotificationData(notification, sectorLooseMessage, defendNextSectorMessage);
        mod.SendGameEventNotification(notification, mod.GetTeam(2));
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

    //backup
    mod.Wait(3).then(() => {
        mod.SetHQTeam(hq1, mod.GetTeam(1));
        mod.EnableHQ(hq1, true);
    })

    //enable new HQ for defender
    // let defenderTeam = mod.Equals(team, mod.GetTeam(1))? mod.GetTeam(2): mod.GetTeam(1);

    let lastDefenderSector = sectors[currentSectorIndex + 1];

    let hq2 = mod.GetHQ(lastDefenderSector.hqId);
    if (hq2) {
        mod.SetHQTeam(hq2, mod.GetTeam(2));
        mod.EnableHQ(hq2, true);

        console.log("DefenderHQ:" + lastDefenderSector.hqId);
    }

    //backup
    mod.Wait(3).then(() => {
        mod.SetHQTeam(hq2, mod.GetTeam(2));
        mod.EnableHQ(hq2, true);
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

    let playerData = getPlayerData(player);
    if (playerData.ui) {
        playerData.inBounds = false;
        playerData.ui.ShowBoundsUI(player, true);
    }

    function loop() {
        if (!mod.IsPlayerValid(player) || playerData.inBounds) {
            return;
        }
        timer--;

        if (playerData.ui?.BoundsText) {
            mod.SetUITextLabel(playerData.ui.BoundsText, mod.Message(mod.stringkeys.boundsMSG, timer));
        }

        if (timer <= 0) {
            if (playerData.ui) {
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
    let playerData = getPlayerData(player);
    if (playerData.ui) {
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

function handlePlayerEnterAreaTrigger(eventPlayer: mod.Player, eventAreaTrigger: mod.AreaTrigger): void {
    checkPlayerEnteredAllowedZone(eventPlayer, eventAreaTrigger);
}

function handleMCOMDestroyed(eventMCOM: mod.MCOM): void {
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

function handleCapturePointCaptured(eventCapturePoint: mod.CapturePoint): void {
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
                        const playerData = getPlayerData(playerId);
                        playerData.stats.captures++;
                        updateScoreboard(mod.GetPlayer(playerId), playerData);
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
                        const playerData = getPlayerData(playerId);
                        playerData.stats.captures++;
                        updateScoreboard(mod.GetPlayer(playerId), playerData);
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

function handlePlayerEnterCapturePoint(eventPlayer: mod.Player, eventCapturePoint: mod.CapturePoint): void {
    const playerId = mod.GetObjId(eventPlayer);
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


function handlePlayerExitCapturePoint(eventPlayer: mod.Player, eventCapturePoint: mod.CapturePoint): void {
    const playerId = mod.GetObjId(eventPlayer);
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

function handleOngoingCapturePoint(eventCapturePoint: mod.CapturePoint): void {
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

            let progress = mod.GetCaptureProgress(cp); // 0 - 1
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
                //  -  Kein extra UIâElement nÃ¶tig.
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

function handlePlayerEarnedKill(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDeathType: mod.DeathType, eventWeaponUnlock: mod.WeaponUnlock): void {
    const killer = getPlayerData(eventPlayer);
    killer.stats.kills++;
    killer.stats.kd = killer.stats.deaths > 0
        ? killer.stats.kills / killer.stats.deaths
        : killer.stats.kills;
    updateScoreboard(eventPlayer, killer);

    const victim = getPlayerData(eventOtherPlayer);
    victim.stats.deaths++;
    victim.stats.kd = victim.stats.deaths > 0
        ? victim.stats.kills / victim.stats.deaths
        : victim.stats.kills;
    updateScoreboard(eventOtherPlayer, victim);
}

function handlePlayerEarnedKillAssist(eventPlayer: mod.Player, eventOtherPlayer: mod.Player): void {
    const assister = getPlayerData(eventPlayer);
    assister.stats.assists++;
    updateScoreboard(eventPlayer, assister);
}

function handlePlayerJoinGame(eventPlayer: mod.Player): void {
    mod.Wait(2).then(() => {
        if (!mod.IsPlayerValid(eventPlayer)) return;

        const data = getPlayerData(eventPlayer);
        if (!data.ui) {
            data.ui = new FrontlinesUI();
        }

        mod.SetRedeployTime(eventPlayer, frontlinesSettings.redeployTime);

        if (mod.GetSoldierState(eventPlayer, mod.SoldierStateBool.IsAISoldier)) {
            aiSoldierMap.set(mod.GetObjId(eventPlayer), eventPlayer);
        }
    });
}

function handlePlayerDeployed(eventPlayer: mod.Player): void {
    //day/night
    if (isDay) {
        mod.EnableScreenEffect(eventPlayer, mod.ScreenEffects.Night, false);
        mod.RemoveEquipment(eventPlayer, mod.Gadgets.Mask_NVG);
    }
    else {
        mod.EnableScreenEffect(eventPlayer, mod.ScreenEffects.Night, true);
        mod.AddEquipment(eventPlayer, mod.Gadgets.Mask_NVG);
    }

    if (mod.Equals(mod.GetTeam(eventPlayer), mod.GetTeam(1))) {

        if (currentSectorIndex == sectors.length) {


            unitsRemainingTeam1--;


            if (unitsRemainingTeam1 <= 0) {
                unitsRemainingTeam1 = 0;
                nextSector(mod.GetTeam(2));
            }

            updateUnitsUI(unitsRemainingTeam1);
        }

    } else {

        if (currentSectorIndex == -1) {

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

function handlePlayerUndeploy(eventPlayer: mod.Player): void {
    mod.SetRedeployTime(eventPlayer, frontlinesSettings.redeployTime);
}

function handlePlayerLeaveGame(playerId: number): void {
    playerDataMap.get(playerId)?.ui?.destroy();
    playerDataMap.delete(playerId);
    aiSoldierMap.delete(playerId);
}

/*-----------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------- Public API --------------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------------------------*/

export namespace Frontlines {
    /**
     * Sets up the match. Call from the OnGameModeStarted handler in index.ts.
     */
    export function init(): void {
        createSectors();
        setModeSettings();
        mod.SetGameModeTimeLimit(frontlinesSettings.timeLimit * 60 * 2);
        mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams);
        mod.SetScoreboardColumnNames(mod.Message(mod.stringkeys.captures), mod.Message(mod.stringkeys.kd), mod.Message(mod.stringkeys.kills), mod.Message(mod.stringkeys.deaths), mod.Message(mod.stringkeys.assists));
        mod.SetScoreboardColumnWidths(40, 40, 40, 40, 40);

        mod.SetAllObjectivesUIEnabled(true);

        fUITeam1 = new FrontlinesUI();
        fUITeam1.ShowCaptureUI(mod.GetTeam(1), sectors);

        fUITeam2 = new FrontlinesUI();
        fUITeam2.ShowCaptureUI(mod.GetTeam(2), sectors);

        startCapture();

        for (const mcomId of [601, 602, 603, 604]) {
            const mcom = mod.GetMCOM(mcomId);
            if (mcom) {
                mod.EnableGameModeObjective(mcom, false);
                mod.SetMCOMArmType(mcom, mod.MCOMArmType.Default);
            }
        }

        registerEvents();

        // Players who joined before init never fire OnPlayerJoinGame.
        const existingPlayers = mod.GetAllPlayers();
        for (let i = 0; i < mod.CountOf(existingPlayers); i++) {
            handlePlayerJoinGame(mod.ValueInArray(existingPlayers, i) as mod.Player);
        }

        secondTimer();
    }
}

/*-----------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------- Event Wiring ------------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------------------------*/

function registerEvents(): void {
    Events.OnPlayerEnterAreaTrigger.subscribe(handlePlayerEnterAreaTrigger);
    Events.OnMCOMDestroyed.subscribe(handleMCOMDestroyed);
    Events.OnCapturePointCaptured.subscribe(handleCapturePointCaptured);
    Events.OnPlayerEnterCapturePoint.subscribe(handlePlayerEnterCapturePoint);
    Events.OnPlayerExitCapturePoint.subscribe(handlePlayerExitCapturePoint);
    Events.OngoingCapturePoint.subscribe(handleOngoingCapturePoint);
    Events.OnPlayerEarnedKill.subscribe(handlePlayerEarnedKill);
    Events.OnPlayerEarnedKillAssist.subscribe(handlePlayerEarnedKillAssist);
    Events.OnPlayerJoinGame.subscribe(handlePlayerJoinGame);
    Events.OnPlayerDeployed.subscribe(handlePlayerDeployed);
    Events.OnPlayerUndeploy.subscribe(handlePlayerUndeploy);
    Events.OnPlayerLeaveGame.subscribe(handlePlayerLeaveGame);
}