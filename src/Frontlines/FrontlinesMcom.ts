import { getEnemyTeam } from "./FrontlinesConfig";

export class FrontlinesMcom {
    id: number;
    destroyed: boolean = false;
    owner: mod.Team;
    mcom: mod.MCOM;

    constructor(mcom: mod.MCOM, owner: mod.Team, fuseTime: number) {
        this.id = mod.GetObjId(mcom);
        this.owner = owner;
        this.mcom = mcom;
        mod.SetMCOMOwner(this.mcom, this.owner);
        mod.SetMCOMArmType(this.mcom, mod.MCOMArmType.Bomb);
        mod.SetMCOMFuseTime(this.mcom, fuseTime);
    }

    destroyMCOM(): void {
        this.destroyed = true;

        const mcomDestroyedNotification = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(mcomDestroyedNotification, mod.WorldIconImages.Explosion);
        mod.SetSizeForGameEventNotificationData(mcomDestroyedNotification, mod.GameEventNotificationSizes.Large);
        mod.SetColorForGameEventNotificationData(mcomDestroyedNotification, mod.GameEventNotificationColors.Friendly);
        mod.SetStyleForGameEventNotificationData(mcomDestroyedNotification, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(mcomDestroyedNotification, mod.Message(mod.stringkeys.frontlines.youDestroyedMCOM));
        mod.SetObjectiveForGameEventNotificationData(mcomDestroyedNotification, this.mcom);

        const mcomLostNotification = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(mcomLostNotification, mod.WorldIconImages.Explosion);
        mod.SetSizeForGameEventNotificationData(mcomLostNotification, mod.GameEventNotificationSizes.Large);
        mod.SetColorForGameEventNotificationData(mcomLostNotification, mod.GameEventNotificationColors.Enemy);
        mod.SetStyleForGameEventNotificationData(mcomLostNotification, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(mcomLostNotification, mod.Message(mod.stringkeys.frontlines.teamDestroyedMCOM));
        mod.SetObjectiveForGameEventNotificationData(mcomLostNotification, this.mcom);

        mod.SendGameEventNotification(mcomLostNotification, this.owner);
        mod.SendGameEventNotification(mcomDestroyedNotification, getEnemyTeam(this.owner));
    }
}
