import {Message} from "discord.js";
import {ISubModule} from "../ISubModule";
import {ACTION} from "../../../../enums/ACTION";
import {AutoModSettings} from "../../settings/automod/AutoModSettings";
import {BaseAutoModFilterSettings} from "../../settings/automod/filters/BaseAutoModFilterSettings";

/**
 * all values hard coded for now, but will be persisted in the future
 */
export interface IDynoAutoModFilter<T extends BaseAutoModFilterSettings> extends ISubModule<AutoModSettings> {
    /**
     * Get the actions that are done when this filter is violated
     */
    readonly actions: ACTION[];

    /**
     * Message used to warn when action includes ACTION.WARN
     */
    readonly warnMessage: string

    /**
     * The priority of this filter, this will determine if this filter is applied before or after others
     */
    readonly priority: number;

    /**
     * Do the actual filter and return true if it passes or false otherwise
     * @param content
     */
    doFilter(content: Message): boolean;

    /**
     * Do any additional processing like posting to logs
     * @param member
     */
    postProcess(member: Message): Promise<void>;

}