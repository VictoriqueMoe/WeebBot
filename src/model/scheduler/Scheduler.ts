import * as schedule from 'node-schedule';
import {isValidCron} from 'cron-validator';
import {ChronException, ObjectUtil} from '../../utils/Utils';
import {IScheduledJob} from "./IScheduledJob";
import {BaseDAO} from "../../DAO/BaseDAO";
import {IScheduledJobModel} from "../DB/autoMod/IScheduledJobModel";

export abstract class Scheduler<T extends IScheduledJobModel, J extends IScheduledJob> extends BaseDAO<T> {

    protected _jobs: J[] = [];

    public get jobs(): J[] {
        return this._jobs;
    }

    public set jobs(jobs: J[]) {
        this._jobs = jobs;
    }

    public async buildFromModel(modelToBuildFrom: T): Promise<J> {
        if (modelToBuildFrom) {
            let whenToExecute: string | Date = null;
            if (isValidCron(modelToBuildFrom.whenToExecute)) {
                whenToExecute = modelToBuildFrom.whenToExecute as string;
            } else if (!Number.isNaN(Number.parseInt(modelToBuildFrom.whenToExecute))) {
                whenToExecute = new Date(Number.parseInt(modelToBuildFrom.whenToExecute));
            }
            return this.register(modelToBuildFrom.name, whenToExecute, modelToBuildFrom.callBackFunction);
        }
    }

    public getJob(name: string): schedule.Job {
        return this.jobs.find(j => j.name === name)?.job;
    }

    /**
     * Execute this function at a given date or chron time
     * @param name
     * @param whenToExecute
     * @param callBack
     */
    public async register(name: string, whenToExecute: string | Date, callBack: () => void): Promise<J> {
        if (this.jobs.find(j => j.name === name) != null) {
            this.cancelJob(name);
        }
        if (typeof whenToExecute === "string" && !isValidCron(whenToExecute, {
            seconds: true,
            allowBlankDay: true
        })) {
            throw new ChronException("Chron is not valid");
        }

        console.log(`Register function ${name}`);
        const job = schedule.scheduleJob(name, whenToExecute, callBack);
        const sJob = await this.registerJob(name, job, whenToExecute, callBack);
        this.jobs.push(sJob);
        return sJob;
    }

    protected abstract registerJob(name: string, job: schedule.Job, whenToExecute: string | Date, callBack: () => void): Promise<J>;

    public cancelJob(name: string): boolean {
        const j = this.jobs.find(j => j.name === name);
        if (j == null) {
            return false;
        }
        console.log(`job ${name} has been cancelled`);
        const jobObj = j.job;
        const b = jobObj.cancel();
        ObjectUtil.removeObjectFromArray(j, this.jobs);
        return b;
    }

    public cancelAllJobs(): void {
        this.jobs.forEach(scheduledMessage => scheduledMessage.job.cancel());
        this.jobs = [];
    }
}


