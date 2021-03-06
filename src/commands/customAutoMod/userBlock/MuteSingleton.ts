import {BaseDAO} from "../../../DAO/BaseDAO";
import {MuteModel} from "../../../model/DB/autoMod/impl/Mute.model";
import {RolePersistenceModel} from "../../../model/DB/autoMod/impl/RolePersistence.model";
import {Guild, GuildMember} from "discord.js";
import {Main} from "../../../Main";
import {DiscordUtils, GuildUtils, ObjectUtil, TimeUtils} from "../../../utils/Utils";
import {GuildManager} from "../../../model/guild/manager/GuildManager";
import * as schedule from "node-schedule";
import {Job} from "node-schedule";
import TIME_UNIT = TimeUtils.TIME_UNIT;

export class MuteSingleton extends BaseDAO<MuteModel | RolePersistenceModel> {
    private readonly _mutes: Set<Job>;

    private constructor() {
        super();
        this._mutes = new Set();
    }

    private static _instance: MuteSingleton;

    public static get instance(): MuteSingleton {
        if (!MuteSingleton._instance) {
            MuteSingleton._instance = new MuteSingleton();
        }
        return MuteSingleton._instance;
    }

    public async isMuted(user: GuildMember): Promise<boolean> {
        const mutedRole = await GuildUtils.RoleUtils.getMuteRole(user.guild.id);
        if (!mutedRole) {
            return false;
        }
        const muteRoleId = mutedRole.id;
        if (user.roles.cache.has(muteRoleId)) {
            return true;
        }

        for (const job of this._mutes) {
            if (job.name === user.id) {
                return true;
            }
        }

        const has = await MuteModel.findOne({
            where: {
                userId: user.id,
                guildId: user.guild.id
            }
        });
        if (has) {
            return true;
        }
        return false;
    }

    /**
     * Mute a user from the server with an optional timeout
     * @param user - the User to mute
     * @param reason - reason for the mute
     * @param creatorID - User ID who did the mute
     * @param timeOut - the timeout. if unit is not passed, this will be evaluated as seconds
     * @param unit - the unit of time to apply to the timeOut argument
     */
    public async muteUser(user: GuildMember, reason: string, creatorID: string, timeOut?: number, unit?: TIME_UNIT): Promise<MuteModel> {
        const mutedRole = await GuildUtils.RoleUtils.getMuteRole(user.guild.id);
        if (!mutedRole) {
            return;
        }
        if (await this.isMuted(user)) {
            return null;
        }
        const muteRoleId = mutedRole.id;
        const prevRolesArr = Array.from(user.roles.cache.values());
        const prevRolesIdStr = prevRolesArr.map(r => r.id).join(",");
        const blockedUserId = user.id;
        const blockUserObject = user.user;
        const obj = {
            userId: blockedUserId,
            username: blockUserObject.username,
            reason,
            creatorID,
            guildId: user.guild.id,
            prevRole: prevRolesIdStr
        };
        const hasTimeout = !isNaN(timeOut);
        const maxMillis = 8640000000000000 - Date.now();
        let millis = -1;
        if (hasTimeout) {
            millis = timeOut * 1000;
            if (ObjectUtil.validString(unit)) {
                millis = TimeUtils.convertToMilli(timeOut, unit);
            }
            if (Number.isNaN(millis) || millis <= 0 || millis > maxMillis) {
                throw new Error(`Timout is invalid, it can not be below 0 and can not be more than: "${maxMillis / 1000}"`);
            }
            obj["timeout"] = millis;
        }
        const model = new MuteModel(obj);
        let userObject: GuildMember = null;
        let savedModel: MuteModel = null;
        userObject = await user.guild.members.fetch(blockedUserId);
        try {
            savedModel = await Main.dao.transaction(async t => {
                const m = await super.commitToDatabase(model) as MuteModel;
                await this.addRolePersist(userObject, muteRoleId);
                return m;
            }) as MuteModel;
        } catch {
            return null;
        }
        for (const [roleId] of userObject.roles.cache) {
            try {
                await userObject.roles.remove(roleId);
            } catch {
            }
        }
        await userObject.roles.add(muteRoleId);
        if (hasTimeout) {
            MuteSingleton.instance.createTimeout(blockUserObject.id, blockUserObject.username, millis, user.guild, muteRoleId);
        }
        return savedModel;
    }

    public async doRemove(userId: string, guildId: string, muteRoleId: string, skipPersistence = false): Promise<void> {
        const whereClaus = {
            where: {
                userId,
                guildId
            }
        };
        const muteModel = await MuteModel.findOne(whereClaus);
        if (!muteModel) {
            throw new Error('That user is not currently muted.');
        }
        const prevRoles = await muteModel.getPrevRoles();
        const rowCount = await MuteModel.destroy(whereClaus);
        if (rowCount != 1) {
            throw new Error('That user is not currently muted.');
        }
        if (!skipPersistence) {
            const persistenceModelRowCount = await RolePersistenceModel.destroy(whereClaus);
            if (persistenceModelRowCount != 1) {
                //the application has SHIT itself, if one table has an entry but the other not, fuck knows what to do here...
                throw new Error("Unknown error occurred, error is a synchronisation issue between the Persistence model and the Mute Model ");
            }
        }
        let job: Job = null;
        for (const _job of this._mutes) {
            const {name} = _job;
            if (userId === name) {
                console.log(`cleared timeout for ${name}`);
                _job.cancel();
                job = _job;
            }
        }
        if (job) {
            this._mutes.delete(job);
        }
        const guild = await Main.client.guilds.fetch(guildId);
        let member;
        try {
            member = await guild.members.fetch(userId);
        } catch {
            return;
        }

        await member.roles.remove(muteRoleId);
        for (const roleId of prevRoles) {
            const role = await (await GuildManager.instance.getGuild(guildId)).roles.fetch(roleId);
            console.log(`re-applying role ${role.name} to ${member.user.username}`);
            try {
                await member.roles.add(role.id);
            } catch {

            }
        }
        try {
            DiscordUtils.postToLog(`User: "<@${userId}>" has been un-muted`, guildId);
        } catch {
        }
    }

    public createTimeout(userId: string, username: string, millis: number, guild: Guild, muteRoleId: string): void {
        const now = Date.now();
        const future = now + millis;
        const newDate = new Date(future);
        for (const mute of this._mutes) {
            if (mute.name === userId) {
                return;
            }
        }
        try {
            const job = schedule.scheduleJob(userId, newDate, async () => {
                await Main.dao.transaction(async t => {
                    await MuteSingleton.instance.doRemove(userId, guild.id, muteRoleId);
                });
                DiscordUtils.postToLog(`User ${username} has been unblocked after timeout`, guild.id);
            });
            this._mutes.add(job);
        } catch {
        }
    }

    private addRolePersist(user: GuildMember, muteRoleId: string): Promise<RolePersistenceModel> {
        return super.commitToDatabase(new RolePersistenceModel({
            "userId": user.id,
            "roleId": muteRoleId,
            guildId: user.guild.id
        })) as Promise<RolePersistenceModel>;
    }

}