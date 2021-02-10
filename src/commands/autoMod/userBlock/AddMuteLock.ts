import {Command, CommandMessage, Description, Guard} from "@typeit/discord";
import {DiscordUtils, ObjectUtil, StringUtils} from "../../../utils/Utils";
import {MuteModel} from "../../../model/DB/autoMod/Mute.model";
import {BaseDAO} from "../../../DAO/BaseDAO";
import {NotBot} from "../../../guards/NotABot";
import {roleConstraints} from "../../../guards/RoleConstraint";
import {Roles} from "../../../enums/Roles";
import {BlockGuard} from "../../../guards/BlockGuard";
import {Guild, TextChannel, User} from "discord.js";
import RolesEnum = Roles.RolesEnum;
import Timeout = NodeJS.Timeout;

export abstract class AddMuteLock extends BaseDAO<MuteModel> {

    private static _timeOutMap: Map<User, Map<number, Timeout>> = new Map<User, Map<number, Timeout>>();

    private constructor() {
        super();
        AddMuteLock._timeOutMap = new Map();
    }

    @Command("mute")
    @Description(AddMuteLock.getDescription())
    @Guard(NotBot, roleConstraints(RolesEnum.CIVIL_PROTECTION, RolesEnum.OVERWATCH_ELITE), BlockGuard)
    private async mute(command: CommandMessage): Promise<MuteModel> {
        let argumentArray = StringUtils.splitCommandLine(command.content);
        if (argumentArray.length !== 3 && argumentArray.length !== 2) {
            command.reply(`Command arguments wrong, usage: ~mute <"username"> <"reason"> [timeout in seconds]`);
            return;
        }
        let [, reason, timeout] = argumentArray;
        let creatorID = command.member.id;
        let mentionedUserCollection = command.mentions.users;
        if (mentionedUserCollection.size !== 1) {
            command.reply("You must specify ONE user in your arguments");
            return;
        }
        let blockedUserId = mentionedUserCollection.keys().next().value;
        let blockUserObject = mentionedUserCollection.get(blockedUserId);
        let didYouBlockABot = blockUserObject.bot;
        let canBlock = await DiscordUtils.canUserPreformBlock(command);

        if (creatorID == blockedUserId) {
            command.reply("You can not block yourself!");
            return;
        }

        if (!canBlock) {
            command.reply("You can not block a member whose role is above or on the same level as yours!");
            return;
        }
        if (didYouBlockABot) {
            command.reply("You can not block a bot");
            return;
        }

        let obj = {
            userId: blockedUserId,
            reason,
            creatorID
        };
        let hasTimeout = ObjectUtil.validString(timeout) && !Number.isNaN(Number.parseInt(timeout));
        if (hasTimeout) {
            obj["timeout"] = (Number.parseInt(timeout) * 1000);
        }
        let model = new MuteModel(obj);
        let savedModel = await super.commitToDatabase(model);
        let userObject = await command.guild.members.fetch(savedModel.userId);
        let replyMessage = `User "${userObject.user.username}" has been muted from this server with reason "${savedModel.reason}"`;
        if (hasTimeout) {
            let timeOutSec = Number.parseInt(timeout);
            let millis = timeOutSec * 1000;
            AddMuteLock.createTimeout(blockUserObject, millis, command.guild);
            replyMessage += ` for ${ObjectUtil.secondsToHuman(timeOutSec)}`;
        }
        command.reply(replyMessage);
        return savedModel;
    }

    public static get timeOutMap(): Map<User, Map<number, Timeout>> {
        return AddMuteLock._timeOutMap;
    }


    public static createTimeout(user: User, millis: number, guild: Guild): void {
        let timeOut: Timeout = setTimeout(async (member: User) => {
            await MuteModel.destroy({
                where: {
                    userId: user.id
                }
            });
            let channel = await guild.channels.resolve("327484813336641536") as TextChannel; // logs channel
            //let channel = await guild.channels.resolve("793994947241312296") as TextChannel; // test channel
            channel.send(`User ${member.username} has been unblocked after timeout`);
            AddMuteLock._timeOutMap.delete(member);
        }, millis, user);
        AddMuteLock._timeOutMap.set(user, new Map([[millis, timeOut]]));
    }

    private static getDescription() {
        return `\n Block a user from sending any messages with reason \n usage: ~mute <"username"> <"reason"> [timeout in seconds] \n example: ~mute "@SomeUser" "annoying" 20 \n make sure that the @ is blue before sending`;
    }
}