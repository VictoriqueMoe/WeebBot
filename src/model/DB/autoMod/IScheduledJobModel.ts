import {IMessageSchedulerModel} from "./IMessageSchedulerModel";
import {Model} from "sequelize-typescript";

export interface IScheduledJobModel extends Model{
    name: string;
    whenToExecute: string;
    callBackFunction: () => void;
    messageSchedulers: IMessageSchedulerModel[];
}