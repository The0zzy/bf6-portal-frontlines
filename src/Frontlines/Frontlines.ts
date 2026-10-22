/*
    ============================
    Godot Map Setup Requirements
    ============================

    Sectors, sector areas, HQs and capture points are discovered by ID number.
    MCOM objects, MCOM sector/area triggers and HQ area triggers are HARDCODED in this
    file (see "Hardcoded IDs" below) and must exist in the Godot map with exactly these IDs.

    -------------------------
    Sector and Object ID Rules
    -------------------------

    sectorIDs:        101 - 110        (all six maps; createSectors loops 101 - 110 and skips missing IDs)
    areaIDs:          301 - 310        (areaID = sectorID + 200)
    hqIDs:            401 - 410        (hqID = sectorID + 300)

    capturePointIDs per sector:
        Sector 101  -  1001 - 1010
        Sector 102  -  1101 - 1110
        Sector 103  -  1201 - 1210
        ...
        Formula:
            baseID = 1001 + (sectorID - 101) * 100
            capturePointIDs = baseID ... baseID + 9

    -------------------------
    Hardcoded IDs (not derived from the scheme)
    -------------------------

        MCOM objects:              601, 602 (Team 1)      603, 604 (Team 2)
        MCOM sector objects:       10 (Team 1)            20 (Team 2)
        MCOM area triggers:        41 (Team 1)            42 (Team 2)
        HQ area triggers:          2001 (hq1AreaId)       3001 (hq2AreaId)

    -------------------------
    Example Configurations
    -------------------------

    Sector 1 (sectorID 101):
        sectorID:       101
        areaID:         301
        hqID:           401
        capturePoints:  1001, 1002, ...

    Sector 2 (sectorID 102):
        sectorID:       102
        areaID:         302
        hqID:           402
        capturePoints:  1101, 1102, ...

    -------------------------
    Important Notes
    -------------------------

    - All IDs must be assigned correctly in the Godot map.
    - If an ID is missing or incorrect, the corresponding object will not be detected.
    - The code automatically loads:
        - Sectors via mod.GetSector(sectorID)
        - Sector area triggers via mod.GetAreaTrigger(areaID)
        - HQs via mod.GetHQ(hqID)
        - Capture Points via mod.GetCapturePoint(capturePointID)
*/

import { Events } from 'bf6-portal-utils/events';
import { UI } from 'bf6-portal-utils/ui';
import { BLUE, RED, frontlinesSettings } from './FrontlinesConfig.ts';
import type { UIText } from 'bf6-portal-utils/ui/components/text';
import type { ICapturePoint, ISector } from './FrontlinesTypes.ts';
import { FrontlinesUI } from './FrontlinesUI.ts';
import { FrontlinesMcom } from './FrontlinesMcom.ts';
import { BoundsOverlayUI } from '../utils/BoundsOverlayUI.ts';

export namespace Frontlines {

    //data structures
    interface PlayerData {
        bounds: BoundsOverlayUI | undefined;
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

    /*-----------------------------------------------------------------------------------------------------------------*/
    /*--------------------------------------------- Global Variables --------------------------------------------------*/
    /*-----------------------------------------------------------------------------------------------------------------*/

    let hq1AreaId: number = 2001;
    let hq2AreaId: number = 3001;

    let fUITeam1: FrontlinesUI | undefined;
    let fUITeam2: FrontlinesUI | undefined;

    let playerDataMap: Map<number, PlayerData> = new Map();

    let matchTimer: number = 2400;

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

    const mcomTeam1SectorId: number = 10;
    const mcomTeam1AreaId: number = 41;
    const mcomTeam2SectorId: number = 20;
    const mcomTeam2AreaId: number = 42;

    let mComTeam1: FrontlinesMcom[] = [
        new FrontlinesMcom(601, mod.GetTeam(1), frontlinesSettings.mCOMFuseTime),
        new FrontlinesMcom(602, mod.GetTeam(1), frontlinesSettings.mCOMFuseTime)
    ];
    let mComTeam2: FrontlinesMcom[] = [
        new FrontlinesMcom(603, mod.GetTeam(2), frontlinesSettings.mCOMFuseTime),
        new FrontlinesMcom(604, mod.GetTeam(2), frontlinesSettings.mCOMFuseTime)
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

    function updateTimerUI(ui: FrontlinesUI): void {
        const minutes = Math.floor(matchTimer / 60);
        const seconds = matchTimer % 60;

        if (!ui.WinTimerText) {
            return;
        }

        if (minutes < 10 && seconds < 10) {
            ui.WinTimerText.label = mod.Message(mod.stringkeys.time1MSG, minutes, seconds);
        }
        else if (minutes < 10) {
            ui.WinTimerText.label = mod.Message(mod.stringkeys.time2MSG, minutes, seconds);
        }
        else if (seconds < 10) {
            ui.WinTimerText.label = mod.Message(mod.stringkeys.time3MSG, minutes, seconds);
        }
        else {
            ui.WinTimerText.label = mod.Message(mod.stringkeys.time4MSG, minutes, seconds);

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
                bounds: undefined,
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
                        if (mod.HasEquipment(player, mod.Gadgets.Mask_NVG)) {
                            mod.RemoveEquipment(player, mod.Gadgets.Mask_NVG);
                        }
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
        mod.EnableGameModeObjective(mod.GetSector(mcomTeam1SectorId), false);
        mod.EnableGameModeObjective(mod.GetSector(mcomTeam2SectorId), false);

        for (const mcom of mComTeam1) {
            mod.EnableGameModeObjective(mod.GetMCOM(mcom.id), false);

            //disable all areas
            let area = mod.GetAreaTrigger(mcomTeam1AreaId);
            if (area) {
                mod.EnableAreaTrigger(area, false);
            }

        }

        for (const mcom of mComTeam2) {
            mod.EnableGameModeObjective(mod.GetMCOM(mcom.id), false);

            //disable all areas
            let area = mod.GetAreaTrigger(mcomTeam2AreaId);
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
                    fUITeam1.rootCapture.visible = false;
                }
                if (fUITeam2.rootCapture) {
                    fUITeam2.rootCapture.visible = false;
                }

                fUITeam1.ShowMCOMUI(mod.GetTeam(1), RED, true);
                fUITeam2.ShowMCOMUI(mod.GetTeam(2), BLUE, true);

                if (fUITeam1.UnitsRemainingText && fUITeam1.UnitsRemainingFill) {
                    fUITeam1.setUnitsRemaining(unitsRemainingTeam2, frontlinesSettings.maxUnitsRemaining);
                }

                if (fUITeam2.UnitsRemainingText && fUITeam2.UnitsRemainingFill) {
                    fUITeam2.setUnitsRemaining(unitsRemainingTeam2, frontlinesSettings.maxUnitsRemaining);
                }
            }

            let sector = mod.GetSector(mcomTeam1SectorId);
            if (sector) {
                mod.EnableGameModeObjective(sector, true);
            }

            for (const mcom of mComTeam1) {
                mod.SetMCOMOwner(mod.GetMCOM(mcom.id), mod.GetTeam(1));
                mod.EnableGameModeObjective(mod.GetMCOM(mcom.id), true);

                //enable new area
                let area = mod.GetAreaTrigger(mcomTeam1AreaId);
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
                    fUITeam1.rootCapture.visible = false;
                }
                if (fUITeam2.rootCapture) {
                    fUITeam2.rootCapture.visible = false;
                }

                if (fUITeam1.UnitsRemainingText && fUITeam1.UnitsRemainingFill) {
                    fUITeam1.setUnitsRemaining(unitsRemainingTeam1, frontlinesSettings.maxUnitsRemaining);
                }

                if (fUITeam2.UnitsRemainingText && fUITeam2.UnitsRemainingFill) {
                    fUITeam2.setUnitsRemaining(unitsRemainingTeam1, frontlinesSettings.maxUnitsRemaining);
                }
            }

            let sector = mod.GetSector(mcomTeam2SectorId);
            if (sector) {
                mod.EnableGameModeObjective(sector, true);
            }

            for (const mcom of mComTeam2) {
                mod.SetMCOMOwner(mod.GetMCOM(mcom.id), mod.GetTeam(2));
                mod.EnableGameModeObjective(mod.GetMCOM(mcom.id), true);
                console.log('mcom: ' + mcom.id + ' activated');

                //enable new area
                let area = mod.GetAreaTrigger(mcomTeam2AreaId);
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
                    fUITeam1.rootCapture.visible = true;
                }
                if (fUITeam2.rootCapture) {
                    fUITeam2.rootCapture.visible = true;
                }
                if (fUITeam1.rootMCOM) {
                    fUITeam1.rootMCOM.visible = false;
                }
                if (fUITeam2.rootMCOM) {
                    fUITeam2.rootMCOM.visible = false;
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
        const sectorConquerMessage: mod.Message = getConquerMessageFromSector();
        const sectorLooseMessage: mod.Message = getLooseMessageFromSector();
        let sectorConqueredNotification = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(sectorConqueredNotification, mod.WorldIconImages.Flag);
        mod.SetSizeForGameEventNotificationData(sectorConqueredNotification, mod.GameEventNotificationSizes.Large);
        mod.SetColorForGameEventNotificationData(sectorConqueredNotification, mod.GameEventNotificationColors.Friendly)
        mod.SetStyleForGameEventNotificationData(sectorConqueredNotification, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(sectorConqueredNotification, sectorConquerMessage, conquerNextSectorMessage);

        let sectorLostNotification = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(sectorLostNotification, mod.WorldIconImages.Flag);
        mod.SetSizeForGameEventNotificationData(sectorLostNotification, mod.GameEventNotificationSizes.Large);
        mod.SetColorForGameEventNotificationData(sectorLostNotification, mod.GameEventNotificationColors.Enemy)
        mod.SetStyleForGameEventNotificationData(sectorLostNotification, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(sectorLostNotification, sectorLooseMessage, defendNextSectorMessage);

        const vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
        if (mod.Equals(team, mod.GetTeam(1))) {
            mod.PlayVO(vo, mod.VoiceOverEvents2D.SectorTakenAttacker, mod.VoiceOverFlags.Alpha, team);
            mod.SendGameEventNotification(sectorConqueredNotification, team);
            currentSectorIndex++;
        }
        else {
            mod.PlayVO(vo, mod.VoiceOverEvents2D.SectorTakenAttacker, mod.VoiceOverFlags.Alpha, team);
            mod.SendGameEventNotification(sectorLostNotification, mod.GetTeam(2));
            currentSectorIndex--;
        }
        mod.Wait(6).then(() => {
            if (vo) {
                mod.UnspawnObject(vo);
            }
        });

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
        for (const aiSoldier of getAISoldiers()) {
            let points = Array.from(currentSector.capturePoints.keys());

            let goalPoint: mod.CapturePoint | undefined = mod.GetCapturePoint(points[getRandomInt(points.length - 1)]);
            if (goalPoint) {
                mod.AIValidatedMoveToBehavior(aiSoldier, mod.GetObjectPosition(goalPoint));
            }
        }

        //next sector timer
        let sectorTimer = frontlinesSettings.sectorTimer;

        let timer1: UIText | undefined;
        let timer2: UIText | undefined;
        let text1: UIText | undefined;
        let text2: UIText | undefined;

        const sectorWidgets1 = fUITeam1?.getSector(sectors[currentSectorIndex].letter);
        if (fUITeam1 && fUITeam1.rootCapture && sectorWidgets1) {
            text1 = sectorWidgets1.text;
            timer1 = sectorWidgets1.timer;
            text1.visible = false;
            timer1.visible = true;
        }

        const sectorWidgets2 = fUITeam2?.getSector(sectors[currentSectorIndex].letter);
        if (fUITeam2 && fUITeam2.rootCapture && sectorWidgets2) {
            text2 = sectorWidgets2.text;
            timer2 = sectorWidgets2.timer;
            text2.visible = false;
            timer2.visible = true;
        }

        timer();

        function timer() {

            sectorTimer--;

            if (timer1) {
                timer1.label = mod.Message(mod.stringkeys.sectorTimer, sectorTimer);
            }

            if (timer2) {
                timer2.label = mod.Message(mod.stringkeys.sectorTimer, sectorTimer);
            }

            if (sectorTimer <= 0) {

                if (text1) text1.visible = true;
                if (text2) text2.visible = true;

                if (timer1) timer1.visible = false;
                if (timer2) timer2.visible = false;

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
                for (const aiSoldier of getAISoldiers()) {
                    mod.AIBattlefieldBehavior(aiSoldier);
                }

                return;
            }

            mod.Wait(1).then(timer);
        }

    }

    function getAISoldiers(): mod.Player[] {
        const aiSoldiers: mod.Player[] = [];
        const players = mod.GetAllPlayers();
        for (let i = 0; i < mod.CountOf(players); i++) {
            const player = mod.ValueInArray(players, i) as mod.Player;
            if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) {
                aiSoldiers.push(player);
            }
        }
        return aiSoldiers;
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
    }

    function enableOutOfBounds(player: mod.Player): void {
        let timer: number = 10;

        let playerData = getPlayerData(player);
        if (playerData.bounds) {
            playerData.inBounds = false;
            playerData.bounds.show(mod.Message(mod.stringkeys.boundsMSG, timer));
        }

        function loop() {
            if (!mod.IsPlayerValid(player) || playerData.inBounds) {
                return;
            }
            timer--;

            if (playerData.bounds) {
                playerData.bounds.show(mod.Message(mod.stringkeys.boundsMSG, timer));
            }

            if (timer <= 0) {
                if (playerData.bounds) {
                    playerData.bounds.hide();
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
        if (playerData.bounds) {
            playerData.inBounds = true;
            playerData.bounds.hide();
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
        const eventId = mod.GetObjId(eventMCOM);

        const team1Mcom = mComTeam1.find(m => m.id === eventId);
        if (team1Mcom) {
            team1Mcom.destroyMCOM();
            if (mComTeam1.every(m => m.destroyed)) {
                console.log('all team 1 MCOMs destroyed');
                mod.EndGameMode(mod.GetTeam(2));
            }
            return;
        }

        const team2Mcom = mComTeam2.find(m => m.id === eventId);
        if (team2Mcom) {
            team2Mcom.destroyMCOM();
            if (mComTeam2.every(m => m.destroyed)) {
                console.log('all team 2 MCOMs destroyed');
                mod.EndGameMode(mod.GetTeam(1));
            }
        }
    }

    function handleCapturePointCaptured(eventCapturePoint: mod.CapturePoint): void {
        const capturingTeam = mod.GetCurrentOwnerTeam(eventCapturePoint);
        const capturers = mod.GetPlayersOnPoint(eventCapturePoint);
        for (let i = 0; i < mod.CountOf(capturers); i++) {
            const player = mod.ValueInArray(capturers, i) as mod.Player;
            if (!mod.Equals(mod.GetTeam(player), capturingTeam)) continue;

            const playerData = getPlayerData(player);
            playerData.stats.captures++;
            updateScoreboard(player, playerData);
        }

        if (mod.Equals(capturingTeam, mod.GetTeam(1))) {
            let vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
            let voiceFlag: mod.VoiceOverFlags = mod.VoiceOverFlags.Alpha;
            let letter = 'A';

            for (const capture of sectors[currentSectorIndex].capturePoints) {
                let point = mod.GetCapturePoint(capture[0]);
                if (point) {
                    if (mod.Equals(point, eventCapturePoint)) {
                        letter = capture[1].letter;
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

                let sectorWidgets1 = fUITeam1.getSector(sector.letter);
                let fill1 = sectorWidgets1?.fill1; // bottom (blue)
                let fill2 = sectorWidgets1?.fill2; // top (red)
                let line = sectorWidgets1?.line;

                if (fill1 && fill2) {

                    // Blau unten
                    fill1.size = { width: 40, height: Math.round(fracTeam1 * 40) };
                    fill1.bgColor = UI.COLORS.BF_BLUE_BRIGHT;

                    // Rot oben
                    fill2.size = { width: 40, height: Math.round(fracTeam2 * 40) };
                    fill2.bgColor = UI.COLORS.BF_RED_BRIGHT;

                    // Neutraler Bereich liegt automatisch zwischen Fill1 und Fill2,
                    // weil Fill1 von unten wÃ¤chst und Fill2 von oben.
                    //  -  Kein extra UIâElement nÃ¶tig.
                }

                // Line = Ownership
                if (line) {
                    if (mod.Equals(sector.ownerTeam, mod.GetTeam(1))) {
                        line.bgColor = UI.COLORS.BF_BLUE_BRIGHT;
                    } else {
                        line.bgColor = UI.COLORS.BF_RED_BRIGHT;
                    }
                }
            }

            //
            // TEAM 2 UI (gespiegelt)
            //
            if (fUITeam2 && fUITeam2.rootCapture) {

                let sectorWidgets2 = fUITeam2.getSector(sector.letter);
                let fill1 = sectorWidgets2?.fill1; // bottom (blue)
                let fill2 = sectorWidgets2?.fill2; // top (red)
                let line = sectorWidgets2?.line;

                if (fill1 && fill2) {

                    // Team 2 sieht Blau = Team2, Rot = Team1
                    fill1.size = { width: 40, height: Math.round(fracTeam2 * 40) };
                    fill1.bgColor = UI.COLORS.BF_BLUE_BRIGHT;

                    fill2.size = { width: 40, height: Math.round(fracTeam1 * 40) };
                    fill2.bgColor = UI.COLORS.BF_RED_BRIGHT;
                }

                // Line = Ownership (gespiegelt)
                if (line) {
                    if (mod.Equals(sector.ownerTeam, mod.GetTeam(2))) {
                        line.bgColor = UI.COLORS.BF_BLUE_BRIGHT;
                    } else {
                        line.bgColor = UI.COLORS.BF_RED_BRIGHT;
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
        const data = getPlayerData(eventPlayer);
        if (!data.bounds) {
            data.bounds = new BoundsOverlayUI(eventPlayer);
        }

        mod.SetRedeployTime(eventPlayer, frontlinesSettings.redeployTime);
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
            if (teamUI && teamUI.UnitsRemainingText && teamUI.UnitsRemainingFill) {
                teamUI.setUnitsRemaining(unitsRemaining, frontlinesSettings.maxUnitsRemaining);
            }
        }
    }

    function handlePlayerUndeploy(eventPlayer: mod.Player): void {
        mod.SetRedeployTime(eventPlayer, frontlinesSettings.redeployTime);
    }

    function handlePlayerLeaveGame(playerId: number): void {
        playerDataMap.get(playerId)?.bounds?.destroy();
        playerDataMap.delete(playerId);
    }

    /*-----------------------------------------------------------------------------------------------------------------*/
    /*--------------------------------------------- Public API --------------------------------------------------------*/
    /*-----------------------------------------------------------------------------------------------------------------*/

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

    /*-----------------------------------------------------------------------------------------------------------------*/
    /*--------------------------------------------- Event Wiring ------------------------------------------------------*/
    /*-----------------------------------------------------------------------------------------------------------------*/

    function registerEvents(): void {
        Events.OnPlayerEnterAreaTrigger.subscribe(handlePlayerEnterAreaTrigger);
        Events.OnMCOMDestroyed.subscribe(handleMCOMDestroyed);
        Events.OnCapturePointCaptured.subscribe(handleCapturePointCaptured);
        Events.OngoingCapturePoint.subscribe(handleOngoingCapturePoint);
        Events.OnPlayerEarnedKill.subscribe(handlePlayerEarnedKill);
        Events.OnPlayerEarnedKillAssist.subscribe(handlePlayerEarnedKillAssist);
        Events.OnPlayerJoinGame.subscribe(handlePlayerJoinGame);
        Events.OnPlayerDeployed.subscribe(handlePlayerDeployed);
        Events.OnPlayerUndeploy.subscribe(handlePlayerUndeploy);
        Events.OnPlayerLeaveGame.subscribe(handlePlayerLeaveGame);
    }

}
