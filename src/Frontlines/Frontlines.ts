/*
    Map IDs follow levels/MAP_REQUIREMENTS.md (scheme, required objects and failure rules).
    Fixed HQs:        100 (Team 1), 150 (Team 2), area triggers 101 and 151.
    Sectors:          201 to 20N, N = 5-7. First and last are MCOM sectors, the rest are capture sectors.
    Sector parts:     area trigger sectorId + 10, sector HQ sectorId + 20 (capture sectors only).
    Children:         capture points and MCOMs 400 + (sectorId - 200) * 10 + n (n = 0-7).
    Vehicle spawners: 300 + (sectorId - 200) * 10 + n (optional).

    init() validates the map once. A missing, duplicate or non-contiguous ID is logged and the match ends as a draw.
*/

//#region Imports
import { Events } from 'bf6-portal-utils/events';
import { FIRST_SECTOR_ID, FIXED_HQ_TEAM1_ID, FIXED_HQ_TEAM2_ID, LAST_SECTOR_ID, MAX_CHILDREN_PER_SECTOR, MAX_SECTORS, MIN_SECTORS, childBaseId, frontlinesSettings, getEnemyTeam, hqAreaTriggerId, neutralTeam, sectorAreaTriggerId, sectorHqId, vehicleSpawnerBaseId } from './FrontlinesConfig.ts';
import { FrontlinesSector } from './FrontlinesSector.ts';
import { FrontlinesCaptureSector } from './FrontlinesCaptureSector.ts';
import { FrontlinesMcomSector } from './FrontlinesMcomSector.ts';
import { FrontlinesUI } from './FrontlinesUI.ts';
import { FrontlinesMcom } from './FrontlinesMcom.ts';
import { BoundsOverlayUI } from '../utils/BoundsOverlayUI.ts';
//#endregion

export namespace Frontlines {

    //#region Data Structures
    interface PlayerData {
        bounds: BoundsOverlayUI | undefined;
        stats: IPlayerStats;
        inBounds: boolean;
    }

    interface IPlayerStats {
        captures: number,
        kd: number,
        kills: number,
        deaths: number,
        assists: number
    }

    //#endregion

    //#region Global Variables

    const hq1AreaId: number = hqAreaTriggerId(FIXED_HQ_TEAM1_ID);
    const hq2AreaId: number = hqAreaTriggerId(FIXED_HQ_TEAM2_ID);

    let ui: FrontlinesUI | undefined;

    const playerDataMap: Map<number, PlayerData> = new Map();

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

    let sectors: FrontlinesSector[] = [];

    //#endregion

    //#region Helper Functions

    // Indexes a mod list by object ID. Optionally tracks duplicate IDs based on seen IDs.
    function indexById<T>(list: mod.Array, seenIds?: Set<number>, duplicateIds?: number[]): Map<number, T> {
        const result = new Map<number, T>();
        for (let i = 0; i < mod.CountOf(list); i++) {
            const obj = mod.ValueInArray(list, i);
            const id = mod.GetObjId(obj);
            if (seenIds?.has(id)) {
                duplicateIds?.push(id);
            }
            seenIds?.add(id);
            result.set(id, obj as T);
        }
        return result;
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

    function getPlayerData(player: mod.Player | number): PlayerData {
        const playerId = typeof player === 'number' ? player : mod.GetObjId(player);
        let data = playerDataMap.get(playerId);
        if (!data) {
            data = {
                bounds: undefined,
                stats: { captures: 0, kd: 0, kills: 0, deaths: 0, assists: 0 },
                inBounds: true
            };
            playerDataMap.set(playerId, data);
        }
        return data;
    }

    function secondTimer(): void {
        mod.Wait(1).then(() => {
            // Timer update
            matchTimer--;
            ui?.setTimer(matchTimer);
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

    //#endregion

    //#region Gameplay Functions
    function updateSectorsState(): void {
        for (let i = 0; i < sectors.length; i++) {
            const sector = sectors[i];
            const team = i < currentSectorIndex ? mod.GetTeam(1) : mod.GetTeam(2);
            if (i !== currentSectorIndex) {
                sector.setOwner(team);
            } else {
                sector.activate();
            }
        }

        const current = sectors[currentSectorIndex];

        if (current instanceof FrontlinesMcomSector) {
            mod.LoadMusic(mod.MusicPackages.Core);
            mod.PlayMusic(mod.MusicEvents.Core_LastPhaseBegin);

            unitsRemainingTeam1 = frontlinesSettings.maxUnitsRemaining;
            unitsRemainingTeam2 = frontlinesSettings.maxUnitsRemaining;

            ui?.showMcomPhase(unitsRemainingTeam1, unitsRemainingTeam2, frontlinesSettings.maxUnitsRemaining);
        }
        else {
            ui?.showCapturePhase();
        }
    }

    function startCapture(): void {
        currentSectorIndex = Math.floor(sectors.length / 2);
        updateSectorsState();
    }

    function nextSector(team: mod.Team): void {
        mod.LoadMusic(mod.MusicPackages.Core);
        mod.PlayMusic(mod.MusicEvents.Core_PhaseBegin);
        mod.Wait(5).then(() => {
            mod.UnloadMusic(mod.MusicPackages.Core);
        });

        const conquerNextSectorMessage: mod.Message = mod.Message(mod.stringkeys.conquerNextSectorMSG);
        const defendNextSectorMessage: mod.Message = mod.Message(mod.stringkeys.defendNextSectorMSG);
        const sectorConquerMessage: mod.Message = sectors[currentSectorIndex].getConquerMessage();
        const sectorLooseMessage: mod.Message = sectors[currentSectorIndex].getLooseMessage();
        const sectorConqueredNotification = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(sectorConqueredNotification, mod.WorldIconImages.Flag);
        mod.SetSizeForGameEventNotificationData(sectorConqueredNotification, mod.GameEventNotificationSizes.Large);
        mod.SetColorForGameEventNotificationData(sectorConqueredNotification, mod.GameEventNotificationColors.Friendly)
        mod.SetStyleForGameEventNotificationData(sectorConqueredNotification, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(sectorConqueredNotification, sectorConquerMessage, conquerNextSectorMessage);
        mod.SendGameEventNotification(sectorConqueredNotification, team);

        const sectorLostNotification = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(sectorLostNotification, mod.WorldIconImages.Flag);
        mod.SetSizeForGameEventNotificationData(sectorLostNotification, mod.GameEventNotificationSizes.Large);
        mod.SetColorForGameEventNotificationData(sectorLostNotification, mod.GameEventNotificationColors.Enemy)
        mod.SetStyleForGameEventNotificationData(sectorLostNotification, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(sectorLostNotification, sectorLooseMessage, defendNextSectorMessage);
        mod.SendGameEventNotification(sectorLostNotification, getEnemyTeam(team));

        const vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
        mod.PlayVO(vo, mod.VoiceOverEvents2D.SectorTakenAttacker, mod.VoiceOverFlags.Alpha, team);
        mod.PlayVO(vo, mod.VoiceOverEvents2D.SectorTakenDefender, mod.VoiceOverFlags.Alpha, getEnemyTeam(team));
        mod.Wait(6).then(() => {
            if (vo) {
                mod.UnspawnObject(vo);
            }
        });

        if (mod.Equals(team, mod.GetTeam(1))) {
            currentSectorIndex++;
        }
        else {
            currentSectorIndex--;
        }

        //removed next sector preparation timer
    }
    //#endregion

    //#region Initialization
    /**
    * Sets up the match. Call from the OnGameModeStarted handler in index.ts.
    */
    export function init(): void {
        const setupError = loadMapObjects() ?? validateFixedObjects() ?? createSectors();
        if (setupError) {
            console.log('Frontlines setup failed: ' + setupError);
            mod.SendPortalLogToAdmin();
            mod.EndGameMode(mod.GetTeam(0));
            return;
        }

        matchTimer = frontlinesSettings.timeLimit * 60;
        mod.SetGameModeTimeLimit(frontlinesSettings.timeLimit * 60 * 2);
        mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams);
        mod.SetScoreboardColumnNames(
            mod.Message(mod.stringkeys.captures),
            mod.Message(mod.stringkeys.kd),
            mod.Message(mod.stringkeys.kills),
            mod.Message(mod.stringkeys.deaths),
            mod.Message(mod.stringkeys.assists)
        );
        mod.SetScoreboardColumnWidths(40, 40, 40, 40, 40);

        const captureSectors = sectors.filter(sector => sector instanceof FrontlinesCaptureSector) as FrontlinesCaptureSector[];
        ui = new FrontlinesUI();
        ui.show(captureSectors);

        startCapture();

        registerEvents();

        // Players who joined before init never fire OnPlayerJoinGame.
        const existingPlayers = mod.GetAllPlayers();
        for (let i = 0; i < mod.CountOf(existingPlayers); i++) {
            handlePlayerJoinGame(mod.ValueInArray(existingPlayers, i) as mod.Player);
        }

        secondTimer();
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

        sectors = [team1McomSector, ...captures, team2McomSector];

        // every sector stays visible and walkable for the whole match
        for (const sector of sectors) {
            sector.enableSectorAndArea(true);
        }
        return undefined;
    }

    function updateScoreboard(player: mod.Player, data: PlayerData): void {
        mod.SetScoreboardPlayerValues(player, data.stats.captures, data.stats.kd, data.stats.kills, data.stats.deaths, data.stats.assists);
    }

    function enableOutOfBounds(player: mod.Player): void {
        let timer: number = 10;

        const playerData = getPlayerData(player);
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
        const playerData = getPlayerData(player);
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

    //#region Event Handlers
    function handlePlayerEnterAreaTrigger(eventPlayer: mod.Player, eventAreaTrigger: mod.AreaTrigger): void {
        checkPlayerEnteredAllowedZone(eventPlayer, eventAreaTrigger);
    }

    function handleMCOMDestroyed(eventMCOM: mod.MCOM): void {
        const eventId = mod.GetObjId(eventMCOM);
        const currentSector = sectors[currentSectorIndex];
        if (currentSector instanceof FrontlinesMcomSector) {
            currentSector.destroyMcom(eventId);
            if (mod.Equals(currentSector.isCapturedByTeam(), getEnemyTeam(currentSector.ownerTeam))) {
                console.log('MCOM sector has been captured by the enemy!');
                mod.EndGameMode(getEnemyTeam(currentSector.ownerTeam));
            }
        } else {
            console.log(`ERROR: handleMCOMDestroyed() - Current sector is not a FrontlinesMcomSector!`);
        }
    }

    function handleCapturePointCaptured(eventCapturePoint: mod.CapturePoint): void {
        const currentSector = sectors[currentSectorIndex];
        if (!(currentSector instanceof FrontlinesCaptureSector)) {
            console.log(`ERROR: handleCapturePointCaptured() - Current sector is not a FrontlinesCaptureSector!`);
            return;
        }
        const capturingTeam = mod.GetCurrentOwnerTeam(eventCapturePoint);
        const capturers = mod.GetPlayersOnPoint(eventCapturePoint);
        for (let i = 0; i < mod.CountOf(capturers); i++) {
            const player = mod.ValueInArray(capturers, i) as mod.Player;
            if (!mod.Equals(mod.GetTeam(player), capturingTeam)) continue;

            const playerData = getPlayerData(player);
            playerData.stats.captures++;
            updateScoreboard(player, playerData);
        }

        const vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
        const voiceFlag = getCapturePointVoiceFlag(eventCapturePoint);
        mod.PlayVO(vo, mod.VoiceOverEvents2D.ObjectiveCaptured, voiceFlag, capturingTeam);
        mod.PlayVO(vo, mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, voiceFlag, getEnemyTeam(capturingTeam));
        mod.Wait(6).then(() => {
            if (vo) {
                mod.UnspawnObject(vo);
            }
        });
        if (mod.Equals(capturingTeam, currentSector.isCapturedByTeam())) {
            currentSector.setOwner(capturingTeam);
            nextSector(capturingTeam);
        } else {
            mod.EnableCapturePointDeploying(eventCapturePoint, true);
        }
    }

    function handleOngoingCapturePoint(eventCapturePoint: mod.CapturePoint): void {
        const currentSector = sectors[currentSectorIndex];
        if (!(currentSector instanceof FrontlinesCaptureSector)) return;
        const point = currentSector.capturePoints.get(mod.GetObjId(eventCapturePoint));
        if (!point) return;

        let team1ProgressSum = 0;
        let team2ProgressSum = 0;
        let activePoints = 0;

        // Progress pro Capture Point sammeln
        for (const cp of currentSector.capturePoints.values()) {
            activePoints++;

            const progress = mod.GetCaptureProgress(cp); // 0 - 1
            const owner = mod.GetOwnerProgressTeam(cp);

            if (mod.Equals(owner, mod.GetTeam(1))) {
                team1ProgressSum += progress;
            } else if (mod.Equals(owner, mod.GetTeam(2))) {
                team2ProgressSum += progress;
            }
        }

        // Fraktionen berechnen
        const fracTeam1 = team1ProgressSum / activePoints;
        const fracTeam2 = team2ProgressSum / activePoints;

        ui?.updateSector(currentSector, fracTeam1, fracTeam2);
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

                updateUnitsUI();
            }

        } else {

            if (currentSectorIndex == 0) {

                unitsRemainingTeam2--;

                if (unitsRemainingTeam2 <= 0) {
                    unitsRemainingTeam2 = 0;
                    nextSector(mod.GetTeam(1));
                }

                updateUnitsUI();
            }

        }
    }

    function updateUnitsUI(): void {
        ui?.setUnitsRemaining(unitsRemainingTeam1, unitsRemainingTeam2, frontlinesSettings.maxUnitsRemaining);
    }

    function handlePlayerUndeploy(eventPlayer: mod.Player): void {
        mod.SetRedeployTime(eventPlayer, frontlinesSettings.redeployTime);
    }

    function handlePlayerLeaveGame(playerId: number): void {
        playerDataMap.get(playerId)?.bounds?.destroy();
        playerDataMap.delete(playerId);
    }

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
