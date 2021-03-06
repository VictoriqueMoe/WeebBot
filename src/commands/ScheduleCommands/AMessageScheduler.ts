import {Command, CommandMessage, Guard} from "@typeit/discord";
import {ChronException, ChronUtils, DiscordUtils, StringUtils} from "../../utils/Utils";
import {TextChannel} from "discord.js";
import {MessageScheduler} from "../../model/scheduler/impl/MessageScheduler";
import {secureCommand} from "../../guards/RoleConstraint";
import {AbstractCommandModule} from "../AbstractCommandModule";

export abstract class AMessageScheduler extends AbstractCommandModule<any> {

    constructor() {
        super({
            module: {
                name: "MessageScheduler",
                description: "Commands to schedule messages to send every x or at x"
            },
            commands: [
                {
                    name: "scheduleMessage"
                },
                {
                    name: "cancelAllScheduledMessages"
                },
                {
                    name: "cancelScheduledMessage"
                },
                {
                    name: "getAllScheduledMessages"
                }
            ]
        });
    }

    @Command("scheduleMessage")
    @Guard(secureCommand)
    private scheduleMessage(command: CommandMessage): void {
        const argumentArray = StringUtils.splitCommandLine(command.content);
        if (argumentArray.length !== 4) {
            command.reply("Arguments invalid, please make sure you supply: Name, Message, Chron and channelID each in quotes");
            return;
        }
        const [name, message, chron, channelName] = StringUtils.splitCommandLine(command.content);
        const channel = DiscordUtils.findChannelByName(channelName, command.guild.id);
        if (channel == null) {
            command.reply("Invalid channel name");
            return;
        }
        if (!(channel instanceof TextChannel)) {
            command.reply("This command only works on test channels");
            return;
        }
        try {
            MessageScheduler.getInstance().register(name, chron, () => (channel as TextChannel).send(message), channel);
        } catch (e) {
            if (e instanceof ChronException) {
                command.reply("Chron format is invalid");
                return;
            }
            throw e;
        }

        command.reply(`job "${name}" has been scheduled to post ${ChronUtils.chronToString(chron)} on channel "<#${channel.id}>" \n any jobs with this name have been replaced`);
    }

    @Command("cancelAllScheduledMessages")
    @Guard(secureCommand)
    private cancelAllScheduledMessages(command: CommandMessage): void {
        MessageScheduler.getInstance().cancelAllJobs();
        command.reply("All scheduled posts have been cancelled");
    }

    @Command("cancelScheduledMessage")
    @Guard(secureCommand)
    private cancelScheduledMessage(command: CommandMessage): void {
        const names = StringUtils.splitCommandLine(command.content);
        for (const name of names) {
            MessageScheduler.getInstance().cancelJob(name);
        }

        command.reply(`Job(s) cancelled`);
    }

    @Command("getAllScheduledMessages")
    @Guard(secureCommand)
    private getAllScheduledMessages(command: CommandMessage): void {
        const allJobs = MessageScheduler.getInstance().jobs;
        if (allJobs.length === 0) {
            command.reply("There are no pending scheduled messages");
            return;
        }
        const str = `there are ${allJobs.length} scheduled posts active \n` + allJobs.map(job => {
            const channelThisJobBelongsTo = job.channel;
            const nameOfJob = job.name;
            return `${nameOfJob} posts to "<#${channelThisJobBelongsTo.id}>"`;
        }).join("\n");
        command.reply(str);
    }
}