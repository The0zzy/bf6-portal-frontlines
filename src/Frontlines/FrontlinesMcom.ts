export class FrontlinesMcom {
    id: number;
    destroyed: boolean = false;
    owner: mod.Team;
    mcom: mod.MCOM;

    constructor(id: number, owner: mod.Team, fuseTime: number) {
        this.id = id;
        this.owner = owner;
        this.mcom = mod.GetMCOM(this.id);
        mod.SetMCOMOwner(this.mcom, this.owner);
        mod.SetMCOMArmType(this.mcom, mod.MCOMArmType.Default);
        mod.SetMCOMFuseTime(this.mcom, fuseTime);
    }

    destroyMCOM(): void {
        this.destroyed = true;

        const mcomDestroyedNotification = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(mcomDestroyedNotification, mod.WorldIconImages.Explosion);
        mod.SetSizeForGameEventNotificationData(mcomDestroyedNotification, mod.GameEventNotificationSizes.Large);
        mod.SetColorForGameEventNotificationData(mcomDestroyedNotification, mod.GameEventNotificationColors.Friendly);
        mod.SetStyleForGameEventNotificationData(mcomDestroyedNotification, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(mcomDestroyedNotification, mod.Message(mod.stringkeys.youDestroyedMCOM));
        mod.SetObjectiveForGameEventNotificationData(mcomDestroyedNotification, this.mcom);

        const mcomLostNotification = mod.CreateGameEventNotificationData();
        mod.SetIconForGameEventNotificationData(mcomLostNotification, mod.WorldIconImages.Explosion);
        mod.SetSizeForGameEventNotificationData(mcomLostNotification, mod.GameEventNotificationSizes.Large);
        mod.SetColorForGameEventNotificationData(mcomLostNotification, mod.GameEventNotificationColors.Enemy);
        mod.SetStyleForGameEventNotificationData(mcomLostNotification, mod.GameEventNotificationStyles.Normal);
        mod.SetMessageForGameEventNotificationData(mcomLostNotification, mod.Message(mod.stringkeys.teamDestroyedMCOM));
        mod.SetObjectiveForGameEventNotificationData(mcomLostNotification, this.mcom);

        const vo = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
        mod.PlayVO(vo, mod.VoiceOverEvents2D.MComDestroyedEnemy, mod.VoiceOverFlags.Alpha, this.owner);
        mod.PlayVO(vo, mod.VoiceOverEvents2D.MComDestroyedFriendly, mod.VoiceOverFlags.Alpha, mod.Equals(this.owner, mod.GetTeam(1)) ? mod.GetTeam(2) : mod.GetTeam(1));
        mod.SendGameEventNotification(mcomLostNotification, this.owner);
        mod.SendGameEventNotification(mcomDestroyedNotification, mod.Equals(this.owner, mod.GetTeam(1)) ? mod.GetTeam(2) : mod.GetTeam(1));
        mod.Wait(8).then(() => mod.UnspawnObject(vo));
    }
}
