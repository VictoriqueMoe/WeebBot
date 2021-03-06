import {AbstractFilter} from "../AbstractFilter";
import {ACTION} from "../../../../../enums/ACTION";
import {Message} from "discord.js";
import {InjectDynoSubModule} from "../../../../decorators/InjectDynoSubModule";
import {PRIORITY} from "../../../../../enums/PRIORITY";
import {DynoAutoMod} from "../../../../../managedEvents/messageEvents/closeableModules/DynoAutoMod";
import {ObjectUtil} from "../../../../../utils/Utils";

const getUrls = require('get-urls');

@InjectDynoSubModule(DynoAutoMod)
export class SelfBotFilter extends AbstractFilter {

    public get actions(): ACTION[] {
        return [ACTION.DELETE, ACTION.WARN, ACTION.MUTE];
    }

    public get isActive(): boolean {
        return true;
    }

    public get id(): string {
        return "Self Bot Detection";
    }

    public get warnMessage(): string {
        return `Rich embeds are only allowed from bots, This smells like a self embed, please stop`;
    }

    public get priority(): number {
        return PRIORITY.LAST;
    }

    public doFilter(content: Message): boolean {
        const embeds = content.embeds;
        for (const embed of embeds) {
            const embedUrl = embed.url;
            if (ObjectUtil.validString(embedUrl)) {
                return true;
            }
            if (embed.type === "rich") {
                return false;
            }
        }
        return true;
    }

    public async postProcess(message: Message): Promise<void> {
        await super.postToLog("Self bot detection", message);
    }
}