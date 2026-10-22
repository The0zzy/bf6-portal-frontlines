export interface ICapturePoint {
    letter: string,
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
