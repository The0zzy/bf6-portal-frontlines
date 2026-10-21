import { FrontlinesUI } from './FrontlinesUI.ts';
import { ICustomMcom } from './FrontlinesTypes.ts';

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
     * @param uiTeams UI of both teams, used to remove the MCOM icons
     * @param ownerMCOMs All MCOMs owned by this MCOM's owner team, used to check for game end
     */
    destroyMCOM(team: mod.Team, uiTeams: (FrontlinesUI | undefined)[], ownerMCOMs: CustomMCOM[]): void {
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

        let notification = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(notification, mod.WorldIconImages.Explosion);
        mod.SetSizeForGameEventNotificationData(notification, mod.GameEventNotificationSizes.Large);
        mod.SetColorForGameEventNotificationData(notification, mod.GameEventNotificationColors.Neutral)
        mod.SetStyleForGameEventNotificationData(notification, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(notification, mcomDestroyedMessage1);
        mod.SetObjectiveForGameEventNotificationData(notification, this.mcomObj);
        mod.SendGameEventNotification(notification, mod.GetTeam(1));
        mod.SetMessageForGameEventNotificationData(notification, mcomDestroyedMessage2);
        mod.SendGameEventNotification(notification, mod.GetTeam(2));

        if (this.team1Icon && this.team2Icon) {
            mod.UnspawnObject(this.team1Icon);
            mod.UnspawnObject(this.team2Icon);
        }

        for (const ui of uiTeams) {
            if (!ui) {
                continue;
            }
            switch (this.data.id) {
                case 601:
                    if (ui.Mcom1team1imageWidget) {
                        mod.DeleteUIWidget(ui.Mcom1team1imageWidget);
                    }
                    break;
                case 602:
                    if (ui.Mcom2team1imageWidget) {
                        mod.DeleteUIWidget(ui.Mcom2team1imageWidget);
                    }
                    break;
                case 603:
                    if (ui.Mcom1team2imageWidget) {
                        mod.DeleteUIWidget(ui.Mcom1team2imageWidget);
                    }
                    break;
                case 604:
                    if (ui.Mcom2team2imageWidget) {
                        mod.DeleteUIWidget(ui.Mcom2team2imageWidget);
                    }
                    break;
            }
        }

        let vfx = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Grenade_AntiTank_Detonation, mod.GetObjectPosition(this.mcomObj), mod.CreateVector(1, 1, 1));
        mod.EnableVFX(vfx, true);

        mod.Wait(4).then(() => {
            if (!vfx) {
                return;
            }
            mod.UnspawnObject(vfx);
        })

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
