import {Scheduler} from "../Scheduler";
import {ScheduledJobModel} from "../../DB/autoMod/impl/ScheduledJob.model";
import {IScheduledJob} from "../IScheduledJob";
import {ScheduledJob} from "./ScheduledJob";
import {Job} from "node-schedule";
import {IScheduledJobModel} from "../../DB/autoMod/IScheduledJobModel";
import {UniqueViolationError} from "../../../DAO/BaseDAO";

export class GenericSchedule extends Scheduler<IScheduledJobModel, IScheduledJob> {

    protected async registerJob(name: string, job: Job, whenToExecute: string | Date, callBack: () => void): Promise<IScheduledJob> {
        const model = new ScheduledJobModel({
            name,
            whenToExecute,
            callBack
        }) as IScheduledJobModel;
        try {
            await super.commitToDatabase(model);
        } catch (e) {
            if (e instanceof UniqueViolationError) {
                await ScheduledJobModel.update({
                    whenToExecute,
                    callBack
                }, {
                    where: {
                        name
                    }
                });
            } else {
                console.error(e);
                throw e;
            }
        }
        return new ScheduledJob(name, job, callBack, whenToExecute);
    }

}