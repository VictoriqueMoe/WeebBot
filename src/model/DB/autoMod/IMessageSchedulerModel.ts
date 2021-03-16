import {IScheduledJobModel} from "./IScheduledJobModel";

export interface IMessageSchedulerModel extends  IScheduledJobModel{
    channel: string;
    scheduledJobName: number;
    scheduledJob: IScheduledJobModel;
}