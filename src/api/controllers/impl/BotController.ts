import {ChildControllers, Controller, Get, Post} from "@overnightjs/core";
import {Request, Response} from 'express';
import {Main} from "../../../Main";
import {baseController} from "../BaseController";
import {DiscordUtils, EnumEx, GuildUtils, ObjectUtil} from "../../../utils/Utils";
import {Channel, Guild, GuildMember} from "discord.js";
import {StatusCodes} from "http-status-codes";
import {SETTINGS} from "../../../enums/SETTINGS";
import {SettingsManager} from "../../../model/settings/SettingsManager";
import {MuteModel} from "../../../model/DB/autoMod/impl/Mute.model";
import {MuteSingleton} from "../../../commands/customAutoMod/userBlock/MuteSingleton";
import {InjectController} from "../../../model/decorators/InjectController";
import {ModuleController} from "./modules/impl/ModuleController";
import {CommandSecurityManager} from "../../../model/guild/manager/CommandSecurityManager";
import {Typeings} from "../../../model/types/Typeings";
import CommandArgs = Typeings.CommandArgs;

@InjectController
@Controller("api/bot")
@ChildControllers([
    new ModuleController()
])
export class BotController extends baseController {

    @Post("unMuteMembers")
    private async unMuteMembers(req: Request, res: Response) {
        type payload = string[];
        let guild: Guild;
        try {
            guild = await this.getGuild(req);
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
        const muteRole = await GuildUtils.RoleUtils.getMuteRole(guild.id);
        if (!muteRole) {
            return;
        }
        const body: payload = req.body;
        for (const userId of body) {
            await Main.dao.transaction(async t => {
                await MuteSingleton.instance.doRemove(userId, guild.id, muteRole.id);
            });
        }
        return super.ok(res, {});
    }


    @Post(/(banUsers|kickUsers)/)
    private async banUsers(req: Request, res: Response) {
        type payload = {
            memberId: string,
            reason?: string
        }[];
        const body: payload = req.body;
        let guild: Guild;
        try {
            guild = await this.getGuild(req);
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
        for (const banInfo of body) {
            const {memberId, reason} = banInfo;
            let member: GuildMember = null;
            try {
                member = await guild.members.fetch(memberId);
            } catch {

            }
            if (member) {
                if (req.url === "/banUsers") {
                    if (member.bannable) {
                        await member.ban({
                            reason
                        });
                    }
                } else {
                    if (member.kickable) {
                        await member.kick(reason);
                    }
                }
            }
        }
        return super.ok(res, {});
    }


    @Post("setRolesForMembers")
    private async add(req: Request, res: Response) {
        type payload = {
            "userId": string,
            "roleIds": string[]
        }[];
        const body: payload = req.body;
        let guild: Guild;
        try {
            guild = await this.getGuild(req);
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
        try {
            for (const p of body) {
                const {userId, roleIds} = p;
                let member: GuildMember;
                try {
                    member = await guild.members.fetch(userId);
                } catch {
                    continue;
                }
                for (const [roleId] of member.roles.cache) {
                    try {
                        await member.roles.remove(roleId);
                    } catch {
                    }
                }
                await member.roles.add(roleIds);
            }
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.BAD_REQUEST);
        }
        return super.ok(res, {});
    }

    @Get('allCommands')
    private async allCommands(req: Request, res: Response) {
        let guild: Guild;
        try {
            guild = await this.getGuild(req);
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
        const commandClasses = CommandSecurityManager.instance.runnableCommands;
        const retObj: CommandArgs[] = [];
        for (const commandModule of commandClasses) {
            const {commandDescriptors} = commandModule;
            for (const command of commandDescriptors.commands) {
                const {name} = command;
                command["enabled"] = await CommandSecurityManager.instance.isEnabled(name, guild.id);
            }
            retObj.push(commandDescriptors);
        }
        return super.ok(res, retObj);
    }

    @Get('allGuilds')
    private async getAllGuilds(req: Request, res: Response) {
        const guilds = Main.client.guilds.cache;
        const obj = {};
        for (const [guildId, guild] of guilds) {
            obj[guildId] = guild.toJSON();
        }
        return super.ok(res, obj);
    }

    @Get('getSetting')
    private async getSetting(req: Request, res: Response) {
        let setting = req.query.setting as string;
        if (!ObjectUtil.validString(setting)) {
            return super.doError(res, `Please supply a setting`, StatusCodes.BAD_REQUEST);
        }
        setting = setting.toUpperCase();
        const settingEnum = EnumEx.loopBack(SETTINGS, setting, true) as SETTINGS;
        if (!settingEnum) {
            return super.doError(res, `Setting: "${setting}" not found`, StatusCodes.NOT_FOUND);
        }
        let guild: Guild;
        try {
            guild = await this.getGuild(req);
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
        const settingValue = await SettingsManager.instance.getSetting(settingEnum, guild.id);
        return super.ok(res, {
            [setting]: settingValue
        });
    }

    @Get('getAllRoles')
    private async getAllRoles(req: Request, res: Response) {
        let guild: Guild;
        try {
            guild = await this.getGuild(req);
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
        let roleArray = guild.roles.cache.array();
        roleArray = roleArray.filter(role => {
            const bot = guild.me;
            const botHighestRole = bot.roles.highest.position;
            return role.position < botHighestRole && !role.managed && role.name !== "@everyone";
        });
        const roleMap = roleArray.map(role => role.toJSON());
        return super.ok(res, roleMap);
    }

    @Get('getUsersFromRoles')
    private async getUsersFromRoles(req: Request, res: Response) {
        let guild: Guild;
        try {
            guild = await this.getGuild(req);
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
        const roleRequested = req.query.roleId as string;
        const roles = await guild.roles.fetch(roleRequested);
        const objArr = roles.members.array().map(member => {
            const json = member.toJSON();
            json["username"] = member.user.tag;
            return json;
        });
        return super.ok(res, objArr);
    }

    @Get('getMutes')
    private async getMutes(req: Request, res: Response) {
        let guild: Guild;
        try {
            guild = await this.getGuild(req);
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
        const currentBlocks = await MuteModel.findAll({
            where: {
                guildId: guild.id
            }
        });
        if (currentBlocks.length == 0) {
            return super.ok(res, []);
        }
        const data: string[][] = [];

        for (const currentBlock of currentBlocks) {
            const {userId, creatorID, timeout, reason, createdAt} = currentBlock;
            let username = currentBlock.username;
            let member: GuildMember = null;
            try {
                member = await guild.members.fetch(userId);
            } catch {

            }
            let creatorObj: GuildMember = null;
            try {
                creatorObj = await guild.members.fetch(creatorID);
            } catch {

            }
            let creatorTag = "N/A";
            if (creatorObj) {
                creatorTag = creatorObj.user.tag;
            }
            let nickName = "N/A";
            if (member) {
                if (member.nickname) {
                    nickName = member.nickname;
                }
                if (member.user) {
                    username = member.user.tag;
                }
            }
            const dateCreated = (createdAt as Date).getTime();
            const timeLeft = timeout - (Date.now() - dateCreated);
            const tmeLeftStr = ObjectUtil.secondsToHuman(Math.round(timeLeft / 1000));
            data.push([null, username, nickName, tmeLeftStr, creatorTag, reason, currentBlock.userId]);
        }
        return super.ok(res, data);
    }

    @Get('getChannel')
    private async getChannel(req: Request, res: Response) {
        try {
            const guild = await this.getGuild(req);
            const channel = await this.getChannelObject(req, guild);
            return super.ok(res, channel.toJSON());
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
    }

    @Get('getAllChannels')
    private async getAllChannels(req: Request, res: Response) {
        let guild: Guild = null;
        try {
            guild = await this.getGuild(req);
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
        const allChannels = guild.channels.cache.array();
        const ret = allChannels.map(channel => channel.toJSON());
        return super.ok(res, ret);
    }


    @Get('getGuild')
    private async getGuildFromId(req: Request, res: Response) {
        try {
            const guild = await this.getGuild(req);
            return super.ok(res, guild.toJSON());
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
    }

    private async getChannelObject(req: Request, guild: Guild): Promise<Channel> {
        const id = req.query.channelId as string;
        if (!ObjectUtil.validString(id)) {
            throw new Error("Please supply an ID");
        }
        let channel: Channel;
        try {
            channel = await guild.channels.resolve(id);
        } catch {
            throw new Error(`Channel with ID: ${id} not found`);
        }
        return channel;
    }

    @Get('getBotInfo')
    private async getBotInfo(req: Request, res: Response) {
        const bot = Main.client.user;
        if (!bot) {
            return super.doError(res, "Unable to fdind client", StatusCodes.INTERNAL_SERVER_ERROR);
        }
        let guild: Guild = null;
        let botMemeber: GuildMember;
        try {
            guild = await this.getGuild(req);
            botMemeber = await guild.members.fetch(bot);
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
        return super.ok(res, botMemeber.toJSON());
    }


    @Get('getEmojis')
    private async getEmojis(req: Request, res: Response) {
        let guild: Guild = null;
        try {
            guild = await this.getGuild(req);
        } catch (e) {
            return super.doError(res, e.message, StatusCodes.NOT_FOUND);
        }
        const emojiManager = guild.emojis;
        const pArr = emojiManager.cache.array().map(async emoji => {
            const emojiInfo = await DiscordUtils.getEmojiInfo(emoji.id, false);
            emojiInfo["name"] = emoji.name;
            return emojiInfo;
        });
        const emojis = await Promise.all(pArr).then(values => {
            return values.map(v => {
                return {
                    /* "buffer": v.buffer.toString("base64"),*/
                    "url": v.url,
                    "id": v.id,
                    // @ts-ignore
                    "name": v.name
                };
            });
        });
        return super.ok(res, emojis);
    }
}
