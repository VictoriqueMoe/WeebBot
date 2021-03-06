import {Typeings} from "../model/types/Typeings";
import {BaseDAO} from "../DAO/BaseDAO";
import {Model} from "sequelize-typescript";
import {GuildMember} from "discord.js";
import {CommandSecurityManager} from "../model/guild/manager/CommandSecurityManager";
import CommandArgs = Typeings.CommandArgs;
import Command = Typeings.Command;

export abstract class AbstractCommandModule<T extends Model> extends BaseDAO<T> {
    protected constructor(private _commands: CommandArgs) {
        super();
    }

    public get commandDescriptors(): CommandArgs {
        return this._commands;
    }

    public async getCommand(name: string, member: GuildMember): Promise<Command> {
        for (const command of this._commands.commands) {
            if (command.name === name) {
                if (await CommandSecurityManager.instance.canRunCommand(member, name)) {
                    return command;
                }
                return null;
            }
        }
        return null;
    }

}