import {ArgsOf, Client, Guard, On} from "@typeit/discord";
import {MessageEntry} from "./MessageEntry";
import {NotBot} from "../../guards/NotABot";
import {Message} from "discord.js";

export class MessageEventDispatcher {

    private static readonly _messageListenerMap: Map<any, MessageEntry[]> = new Map();

    public static get messageListenerMap(): Map<any, MessageEntry[]> {
        return MessageEventDispatcher._messageListenerMap;
    }

    @On("message")
    private async eventTrigger([message]: ArgsOf<"message">, client: Client): Promise<void> {
        return this.trigger(message, client, false);
    }


    @On("messageUpdate")
    @Guard(NotBot)
    private async messageUpdater([oldMessage, newMessage]: ArgsOf<"messageUpdate">, client: Client): Promise<void> {
        if (!(newMessage instanceof Message)) {
            try {
                newMessage = await newMessage.fetch();
            } catch {
                return;
            }
        }
        return this.trigger(newMessage, client, true);
    }

    private async trigger(message: Message, client: Client, isEdit = false): Promise<void> {
        const retArr: Promise<void>[] = [];
        for (const [context, entries] of MessageEventDispatcher._messageListenerMap) {
            for (const entry of entries) {
                retArr.push(entry.trigger(message, client, context, isEdit));
            }
        }
        return Promise.all(retArr).then();
    }
}
