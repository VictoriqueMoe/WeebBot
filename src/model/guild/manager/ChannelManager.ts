import {BaseDAO} from "../../../DAO/BaseDAO";
import {PostableChannelModel} from "../../DB/guild/PostableChannel.model";
import {TextChannel} from "discord.js";
import {ObjectUtil} from "../../../utils/Utils";
import {GuildManager} from "./GuildManager";

export class ChannelManager extends BaseDAO<PostableChannelModel> {
    private constructor() {
        super();
    }

    private static _instance: ChannelManager;

    public static get instance(): ChannelManager {
        if (!ChannelManager._instance) {
            ChannelManager._instance = new ChannelManager();
        }
        return ChannelManager._instance;
    }

    private static getModel(guildId: string, attra: "logChannel" | "AdminLogchannel"): Promise<PostableChannelModel> {
        return PostableChannelModel.findOne({
            attributes: [attra],
            where: {
                guildId
            }
        });
    }

    public async getLogChannel(guildId: string): Promise<TextChannel | null> {
        const model = await ChannelManager.getModel(guildId, "logChannel");
        if (!model || !ObjectUtil.validString(model.logChannel)) {
            return null;
        }
        const channelId = model.logChannel;
        const guild = await GuildManager.instance.getGuild(guildId);
        const channel = await guild.channels.resolve(channelId);
        if (channel instanceof TextChannel) {
            return channel;
        }
        throw new Error("Log channel is NOT text channel");
    }

    public async getAdminLogChannel(guildId: string): Promise<TextChannel | null> {
        const model = await ChannelManager.getModel(guildId, "AdminLogchannel");
        if (!model || !ObjectUtil.validString(model.AdminLogchannel)) {
            return null;
        }
        const channelId = model.AdminLogchannel;
        const guild = await GuildManager.instance.getGuild(guildId);
        const channel = await guild.channels.resolve(channelId);
        if (channel instanceof TextChannel) {
            return channel;
        }
        throw new Error("Admin log channel is NOT text channel");
    }
}