export interface ICapturePoint {
    letter: string,
    playerIds: number[];
    player2Ids: number[];
}

export interface ICustomMcom {
    id: number;
    areaId: number;
    ownerTeam: mod.Team;
    active: boolean;
    destroyed: boolean;
}

export interface ISector {
    letter: string;
    id: number;
    areaId: number;
    hqId: number;
    captureStatus: number;
    ownerTeam: mod.Team | undefined;
    capturePoints: Map<number, ICapturePoint>;
}
