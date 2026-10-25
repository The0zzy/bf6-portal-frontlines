/*
    Map IDs follow levels/MAP_REQUIREMENTS.md (scheme, required objects and failure rules).
    Fixed HQs:        100 (Team 1), 150 (Team 2), area triggers 101 and 151.
    Sectors:          201 to 20N, N = 5-7. First and last are MCOM sectors, the rest are capture sectors.
    Sector parts:     area trigger sectorId + 10, sector HQ sectorId + 20 (capture sectors only).
    Children:         capture points and MCOMs 400 + (sectorId - 200) * 10 + n (n = 0-7).
    Vehicle spawners: 300 + (sectorId - 200) * 10 + n (optional).

    init() validates the map once. A missing, duplicate or non-contiguous ID is logged and the match ends as a draw.
*/

import { Events } from 'bf6-portal-utils/events';
import { UI } from 'bf6-portal-utils/ui';
import { BLUE, FIRST_SECTOR_ID, FIXED_HQ_TEAM1_ID, FIXED_HQ_TEAM2_ID, LAST_SECTOR_ID, MAX_CHILDREN_PER_SECTOR, MAX_SECTORS, MIN_SECTORS, RED, childBaseId, frontlinesSettings, hqAreaTriggerId, neutralTeam, sectorAreaTriggerId, sectorHqId, vehicleSpawnerBaseId } from './FrontlinesConfig.ts';
import type { UIText } from 'bf6-portal-utils/ui/components/text';
import { FrontlinesSector } from './FrontlinesSector.ts';
import { FrontlinesCaptureSector } from './FrontlinesCaptureSector.ts';
import { FrontlinesMcomSector } from './FrontlinesMcomSector.ts';
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

    const hq1AreaId: number = hqAreaTriggerId(FIXED_HQ_TEAM1_ID);
    const hq2AreaId: number = hqAreaTriggerId(FIXED_HQ_TEAM2_ID);

    let fUITeam1: FrontlinesUI | undefined;
    let fUITeam2: FrontlinesUI | undefined;

    let playerDataMap: Map<number, PlayerData> = new Map();

    let matchTimer: number = 2400;

    let currentSectorIndex: number = 0;

    let unitsRemainingTeam1: number = 200;
    let unitsRemainingTeam2: number = 200;

    let isDay: boolean = true;

    let sectorsById: Map<number, mod.Sector> = new Map();
    let hqsById: Map<number, mod.HQ> = new Map();
    let areaTriggersById: Map<number, mod.AreaTrigger> = new Map();
    let mcomsById: Map<number, mod.MCOM> = new Map();
    let capturePointsById: Map<number, mod.CapturePoint> = new Map();
    const vehicleSpawnerIds: Set<number> = new Set();

    /***********************************************************************************
    ***************************** Frontlines Setup *************************************
    ***********************************************************************************/

    /***********************************************************************************
    ***************************** MCOM Setup *******************************************
    ***********************************************************************************/

    let mcomSectorTeam1!: FrontlinesMcomSector;
    let mcomSectorTeam2!: FrontlinesMcomSector;

    /***********************************************************************************
    ******************************Sector and Flag Setup*********************************   
    ***********************************************************************************/

    // Index 0 is the team 1 MCOM sector, the last index is the team 2 MCOM sector, the capture sectors are in between.
    let sectors: FrontlinesSector[] = [];
    let captureSectors: FrontlinesCaptureSector[] = [];

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
                if (currentSectorIndex == sectors.length - 1) {
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

    function getConquerMessageFromSector(sector: FrontlinesSector): mod.Message {
        let result = mod.Message(mod.stringkeys.conquerSectorAMSG);

        if (sector instanceof FrontlinesCaptureSector) {
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

    function getLooseMessageFromSector(sector: FrontlinesSector): mod.Message {
        let result = mod.Message(mod.stringkeys.looseSectorAMSG);

        if (sector instanceof FrontlinesCaptureSector) {
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
        for (const sector of sectors) {
            sector.deactivate();
        }

        const current = sectors[currentSectorIndex];

        if (current instanceof FrontlinesMcomSector) {
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
                    fUITeam1.setUnitsRemaining(unitsRemainingTeam1, frontlinesSettings.maxUnitsRemaining);
                }

                if (fUITeam2.UnitsRemainingText && fUITeam2.UnitsRemainingFill) {
                    fUITeam2.setUnitsRemaining(unitsRemainingTeam2, frontlinesSettings.maxUnitsRemaining);
                }
            }
        }
        else {
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
        }

        current.activate();
    }

    function startCapture(): void {
        // the first capture sector is at index 1, so the middle capture sector of an odd or even count is at ceil(count / 2)
        currentSectorIndex = Math.ceil(captureSectors.length / 2);

        for (const sector of captureSectors) {
            mod.EnableHQ(sector.hq, false);
        }

        setCaptureOwner(sectors[currentSectorIndex - 1], mod.GetTeam(1));
        setCaptureOwner(sectors[currentSectorIndex + 1], mod.GetTeam(2));

        updateSectorsState();
    }

    // Only capture sectors have an HQ and a capture owner, MCOM sectors are skipped.
    function setCaptureOwner(sector: FrontlinesSector, team: mod.Team): void {
        if (sector instanceof FrontlinesCaptureSector) {
            sector.setOwner(team);
        }
    }

    // Returns the team that holds every capture point of the sector, or the neutral team when they are not all held by one team.
    function getFullyCapturingTeam(sector: FrontlinesCaptureSector): mod.Team {
        const neutral = neutralTeam();
        const points = Array.from(sector.capturePoints.values());
        const owner = mod.GetCurrentOwnerTeam(points[0]);
        if (mod.Equals(owner, neutral)) {
            return neutral;
        }

        for (const point of points) {
            if (!mod.Equals(mod.GetCurrentOwnerTeam(point), owner)) {
                return neutral;
            }
        }
        return owner;
    }

    function nextSector(team: mod.Team): void {
        mod.LoadMusic(mod.MusicPackages.Core);
        mod.PlayMusic(mod.MusicEvents.Core_PhaseBegin);

        mod.Wait(5).then(() => {
            mod.UnloadMusic(mod.MusicPackages.Core);
        })

        //disable all HQs
        for (const sector of captureSectors) {
            mod.EnableHQ(sector.hq, false);
        }

        const conquerNextSectorMessage: mod.Message = mod.Message(mod.stringkeys.conquerNextSectorMSG);
        const defendNextSectorMessage: mod.Message = mod.Message(mod.stringkeys.defendNextSectorMSG);
        const sectorConquerMessage: mod.Message = getConquerMessageFromSector(sectors[currentSectorIndex]);
        const sectorLooseMessage: mod.Message = getLooseMessageFromSector(sectors[currentSectorIndex]);
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

        //enable new HQ for pusher, the index is always in range because captures only happen between the two MCOM sectors
        const lastSector = sectors[currentSectorIndex - 1];
        setCaptureOwner(lastSector, mod.GetTeam(1));

        //backup
        mod.Wait(3).then(() => setCaptureOwner(lastSector, mod.GetTeam(1)));

        //enable new HQ for defender
        // let defenderTeam = mod.Equals(team, mod.GetTeam(1))? mod.GetTeam(2): mod.GetTeam(1);

        const lastDefenderSector = sectors[currentSectorIndex + 1];
        setCaptureOwner(lastDefenderSector, mod.GetTeam(2));

        //backup
        mod.Wait(3).then(() => setCaptureOwner(lastDefenderSector, mod.GetTeam(2)));

        // MCOM phases have no capture points, so the rest of this function only applies to capture sectors
        const current = sectors[currentSectorIndex];
        if (!(current instanceof FrontlinesCaptureSector)) {
            return;
        }
        const currentSector: FrontlinesCaptureSector = current;

        //deactivate objectives and spawn icons
        let objectiveIcons: mod.WorldIcon[] = [];

        for (const point of currentSector.capturePoints.values()) {
            mod.EnableGameModeObjective(point, false);

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
            const points = Array.from(currentSector.capturePoints.values());

            const goalPoint = points[getRandomInt(points.length - 1)];
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

        const sectorWidgets1 = fUITeam1?.getSector(currentSector.letter);
        if (fUITeam1 && fUITeam1.rootCapture && sectorWidgets1) {
            text1 = sectorWidgets1.text;
            timer1 = sectorWidgets1.timer;
            text1.visible = false;
            timer1.visible = true;
        }

        const sectorWidgets2 = fUITeam2?.getSector(currentSector.letter);
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
                for (const point of currentSector.capturePoints.values()) {
                    mod.EnableGameModeObjective(point, true);
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

    // Indexes a mod list by object ID. Repeated IDs are recorded in duplicateIds.
    function indexById<T>(list: mod.Array, seenIds: Set<number>, duplicateIds: number[]): Map<number, T> {
        const result = new Map<number, T>();
        for (let i = 0; i < mod.CountOf(list); i++) {
            const obj = mod.ValueInArray(list, i);
            const id = mod.GetObjId(obj);
            if (seenIds.has(id)) {
                duplicateIds.push(id);
            }
            seenIds.add(id);
            result.set(id, obj as T);
        }
        return result;
    }

    function loadMapObjects(): string | undefined {
        const seenIds = new Set<number>();
        const duplicateIds: number[] = [];
        sectorsById = indexById<mod.Sector>(mod.GetAllSectors(), seenIds, duplicateIds);
        hqsById = indexById<mod.HQ>(mod.GetAllHQs(), seenIds, duplicateIds);
        areaTriggersById = indexById<mod.AreaTrigger>(mod.GetAllAreaTriggers(), seenIds, duplicateIds);
        mcomsById = indexById<mod.MCOM>(mod.GetAllMCOMs(), seenIds, duplicateIds);
        capturePointsById = indexById<mod.CapturePoint>(mod.GetAllCapturePoints(), seenIds, duplicateIds);

        if (duplicateIds.length > 0) {
            return 'duplicate ID ' + duplicateIds.join(', ');
        }

        // spawners are not checked for duplicates, unplaced vehicles may share a default ID
        vehicleSpawnerIds.clear();
        const spawners = mod.GetAllVehicleSpawners();
        for (let i = 0; i < mod.CountOf(spawners); i++) {
            vehicleSpawnerIds.add(mod.GetObjId(mod.ValueInArray(spawners, i)));
        }

        return undefined;
    }

    function validateFixedObjects(): string | undefined {
        for (const hqId of [FIXED_HQ_TEAM1_ID, FIXED_HQ_TEAM2_ID]) {
            if (!hqsById.has(hqId)) {
                return 'missing fixed HQ ' + hqId;
            }
            if (!areaTriggersById.has(hqAreaTriggerId(hqId))) {
                return 'missing HQ area trigger ' + hqAreaTriggerId(hqId);
            }
        }
        return undefined;
    }

    // Returns the objects of a block (n = 0-7) keyed by ID.
    function getBlockObjects<T>(objects: Map<number, T>, baseId: number): Map<number, T> {
        const result = new Map<number, T>();
        for (let n = 0; n < MAX_CHILDREN_PER_SECTOR; n++) {
            const obj = objects.get(baseId + n);
            if (obj) {
                result.set(baseId + n, obj);
            }
        }
        return result;
    }

    // Returns the first ID after a missing index in a block (n = 0-7), or undefined when contiguous.
    function findBlockGap(baseId: number, exists: (id: number) => boolean): number | undefined {
        let missingSeen = false;
        for (let n = 0; n < MAX_CHILDREN_PER_SECTOR; n++) {
            const id = baseId + n;
            if (!exists(id)) {
                missingSeen = true;
            } else if (missingSeen) {
                return id;
            }
        }
        return undefined;
    }

    function getAllMcoms(): FrontlinesMcom[] {
        return [...mcomSectorTeam1.mcoms, ...mcomSectorTeam2.mcoms];
    }

    function createMcomSector(sectorId: number, owner: mod.Team): FrontlinesMcomSector | string {
        const sector = sectorsById.get(sectorId);
        if (!sector) {
            return 'missing sector ' + sectorId;
        }

        const areaTrigger = areaTriggersById.get(sectorAreaTriggerId(sectorId));
        if (!areaTrigger) {
            return 'missing area trigger ' + sectorAreaTriggerId(sectorId);
        }

        if (hqsById.has(sectorHqId(sectorId))) {
            return 'sector HQ ' + sectorHqId(sectorId) + ' is not allowed on MCOM sector ' + sectorId;
        }

        const baseId = childBaseId(sectorId);
        const gapId = findBlockGap(baseId, id => mcomsById.has(id));
        if (gapId !== undefined) {
            return 'MCOM ' + gapId + ' has a gap before it';
        }

        const mcomObjects = getBlockObjects(mcomsById, baseId);
        if (mcomObjects.size === 0) {
            return 'missing MCOM ' + baseId;
        }

        const mcoms: FrontlinesMcom[] = [];
        for (const mcom of mcomObjects.values()) {
            mcoms.push(new FrontlinesMcom(mcom, owner, frontlinesSettings.mCOMFuseTime));
        }

        return new FrontlinesMcomSector(sector, sectorId, areaTrigger, owner, mcoms);
    }

    function createCaptureSector(sectorId: number): FrontlinesCaptureSector | string {
        const sector = sectorsById.get(sectorId);
        if (!sector) {
            return 'missing sector ' + sectorId;
        }

        const areaTrigger = areaTriggersById.get(sectorAreaTriggerId(sectorId));
        if (!areaTrigger) {
            return 'missing area trigger ' + sectorAreaTriggerId(sectorId);
        }

        const hq = hqsById.get(sectorHqId(sectorId));
        if (!hq) {
            return 'missing sector HQ ' + sectorHqId(sectorId);
        }

        const baseId = childBaseId(sectorId);
        const gapId = findBlockGap(baseId, id => capturePointsById.has(id));
        if (gapId !== undefined) {
            return 'capture point ' + gapId + ' has a gap before it';
        }

        const capturePoints = getBlockObjects(capturePointsById, baseId);
        if (capturePoints.size === 0) {
            return 'missing capture point ' + baseId;
        }

        return new FrontlinesCaptureSector(sector, sectorId, areaTrigger, hq, capturePoints);
    }

    // Builds the MCOM sectors and capture sectors. Returns an error message for the first invalid ID.
    function createSectors(): string | undefined {
        // disable all sectors in case they are not meant for the frontlines game mode
        for (const sector of sectorsById.values()) {
            mod.EnableGameModeObjective(sector, false);
        }

        let sectorCount = 0;
        while (FIRST_SECTOR_ID + sectorCount <= LAST_SECTOR_ID && sectorsById.has(FIRST_SECTOR_ID + sectorCount)) {
            sectorCount++;
        }
        if (sectorCount < MIN_SECTORS) {
            return 'missing sector ' + (FIRST_SECTOR_ID + sectorCount) + ' (need ' + MIN_SECTORS + '-' + MAX_SECTORS + ' sectors)';
        }
        for (let sectorId = FIRST_SECTOR_ID + sectorCount; sectorId <= LAST_SECTOR_ID; sectorId++) {
            if (sectorsById.has(sectorId)) {
                return 'sector ' + sectorId + ' has a gap before it';
            }
        }
        if (sectorCount > MAX_SECTORS) {
            return 'sector count ' + sectorCount + ' exceeds ' + MAX_SECTORS;
        }

        const lastSectorId = FIRST_SECTOR_ID + sectorCount - 1;

        for (let sectorId = FIRST_SECTOR_ID; sectorId <= lastSectorId; sectorId++) {
            const spawnerGapId = findBlockGap(vehicleSpawnerBaseId(sectorId), id => vehicleSpawnerIds.has(id));
            if (spawnerGapId !== undefined) {
                return 'vehicle spawner ' + spawnerGapId + ' has a gap before it';
            }
        }

        const team1McomSector = createMcomSector(FIRST_SECTOR_ID, mod.GetTeam(1));
        if (typeof team1McomSector === 'string') {
            return team1McomSector;
        }
        const team2McomSector = createMcomSector(lastSectorId, mod.GetTeam(2));
        if (typeof team2McomSector === 'string') {
            return team2McomSector;
        }
        mcomSectorTeam1 = team1McomSector;
        mcomSectorTeam2 = team2McomSector;

        const captures: FrontlinesCaptureSector[] = [];
        for (let sectorId = FIRST_SECTOR_ID + 1; sectorId < lastSectorId; sectorId++) {
            const captureSector = createCaptureSector(sectorId);
            if (typeof captureSector === 'string') {
                return captureSector;
            }
            captures.push(captureSector);
        }

        // left half belongs to team 1, right half to team 2, the middle sector (odd count) stays neutral
        const middleIndex = Math.floor(captures.length / 2);
        for (let i = 0; i < captures.length; i++) {
            if (i < middleIndex) {
                captures[i].ownerTeam = mod.GetTeam(1);
            } else if (i > middleIndex) {
                captures[i].ownerTeam = mod.GetTeam(2);
            }
        }

        // index 0 and the last index are the MCOM sectors, so the index can only leave the array through a capture sector
        captureSectors = captures;
        sectors = [mcomSectorTeam1, ...captures, mcomSectorTeam2];

        // every sector stays visible and walkable for the whole match
        for (const sector of sectors) {
            sector.enableSectorAndArea();
        }
        return undefined;
    }

    function updateScoreboard(player: mod.Player, data: PlayerData): void {
        mod.SetScoreboardPlayerValues(player, data.stats.captures, data.stats.kd, data.stats.kills, data.stats.deaths, data.stats.assists);
    }

    function setModeSettings(): void {
        matchTimer = frontlinesSettings.timeLimit * 60;

        for (const sector of captureSectors) {
            for (const point of sector.capturePoints.values()) {
                mod.EnableCapturePointDeploying(point, false);
                mod.SetCapturePointCapturingTime(point, frontlinesSettings.captureTime);
                mod.SetCapturePointNeutralizationTime(point, frontlinesSettings.captureNeutralizationTime);

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
            if (mod.GetObjId(sector.areaTrigger) == mod.GetObjId(eventAreaTrigger)) {
                //neutral sector
                if (mod.Equals(sector.ownerTeam, neutralTeam())) {
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

        const team1Mcoms = mcomSectorTeam1.mcoms;
        const team1Mcom = team1Mcoms.find(m => m.id === eventId);
        if (team1Mcom) {
            team1Mcom.destroyMCOM();
            if (team1Mcoms.every(m => m.destroyed)) {
                console.log('all team 1 MCOMs destroyed');
                mod.EndGameMode(mod.GetTeam(2));
            }
            return;
        }

        const team2Mcoms = mcomSectorTeam2.mcoms;
        const team2Mcom = team2Mcoms.find(m => m.id === eventId);
        if (team2Mcom) {
            team2Mcom.destroyMCOM();
            if (team2Mcoms.every(m => m.destroyed)) {
                console.log('all team 2 MCOMs destroyed');
                mod.EndGameMode(mod.GetTeam(1));
            }
        }
    }

    function getCapturePointVoiceFlag(capturePoint: mod.CapturePoint): mod.VoiceOverFlags {
        const voiceFlags = [mod.VoiceOverFlags.Alpha, mod.VoiceOverFlags.Bravo, mod.VoiceOverFlags.Charlie];
        const currentSector = sectors[currentSectorIndex];
        if (!(currentSector instanceof FrontlinesCaptureSector)) {
            return mod.VoiceOverFlags.Alpha;
        }
        // voice flags follow the capture point order of the current sector (ID order)
        const index = Array.from(currentSector.capturePoints.values()).findIndex(point => mod.Equals(point, capturePoint));
        if (index < 0 || index >= voiceFlags.length) {
            return mod.VoiceOverFlags.Alpha;
        }
        return voiceFlags[index];
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
            const voiceFlag = getCapturePointVoiceFlag(eventCapturePoint);
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
            const voiceFlag = getCapturePointVoiceFlag(eventCapturePoint);
            mod.PlayVO(vo, mod.VoiceOverEvents2D.ObjectiveCaptured, voiceFlag, mod.GetTeam(2));
            mod.PlayVO(vo, mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, voiceFlag, mod.GetTeam(1));

            mod.Wait(6).then(() => {
                if (vo) {
                    mod.UnspawnObject(vo);
                }
            })
        }

        const currentSector = sectors[currentSectorIndex];
        if (!(currentSector instanceof FrontlinesCaptureSector)) {
            return;
        }

        const fullyCapturingTeam = getFullyCapturingTeam(currentSector);
        if (mod.Equals(fullyCapturingTeam, neutralTeam())) {
            return;
        }

        currentSector.ownerTeam = fullyCapturingTeam;
    }

    function handleOngoingCapturePoint(eventCapturePoint: mod.CapturePoint): void {
        for (const sector of captureSectors) {

            let point = sector.capturePoints.get(mod.GetObjId(eventCapturePoint));
            if (!point) continue;

            let team1ProgressSum = 0;
            let team2ProgressSum = 0;
            let activePoints = 0;

            // Progress pro Capture Point sammeln
            for (const cp of sector.capturePoints.values()) {
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

            if (currentSectorIndex == sectors.length - 1) {


                unitsRemainingTeam1--;


                if (unitsRemainingTeam1 <= 0) {
                    unitsRemainingTeam1 = 0;
                    nextSector(mod.GetTeam(2));
                }

                updateUnitsUI(unitsRemainingTeam1);
            }

        } else {

            if (currentSectorIndex == 0) {

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
        const setupError = loadMapObjects() ?? validateFixedObjects() ?? createSectors();
        if (setupError) {
            console.log('Frontlines setup failed: ' + setupError);
            mod.EndGameMode(mod.GetTeam(0));
            return;
        }

        setModeSettings();
        mod.SetGameModeTimeLimit(frontlinesSettings.timeLimit * 60 * 2);
        mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams);
        mod.SetScoreboardColumnNames(mod.Message(mod.stringkeys.captures), mod.Message(mod.stringkeys.kd), mod.Message(mod.stringkeys.kills), mod.Message(mod.stringkeys.deaths), mod.Message(mod.stringkeys.assists));
        mod.SetScoreboardColumnWidths(40, 40, 40, 40, 40);

        mod.SetAllObjectivesUIEnabled(true);

        fUITeam1 = new FrontlinesUI();
        fUITeam1.ShowCaptureUI(mod.GetTeam(1), captureSectors);

        fUITeam2 = new FrontlinesUI();
        fUITeam2.ShowCaptureUI(mod.GetTeam(2), captureSectors);

        startCapture();

        for (const mcom of getAllMcoms()) {
            mod.EnableGameModeObjective(mcom.mcom, false);
            mod.SetMCOMArmType(mcom.mcom, mod.MCOMArmType.Default);
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
