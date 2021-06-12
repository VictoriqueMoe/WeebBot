import {CloseableModule} from "../../../model/closeableModules/impl/CloseableModule";
import {ArgsOf, Client, On} from "@typeit/discord";
import {CloseOptionModel} from "../../../model/DB/autoMod/impl/CloseOption.model";
import * as schedule from "node-schedule";
import {AbstractRoleApplier} from "../../customAutoMod/RoleApplier/AbstractRoleApplier";
import {GuildMember, Role} from "discord.js";
import {RolePersistenceModel} from "../../../model/DB/autoMod/impl/RolePersistence.model";
import {DiscordUtils, GuildUtils, ObjectUtil, TimeUtils} from "../../../utils/Utils";
import {GuildManager} from "../../../model/guild/manager/GuildManager";
import {UniqueViolationError} from "../../../DAO/BaseDAO";
import {BannedWordFilter} from "../../../model/closeableModules/subModules/dynoAutoMod/impl/BannedWordFilter";
import {AutoRoleSettings} from "../../../model/closeableModules/settings/AutoRoleSettings";
import TIME_UNIT = TimeUtils.TIME_UNIT;

class RoleProxy extends AbstractRoleApplier {
    public async applyRole(role: Role, member: GuildMember, reason?: string): Promise<void> {
        return super.applyRole(role, member, reason);
    }

    public async roleLeaves(role: Role, member: GuildMember, model: typeof RolePersistenceModel): Promise<RolePersistenceModel> {
        return super.roleLeaves(role, member, model);
    }
}

export class AutoRole extends CloseableModule<AutoRoleSettings> {

    private _roleApplier = new RoleProxy();

    private static _uid = ObjectUtil.guid();

    constructor() {
        super(CloseOptionModel, AutoRole._uid, "AutoRole");
    }

    @On("guildMemberAdd")
    private async memberJoins([member]: ArgsOf<"guildMemberAdd">, client: Client): Promise<void> {
        const guildId = member.guild.id;
        if (!await this.canRun(guildId, null, null)) {
            return;
        }
        let settings = await this.getSettings(guildId);
        if (!ObjectUtil.isValidObject(settings)) {
            settings = {};
        }
        if (settings.minAccountAge > 0) {
            const convertedTime = TimeUtils.convertToMilli(settings.minAccountAge, TIME_UNIT.days);
            const memberCreated = member.user.createdAt.getTime();
            const now = Date.now();
            const accountAge = now - memberCreated;
            if (accountAge < convertedTime) {
                const accountAgeHuman = ObjectUtil.secondsToHuman(convertedTime / 1000);
                try {
                    await GuildUtils.applyYoungAccountConstraint(member, accountAgeHuman);
                } catch {
                }
                return;
            }
        }

        const now = Date.now();
        const oneMin = 60000;
        const toAddRole = now + oneMin;
        const d = new Date(toAddRole);
        schedule.scheduleJob(`enable ${member.user.tag}`, d, async () => {
            // load member in case they have left the guild before the timeout
            try {
                member = await member.fetch(true);
            } catch {
                return;
            }

            if (member.deleted) {
                return;
            }
            if (member.roles.cache.size > 0) {
                // this user already has roles, don't bother applying anything
                return;
            }
            const module = DiscordUtils.getModule("DynoAutoMod");
            const filter: BannedWordFilter = module.submodules.find(m => m instanceof BannedWordFilter) as BannedWordFilter;
            if (filter.isActive && await filter.checkUsername(member)) {
                return;
            }
            const autoRole = await GuildUtils.RoleUtils.getAutoRole(guildId);
            const persistedRole = await RolePersistenceModel.findOne({
                where: {
                    userId: member.id,
                    guildId
                }
            });
            try {
                if (persistedRole) {
                    const guild = await GuildManager.instance.getGuild(guildId);
                    const rolePersisted = await guild.roles.fetch(persistedRole.roleId);
                    const jailRole = await GuildUtils.RoleUtils.getJailRole(guildId);
                    const muteRole = await GuildUtils.RoleUtils.getMuteRole(guildId);
                    if (jailRole && rolePersisted.id === jailRole.id) {
                        if (settings.autoJail) {
                            DiscordUtils.postToLog(`Member <@${member.user.id}> has rejoined after leaving in jail and has be re-jailed`, member.guild.id);
                            await this._roleApplier.applyRole(rolePersisted, member, "added via VicBot");
                        }
                    } else if (muteRole && rolePersisted.id === muteRole.id) {
                        if (settings.autoMute) {
                            DiscordUtils.postToLog(`Member <@${member.user.id}> has rejoined after leaving as muted and has been re-muted.`, member.guild.id);
                            await this._roleApplier.applyRole(rolePersisted, member, "added via VicBot");
                        }
                    } else {
                        await this._roleApplier.applyRole(rolePersisted, member, "added via VicBot");
                    }
                    return;
                }
            } catch {
            }
            if (autoRole) {
                try {
                    await this._roleApplier.applyRole(autoRole, member, "added via VicBot");
                } catch {
                }
            }
        });
    }

    @On("guildMemberRemove")
    private async specialLeave([member]: ArgsOf<"guildMemberRemove">, client: Client): Promise<void> {
        if (!await this.isEnabled(member.guild.id)) {
            return;
        }
        const jailRole = await GuildUtils.RoleUtils.getJailRole(member.guild.id);
        if (!jailRole) {
            return;
        }
        const model = await this._roleApplier.roleLeaves(jailRole, member as GuildMember, RolePersistenceModel);
        if (model) {
            try {
                // @ts-ignore
                await super.commitToDatabase(model, {}, true);
            } catch (e) {
                if (e instanceof UniqueViolationError) {
                    return;
                }
            }
        }
    }

    public get isDynoReplacement(): boolean {
        return true;
    }
}