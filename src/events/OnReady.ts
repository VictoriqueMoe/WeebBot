import {DIService, On} from "@typeit/discord";
import {Main} from "../Main";
import {VicDropbox} from "../model/dropbox/VicDropbox";
import {MuteModel} from "../model/DB/autoMod/impl/Mute.model";
import {Op} from "sequelize";
import {ArrayUtils, GuildUtils, loadClasses, ObjectUtil} from "../utils/Utils";
import {Guild} from "discord.js";
import {UsernameModel} from "../model/DB/autoMod/impl/Username.model";
import {BaseDAO, UniqueViolationError} from "../DAO/BaseDAO";
import {MuteSingleton} from "../commands/customAutoMod/userBlock/MuteSingleton";
import {BotServer} from "../api/BotServer";
import {GuildableModel} from "../model/DB/guild/Guildable.model";
import {CommandSecurityModel} from "../model/DB/guild/CommandSecurity.model";
import {CommandSecurityManager} from "../model/guild/manager/CommandSecurityManager";
import {PostableChannelModel} from "../model/DB/guild/PostableChannel.model";
import {IBannedWordDynoAutoModFilter} from "../model/closeableModules/subModules/dynoAutoMod/IBannedWordDynoAutoModFilter";
import {ISubModule} from "../model/closeableModules/subModules/ISubModule";
import {CloseOptionModel} from "../model/DB/autoMod/impl/CloseOption.model";
import {AutoRole} from "./closeableModules/autoRole/AutoRole";
import {GuildManager} from "../model/guild/manager/GuildManager";
import * as fs from 'fs';

const io = require('@pm2/io');

/**
 * TODO: couple this class to appropriate classes
 */
export class OnReady extends BaseDAO<any> {
    private readonly classesToLoad = [`${__dirname}/../model/closeableModules/subModules/dynoAutoMod/impl/*.{ts,js}`, `${__dirname}/../managedEvents/**/*.{ts,js}`];

    private static async initiateMuteTimers(): Promise<void> {
        const mutesWithTimers = await MuteModel.findAll({
            where: {
                timeout: {
                    [Op.not]: null
                }
            }
        });
        const now = Date.now();
        for (const mute of mutesWithTimers) {
            const mutedRole = await GuildUtils.RoleUtils.getMuteRole(mute.guildId);
            if (!mutedRole) {
                continue;
            }
            const muteCreated = (mute.createdAt as Date).getTime();
            const timerLength = mute.timeout;
            const timeLeft = timerLength - (now - muteCreated);
            const guild: Guild = await Main.client.guilds.fetch(mute.guildId);
            if (timeLeft <= 0) {
                console.log(`Timer has expired for user ${mute.username}, removing from database`);
                await MuteModel.destroy({
                    where: {
                        id: mute.id,
                        guildId: mute.guildId
                    }
                });
            } else {
                console.log(`Re-creating timed mute for ${mute.username}, time reamining is: ${ObjectUtil.secondsToHuman(Math.round(timeLeft / 1000))}`);
                MuteSingleton.instance.createTimeout(mute.userId, mute.username, timeLeft, guild, mutedRole.id);
            }
        }
    }

    private static async applyEmptyRoles(): Promise<Map<Guild, string[]>> {
        const retMap: Map<Guild, string[]> = new Map();
        const guildModels = await GuildableModel.findAll({
            include: [CommandSecurityModel]
        });
        for (const guildModel of guildModels) {
            const guildId = guildModel.guildId;
            const guild = await GuildManager.instance.getGuild(guildId);
            const autoRoleModule: AutoRole = DIService.instance.getService(AutoRole);
            const enabled = await autoRoleModule.isEnabled(guildId);
            if (enabled) {
                const membersApplied: string[] = [];
                const members = await guild.members.fetch({
                    force: true
                });
                const noRoles = members.array().filter(member => {
                    const roles = member.roles.cache.array();
                    for (const role of roles) {
                        if (role.name !== "@everyone") {
                            return false;
                        }
                    }
                    return true;
                });
                for (const noRole of noRoles) {
                    console.log(`setting roles for ${noRole.user.tag} as they have no roles`);
                    membersApplied.push(noRole.user.tag);
                    await autoRoleModule.applyRole(noRole, guildId);
                }
                retMap.set(guild, membersApplied);
            }
        }
        return retMap;
    }

    private static async loadCustomActions(): Promise<void> {
        io.action('getLogs', async (cb) => {
            const url = `${__dirname}/../../logs/combined.log`;
            const log = fs.readFileSync(url, {
                encoding: 'utf8'
            });
            return cb(log);
        });

        io.action('force member roles', async (cb) => {
            const appliedMembers = await OnReady.applyEmptyRoles();
            let message = "";
            for (const [guild, members] of appliedMembers) {
                if (members.length === 0) {
                    continue;
                }
                message += `\n----- ${guild.name} ----`;
                for (const member of members) {
                    message += `\n${member}\n`;
                }
                message += `---------\n`;
            }
            if (!ObjectUtil.validString(message)) {
                message = "No Members with no roles found";
            }
            return cb(message);
        });
    }

    public init(): Promise<any>[] {
        const pArr: Promise<any>[] = [];
        pArr.push(this.populateClosableEvents());
        pArr.push(Main.setDefaultSettings());
        pArr.push(this.populateCommandSecurity());
        pArr.push(this.populatePostableChannels());
        pArr.push(this.cleanUpGuilds());
        return pArr;
    }

    @On("ready")
    private async initialize(): Promise<void> {
        if (Main.testMode) {
            await Main.client.user.setActivity("Under development", {type: "LISTENING"});
            await Main.client.user.setPresence({
                status: "idle"
            });
        } else {
            await Main.client.user.setActivity('Half-Life 3', {type: 'PLAYING'});
        }
        const pArr: Promise<any>[] = [];
        await this.populateGuilds();
        pArr.push(VicDropbox.instance.index());
        pArr.push(OnReady.initiateMuteTimers());
        pArr.push(this.initUsernames());
        pArr.push(...this.init());
        pArr.push(OnReady.applyEmptyRoles());
        pArr.push(loadClasses(...this.classesToLoad));
        pArr.push(this.startServer());
        pArr.push(OnReady.loadCustomActions());
        return Promise.all(pArr).then(() => {
            console.log("Bot logged in.");
            if (process.send) {
                process.send('ready');
            }
        });
    }

    private async initUsernames(): Promise<void> {
        const allModels = await GuildableModel.findAll({
            include: [UsernameModel]
        });
        const pArr: Promise<void>[] = [];
        for (const model of allModels) {
            const guild = await Main.client.guilds.fetch(model.guildId);
            const userNameModels = model.usernameModel;
            const innerPromiseArray = userNameModels.map(userNameModel => {
                return guild.members.fetch(userNameModel.userId).then(member => {
                    return member.setNickname(userNameModel.usernameToPersist);
                }).then(member => {
                    console.log(`Set username for "${member.user.username}" to "${userNameModel.usernameToPersist}"`);
                }).catch(reason => {
                    console.log(`Unable to set username for user ${userNameModel.userId} as they no longer exist in this guild`);
                });
            });
            pArr.push(...innerPromiseArray);
        }
        await Promise.all(pArr);
        console.log("set all Usernames");
    }

    private async populateClosableEvents(): Promise<void> {
        const allModules = Main.closeableModules;
        for (const module of allModules) {
            await Main.dao.transaction(async t => {
                for (const [guildId, guild] of Main.client.guilds.cache) {
                    const moduleId = module.moduleId;
                    const modelPercisted = await CloseOptionModel.findOne({
                        where: {
                            moduleId,
                            guildId
                        }
                    });
                    if (modelPercisted) {
                        if (modelPercisted.status) {
                            const moduleName = ObjectUtil.validString(module.constructor.name) ? module.constructor.name : "";
                            console.log(`Module: ${modelPercisted.moduleId} (${moduleName})for guild "${guild.name}" (${guildId}) enabled`);
                        }
                    } else {
                        const m = new CloseOptionModel({
                            moduleId,
                            guildId
                        });
                        try {
                            await super.commitToDatabase(m);
                        } catch (e) {
                            if (!(e instanceof UniqueViolationError)) {
                                throw e;
                            }
                        }
                    }
                    /*const subModules = module.submodules;
                    for (const subModule of subModules) {
                        const subModulePercisted = await SubModuleModel.findOne({
                            where: {
                                subMuldeId: subModule.id,
                                guildId
                            }
                        });
                        if (subModulePercisted) {
                            continue;
                        }
                        const autoMod = new SubModuleModel({
                            "subMuldeId": subModule.id,
                            "isActive": false,
                            guildId,
                            "moduleId": module.moduleId
                        });
                        try {
                            await super.commitToDatabase(autoMod);
                        } catch (e) {
                            if (!(e instanceof UniqueViolationError)) {
                                throw e;
                            }
                        }
                    }*/
                }
            });
        }
        /*const foo = await SubModuleModel.findAll();
        const bar = await CloseOptionModel.findAll();
        const b = bar[8].submodules;
        console.log("foo");*/
    }

    private isIBannedWordDynoAutoModFilter(module: ISubModule): module is IBannedWordDynoAutoModFilter {
        return "bannedWords" in module;
    }

    private async startServer(): Promise<void> {
        const server = await BotServer.getInstance();
        const startServer = server.start(4401);
        Main.botServer = startServer;
    }

    private async populateGuilds(): Promise<void> {
        const guilds = Main.client.guilds.cache;
        return Main.dao.transaction(async t => {
            for (const [guildId] of guilds) {
                const guild = new GuildableModel({
                    guildId
                });
                try {
                    await super.commitToDatabase(guild, {}, true);
                } catch (e) {
                    if (!(e instanceof UniqueViolationError)) {
                        throw e;
                    }
                }
            }
        });
    }

    private async populateCommandSecurity(): Promise<void> {
        const guildModels = await GuildableModel.findAll({
            include: [CommandSecurityModel]
        });
        for (const guildModel of guildModels) {
            const guildId = guildModel.guildId;
            const commandSecurity = guildModel.commandSecurityModel;
            const allCommands = CommandSecurityManager.instance.runnableCommands;
            await Main.dao.transaction(async t => {
                const models: {
                    commandName: string, guildId: string
                }[] = [];
                for (const commandCLazz of allCommands) {
                    const {commands} = commandCLazz.commandDescriptors;
                    for (const {name} of commands) {
                        const inArray = ArrayUtils.isValidArray(commandSecurity) && commandSecurity.some(value => value.commandName === name);
                        if (!inArray) {
                            models.push({
                                commandName: name,
                                guildId
                            });
                        }
                    }
                }
                return CommandSecurityModel.bulkCreate(models);
            });
        }
    }

    private async populatePostableChannels(): Promise<void> {
        const guildModels = await GuildableModel.findAll({
            include: [CommandSecurityModel]
        });
        const currentModels = await PostableChannelModel.findAll();
        const models: {
            guildId: string
        }[] = [];
        await Main.dao.transaction(async t => {
            for (const guildModel of guildModels) {
                const guildId = guildModel.guildId;
                if (currentModels.some(m => m.guildId === guildId)) {
                    continue;
                }
                models.push({
                    guildId
                });
            }
            return PostableChannelModel.bulkCreate(models);
        });
    }

    private async cleanUpGuilds(): Promise<void> {
        const guildsJoined = Main.client.guilds.cache.keyArray();
        for (const guildsJoinedId of guildsJoined) {
            const guildModels = await GuildableModel.findOne({
                where: {
                    "guildId": guildsJoinedId
                }
            });
            if (!guildModels) {
                await GuildableModel.destroy({
                    cascade: true,
                    where: {
                        guildId: guildsJoinedId
                    }
                });
            }
        }
    }
}