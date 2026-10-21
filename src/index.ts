import { Events } from 'bf6-portal-utils/events';
import { Frontlines } from './Frontlines/Frontlines.ts';

enum GameModes {
    // Payload = 1,
    // TDM = 2,
    // Conquest = 3,
    // Domination = 4,
    // VIPDeathmatch = 5,
    // LoadoutDeathmatch = 6,
    // TeamGunMaster = 7,
    // Chainlink = 8,
    Frontlines = 9,
    // Rush = 10,
    // Breakthrough = 11,
}

Events.OnGameModeStarted.subscribe(async () => {
    mod.EnableAllPlayerDeploy(false);
    // pick a random GameMode from the list of GameModes to determine which mode to initialize.
    const gameModeValues = Object.values(GameModes).filter((value) => typeof value === 'number') as number[];
    const currentGameMode = gameModeValues[Math.floor(Math.random() * gameModeValues.length)];

    if (currentGameMode === GameModes.Frontlines) {
        Frontlines.init();
    }
    await mod.Wait(4);
    mod.EnableAllPlayerDeploy(true);
});
