import {IScheduledMessageJob} from "../IScheduledMessageJob";
import {Job} from 'node-schedule';
import {GuildChannel} from "discord.js";
import {ScheduledMessageJob} from "./ScheduledMessageJob";
import {ScheduledJobModel} from "../../DB/autoMod/impl/ScheduledJob.model";
import {UniqueViolationError} from "../../../DAO/BaseDAO";
import {MessageSchedulerModel} from "../../DB/autoMod/impl/MessageScheduler.model";
import {GenericSchedule} from "./GenericScheduler";

export class MessageScheduler extends GenericSchedule {

    protected _jobs: IScheduledMessageJob[] = [];

    protected static instance: MessageScheduler;
    private readonly channel: GuildChannel = null;

    public constructor(channel: GuildChannel) {
        super();
        this.channel = channel;
    }

    public get jobs(): IScheduledMessageJob[] {
        return this._jobs;
    }

    public set jobs(jobs: IScheduledMessageJob[]) {
        this._jobs = jobs;
    }

    protected async registerJob(name: string, job: Job, whenToExecute: string | Date, callBack: () => void): Promise<IScheduledMessageJob> {
        await super.registerJob(name, job, whenToExecute, callBack);

        const model = new MessageSchedulerModel({
            channel: this.channel,
            scheduledJobName: name
        });
        try {
            await super.commitToDatabase(model);
        } catch (e) {
            if (e instanceof UniqueViolationError) {
                await ScheduledJobModel.update({
                    hannel: this.channel,
                    scheduledJobName: name
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

        return new ScheduledMessageJob(name, job, this.channel, callBack, whenToExecute);
    }
}