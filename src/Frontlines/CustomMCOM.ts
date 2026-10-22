import type { ICustomMcom } from './FrontlinesTypes.ts';

export class CustomMCOM {
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

    /**
     * @param team Team that destroyed the MCOM (unused, kept from original signature)
     * @param ownerMCOMs All MCOMs owned by this MCOM's owner team, used to check for game end
     */
    destroyMCOM(team: mod.Team, ownerMCOMs: CustomMCOM[]): void {
        this.data.active = false;
        this.data.destroyed = true;

        const mcomDestroyedMessage = mod.Message(mod.stringkeys.youDestroyedMCOM);
        const mcomDestroyedNotification = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(mcomDestroyedNotification, mod.WorldIconImages.Explosion);
        mod.SetSizeForGameEventNotificationData(mcomDestroyedNotification, mod.GameEventNotificationSizes.Large);
        mod.SetColorForGameEventNotificationData(mcomDestroyedNotification, mod.GameEventNotificationColors.Friendly)
        mod.SetStyleForGameEventNotificationData(mcomDestroyedNotification, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(mcomDestroyedNotification, mcomDestroyedMessage);
        mod.SetObjectiveForGameEventNotificationData(mcomDestroyedNotification, this.mcomObj);

        const mcomLostMessage = mod.Message(mod.stringkeys.teamDestroyedMCOM);
        const mcomLostNotification = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(mcomLostNotification, mod.WorldIconImages.Explosion);
        mod.SetSizeForGameEventNotificationData(mcomLostNotification, mod.GameEventNotificationSizes.Large);
        mod.SetColorForGameEventNotificationData(mcomLostNotification, mod.GameEventNotificationColors.Enemy)
        mod.SetStyleForGameEventNotificationData(mcomLostNotification, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(mcomLostNotification, mcomLostMessage);
        mod.SetObjectiveForGameEventNotificationData(mcomLostNotification, this.mcomObj);

        const vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
        if (mod.Equals(this.data.ownerTeam, mod.GetTeam(1))) {
            mod.PlayVO(vo, mod.VoiceOverEvents2D.MComDestroyedEnemy, mod.VoiceOverFlags.Alpha, mod.GetTeam(1));
            mod.PlayVO(vo, mod.VoiceOverEvents2D.MComDestroyedFriendly, mod.VoiceOverFlags.Alpha, mod.GetTeam(2));
            mod.SendGameEventNotification(mcomLostNotification, mod.GetTeam(1));
        }
        else {
            mod.PlayVO(vo, mod.VoiceOverEvents2D.MComDestroyedEnemy, mod.VoiceOverFlags.Alpha, mod.GetTeam(2));
            mod.PlayVO(vo, mod.VoiceOverEvents2D.MComDestroyedFriendly, mod.VoiceOverFlags.Alpha, mod.GetTeam(1));
            mod.SendGameEventNotification(mcomDestroyedNotification, mod.GetTeam(2));
        }
        mod.Wait(8).then(() => {
            if (vo) {
                mod.UnspawnObject(vo);
            }
        });

        if (this.team1Icon && this.team2Icon) {
            mod.UnspawnObject(this.team1Icon);
            mod.UnspawnObject(this.team2Icon);
        }

        let vfx = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Grenade_AntiTank_Detonation, mod.GetObjectPosition(this.mcomObj), mod.CreateVector(1, 1, 1));
        mod.EnableVFX(vfx, true);

        mod.Wait(4).then(() => {
            if (!vfx) {
                return;
            }
            mod.UnspawnObject(vfx);
        });

        //check all mcoms of the owner team destroyed
        for (const mcom of ownerMCOMs) {
            if (mcom.data.destroyed == false) {
                return;
            }
        }

        if (mod.Equals(this.data.ownerTeam, mod.GetTeam(1))) {
            mod.EndGameMode(mod.GetTeam(2));
        }
        else {
            mod.EndGameMode(mod.GetTeam(1));
        }
    }

}
