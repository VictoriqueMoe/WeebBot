import {CloseableModule} from "./CloseableModule";
import {ITriggerConstraint} from "../ITriggerConstraint";
import {IEventSecurityConstraint} from "../../DB/IEventSecurityConstraint";
import {GuildChannel, Message} from "discord.js";
import {ArrayUtils} from "../../../utils/Utils";
import {ModuleSettings} from "../settings/ModuleSettings";

export abstract class TriggerConstraint<T extends ModuleSettings> extends CloseableModule<T> implements ITriggerConstraint {

    canTrigger(obj: IEventSecurityConstraint, message: Message): boolean {
        const member = message.member;
        if (!member) {
            return false;
        }
        const roleIds = member.roles.cache.array().map(role => role.id);
        const channel = message.channel;
        if (!(channel instanceof GuildChannel)) {
            return false;
        }
        const channelId = channel.id;
        const parentChannelId = channel.parentID;
        const {allowedChannels, allowedRoles, ignoredChannels, ignoredRoles} = obj;
        if (ArrayUtils.isValidArray(allowedChannels)) {
            if (!allowedChannels.some(chId => chId.id === channelId || chId.id === parentChannelId)) {
                return false;
            }
        } else if (ArrayUtils.isValidArray(ignoredChannels)) {
            if (ignoredChannels.some(chId => chId.id === channelId || chId.id === parentChannelId)) {
                return false;
            }
        }

        if (ArrayUtils.isValidArray(allowedRoles)) {
            if (!allowedRoles.some(role => roleIds.includes(role.id))) {
                return false;
            }
        } else if (ArrayUtils.isValidArray(ignoredRoles)) {
            if (ignoredRoles.some(role => roleIds.includes(role.id))) {
                return false;
            }
        }
        return true;
    }

    public abstract get isDynoReplacement(): boolean;

}