import {AbstractFilter} from "../AbstractFilter";
import {ACTION} from "../../../../../enums/ACTION";
import {Message} from "discord.js";
import {InjectDynoSubModule} from "../../../../decorators/InjectDynoSubModule";
import {PRIORITY} from "../../../../../enums/PRIORITY";
import {DynoAutoMod} from "../../../../../events/closeableModules/DynoAutoMod";

@InjectDynoSubModule(DynoAutoMod)
export class DiscordInviteFilter extends AbstractFilter {

    public get actions(): ACTION[] {
        return [ACTION.DELETE];
    }

    public get id(): string {
        return "Discord Invite Filter";
    }

    public get isActive(): boolean {
        return true;
    }

    public get priority(): number {
        return PRIORITY.LAST;
    }

    public get warnMessage(): string {
        return "Your message can not contain discord invites";
    }

    public doFilter(content: Message): boolean {
        return !content.content.includes('discord.gg/' || 'discordapp.com/invite/' || 'discord.com/invite');
    }
}