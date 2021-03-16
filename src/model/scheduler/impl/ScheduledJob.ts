import {IScheduledJob} from "../IScheduledJob";
import * as schedule from "node-schedule";

export class ScheduledJob implements IScheduledJob {
    constructor(private _name: string, private _job: schedule.Job, private _callBack: () => void, private _whenToExecute: string | Date) {
    }

    get name(): string {
        return this._name;
    }

    get job(): schedule.Job {
        return this._job;
    }

    get callBack(): () => void {
        return this._callBack;
    }

    get whenToExecute(): string | Date {
        return this._whenToExecute;
    }
}