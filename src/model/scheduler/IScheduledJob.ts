import * as schedule from "node-schedule";

export interface IScheduledJob{
    readonly name: string;
    readonly job: schedule.Job;
    whenToExecute: string | Date;
    callBack: () => void;
}