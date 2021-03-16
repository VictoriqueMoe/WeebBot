import {Column, DataType, HasMany, Model, Table} from "sequelize-typescript";
import {MessageSchedulerModel} from "./MessageScheduler.model";
import {IScheduledJobModel} from "../IScheduledJobModel";
import {IMessageSchedulerModel} from "../IMessageSchedulerModel";

const serialize = require("funcster");

@Table
export class ScheduledJobModel extends Model implements IScheduledJobModel {

    @Column({unique: true, primaryKey: true})
    name: string;

    @Column
    whenToExecute: string;

    @Column({
        type: DataType.TEXT,
        get(this: ScheduledJobModel): () => void {
            return new Function(this.getDataValue("callBackFunction")) as () => void;
        },
        set(this: ScheduledJobModel, val: () => void) {
            serialize(val);
        }
    })
    callBackFunction: () => void;

    @HasMany(() => MessageSchedulerModel)
    messageSchedulers: IMessageSchedulerModel[];
}