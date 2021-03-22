import {Command, CommandMessage, Guard} from "@typeit/discord";
import {BlockGuard} from "../guards/BlockGuard";
import {AbstractCommand} from "./AbstractCommand";

export abstract class Ping extends AbstractCommand<any> {

    constructor() {
        super({
            commands: [
                {
                    name: "ping",
                    description: {
                        text: "Get the websocket heartbeat of the bot"
                    }
                }
            ]
        });
    }

    @Command("ping")
    @Guard(BlockGuard)
    private ping(command: CommandMessage): void {
        command.reply(`Websocket heartbeat: ${command.client.ws.ping}ms.`);
    }
}