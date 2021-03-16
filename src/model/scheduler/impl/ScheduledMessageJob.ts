import {ScheduledJob} from "./ScheduledJob";
import * as schedule from "node-schedule";
import {GuildChannel} from "discord.js";
import {IScheduledMessageJob} from "../IScheduledMessageJob";

export class ScheduledMessageJob extends ScheduledJob implements IScheduledMessageJob {
    constructor(_name: string, _job: schedule.Job, private _channel: GuildChannel, callBack: () => void, _whenToExecute: string | Date) {
        super(_name, _job, callBack, _whenToExecute);
    }

    public get channel(): GuildChannel {
        return this._channel;
    }
}