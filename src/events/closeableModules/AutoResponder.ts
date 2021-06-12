import {ArgsOf, Client, Guard, On} from "@typeit/discord";
import {NotBot} from "../../guards/NotABot";
import {ArrayUtils, ObjectUtil} from "../../utils/Utils";
import {CloseOptionModel} from "../../model/DB/autoMod/impl/CloseOption.model";
import {TriggerConstraint} from "../../model/closeableModules/impl/TriggerConstraint";
import {AutoResponderModel} from "../../model/DB/autoMod/impl/AutoResponder.model";
import {Message} from "discord.js";
import {MessageEventEditTrigger} from "../../model/decorators/MessageEventEditTrigger";

export class AutoResponder extends TriggerConstraint<null> {

    private static _uid = ObjectUtil.guid();

    constructor() {
        super(CloseOptionModel, AutoResponder._uid, "AutoResponder");
    }

    @MessageEventEditTrigger
    @On("message")
    @Guard(NotBot)
    private async process([message]: ArgsOf<"message">, client: Client, guardPayload: any, isUpdate = false): Promise<void> {
        const guildId = message.guild.id;
        const channel = message.channel;
        if (!await this.canRun(guildId, null, channel)) {
            return;
        }
        const allRespondObjects = await AutoResponderModel.findAll({
            where: {
                guildId
            }
        });
        const messageContent = message.content?.trim().toLowerCase();
        if (!ObjectUtil.validString(messageContent) || !ArrayUtils.isValidArray(allRespondObjects)) {
            return;
        }
        for (const autoResponder of allRespondObjects) {
            if (!super.canTrigger(autoResponder, message)) {
                continue;
            }
            const trigger = autoResponder.title;
            const {wildCard, useRegex, publicDelete} = autoResponder;
            let shouldTrigger = false;
            if (wildCard) {
                if (messageContent.includes(trigger.toLowerCase())) {
                    shouldTrigger = true;
                }
            } else if (useRegex) {
                const newContent = messageContent.replace(/[*_]/gi, "");
                const regex = new RegExp(trigger, 'gium');
                if (regex.test(newContent)) {
                    shouldTrigger = true;
                }
            } else {
                if (messageContent === trigger.toLowerCase()) {
                    shouldTrigger = true;
                }
            }
            if (!shouldTrigger) {
                continue;
            }
            const {responseType} = autoResponder;
            switch (responseType) {
                case "message": {
                    if (isUpdate) {
                        continue;
                    }
                    const responseText: string = await this._parseVars(autoResponder.response, message);
                    if (publicDelete) {
                        message.delete();
                    }
                    channel.send(responseText);
                    break;
                }
                case "delete":
                    if (message.deletable) {
                        message.delete();
                    }
                    break;
                case "reaction": {
                    const emojis = autoResponder.emojiReactions;
                    for (const emoji of emojis) {
                        try {
                            await message.react(emoji);
                        } catch (e) {
                            console.warn(e);
                        }
                    }
                    break;
                }
            }
        }
    }

    get isDynoReplacement(): boolean {
        return false;
    }

    private async _parseVars(response: string, {channel, guild, member}: Message): Promise<string> {
        let retStr = String(response);
        const regex = new RegExp(/{([^{}]+)}/gm);
        let result: RegExpExecArray;
        while ((result = regex.exec(response)) !== null) {
            for (let match of result) {
                if (!ObjectUtil.validString(match)) {
                    continue;
                }
                const prefix = match[0];
                if (prefix === "{") {
                    continue;
                }
                switch (prefix) {
                    case "@": {
                        // is inject user
                        if (!match.includes("#") || match.length <= 2) {
                            continue;
                        }
                        match = match.substring(1);
                        const member = guild.members.cache.find(v => v.user.tag == match);
                        if (!member) {
                            continue;
                        }
                        retStr = retStr.replace(`{@${match}}`, `<@${member.id}>`);
                        break;
                    }
                    case "&": {
                        // is inject role
                        match = match.substring(1);
                        const role = guild.roles.cache.find(r => r.name === match);
                        if (!role) {
                            continue;
                        }
                        retStr = retStr.replace(`{&${match}}`, `<@&${role.id}>`);
                        break;
                    }
                    case "#": {
                        // is inject channel
                        match = match.substring(1);
                        const channel = guild.channels.cache.find(c => c.name === match);
                        if (!channel) {
                            continue;
                        }
                        retStr = retStr.replace(`{#${match}}`, `<#${channel.id}>`);
                        break;
                    }
                    default:
                        switch (match) {
                            case "user":
                                retStr = retStr.replace(`{${match}}`, `<@${member.id}>`);
                                // mention user with tag
                                break;
                            case "server":
                                retStr = retStr.replace(`{${match}}`, `${guild.name}`);
                                // inject server name
                                break;
                            case "channel":
                                retStr = retStr.replace(`{${match}}`, `<#${channel.id}>`);
                                // inject channel
                                break;
                            default:
                                retStr = retStr.replace(`{${match}}`, `${member.user.username}`);
                                break;
                        }
                }
            }
        }
        return retStr;
    }
}