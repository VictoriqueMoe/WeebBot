import {IDynoAutoModFilter} from "./IDynoAutoModFilter";
import {Message, MessageEmbed} from "discord.js";
import {SubModuleManager} from "../../manager/SubModuleManager";
import {ACTION} from "../../../../enums/ACTION";
import {ICloseableModule} from "../../ICloseableModule";
import {DiscordUtils} from "../../../../utils/Utils";
import {AutoModSettings} from "../../settings/automod/AutoModSettings";
import {BaseAutoModFilterSettings} from "../../settings/automod/filters/BaseAutoModFilterSettings";

export abstract class AbstractFilter<T extends BaseAutoModFilterSettings> implements IDynoAutoModFilter<T> {

    protected constructor(protected _parentModule: ICloseableModule<AutoModSettings>) {
        if (_parentModule != null) {
            SubModuleManager.instance.addSubModules(this);
        }
    }

    public get parentModule(): ICloseableModule<AutoModSettings> {
        return this._parentModule;
    }

    /**
     * this sets the amount of filters that define "mute" as punishment that needs to fail before they are muted automatically by the set autoMuteTimeout value
     */
    public static get autoMuteViolationCount(): number {
        return 3; //  hard-coded for now
    }

    /**
     * How long (in seconds) are members muted for if they violate "mute" filters according to the autoMuteViolationCount
     */
    public static get autoMuteTimeout(): number {
        return 300; //  hard-coded for now
    }

    /**
     * How long to wait (in seconds) to cooldown the autoMuteViolationCount value
     * <br/><br/>
     * if autoMuteViolationCount is set to 2 and this is set to 30 then each member will have 30 seconds to violate 2 MUTE filters starting from the first violation. If a member violates ONE mute role and not another within 30 seconds, then then the counter is reset to 0
     *
     */
    public static get muteViolationTimeout(): number {
        return 15; //  hard-coded for now
    }

    protected postToLog(reason: string, message: Message): Promise<Message | null> {
        if (!this.actions.includes(ACTION.DELETE)) {
            return null;
        }
        const {member} = message;
        const avatarUrl = member.user.displayAvatarURL({format: 'jpg', size: 1024});
        const embed = new MessageEmbed()
            .setColor(member.roles.highest.hexColor)
            .setAuthor(member.user.tag, avatarUrl)
            .setThumbnail(avatarUrl)
            .setTimestamp()
            .setDescription(`**Message sent by <@${member.id}> deleted in <#${message.channel.id}>** \n ${message.content}`)
            .addField("Reason", reason)
            .setFooter(`${member.user.id}`);
        return DiscordUtils.postToLog(embed, message.guild.id, false);
    }

    abstract readonly actions: ACTION[];
    abstract readonly id: string;
    abstract readonly isActive: boolean;
    abstract readonly warnMessage: string;

    public abstract postProcess(member: Message): Promise<void>;

    public abstract doFilter(content: Message): boolean;

    abstract readonly priority: number;
}