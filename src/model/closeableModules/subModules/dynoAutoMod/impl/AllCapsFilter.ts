import {AbstractFilter} from "../AbstractFilter";
import {ACTION} from "../../../../../enums/ACTION";
import {Message} from "discord.js";
import {InjectDynoSubModule} from "../../../../decorators/InjectDynoSubModule";
import {PRIORITY} from "../../../../../enums/PRIORITY";
import {DynoAutoMod} from "../../../../../events/closeableModules/DynoAutoMod";
import {ObjectUtil} from "../../../../../utils/Utils";
import {AllCapsFilterSettings} from "../../../settings/automod/filters/AllCapsFilterSettings";

@InjectDynoSubModule(DynoAutoMod)
export class AllCapsFilter extends AbstractFilter<AllCapsFilterSettings> {

    public get actions(): ACTION[] {
        return [];
    }

    public get id(): string {
        return "All Caps Filter";
    }

    public get isActive(): boolean {
        return false;
    }

    public get priority(): number {
        return PRIORITY.LAST;
    }

    public get warnMessage(): string {
        return "Your message contains too many caps";
    }

    public doFilter(content: Message): boolean {
        return ObjectUtil.getAmountOfCapsAsPercentage(content.content) < 70;
    }

    public async postProcess(message: Message): Promise<void> {
        await super.postToLog("Too many caps", message);
    }
}