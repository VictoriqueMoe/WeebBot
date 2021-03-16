import {BelongsTo, Column, ForeignKey, Model, Table} from "sequelize-typescript";
import {ScheduledJobModel} from "./ScheduledJob.model";
import {IScheduledJobModel} from "../IScheduledJobModel";
import {IMessageSchedulerModel} from "../IMessageSchedulerModel";

@Table
export class MessageSchedulerModel extends Model implements IMessageSchedulerModel {

    @Column
    channel: string;

    @ForeignKey(() => ScheduledJobModel)
    @Column scheduledJobName: number;

    @BelongsTo(() => ScheduledJobModel)
    scheduledJob: IScheduledJobModel;

    get messageSchedulers(): IMessageSchedulerModel[] {
        return this.scheduledJob.messageSchedulers;
    }

    get name(): string {
        return this.scheduledJob.name;
    }

    get whenToExecute(): string {
        return this.scheduledJob.whenToExecute;
    }

    callBackFunction(): () => void {
        return this.scheduledJob.callBackFunction;
    }

}