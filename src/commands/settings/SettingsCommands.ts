import {Command, CommandMessage, DIService, Guard} from "@typeit/discord";
import {NotBot} from "../../guards/NotABot";
import {ObjectUtil, StringUtils} from "../../utils/Utils";
import {SettingsManager} from "../../model/settings/SettingsManager";
import {DEFAULT_SETTINGS, SETTINGS} from "../../enums/SETTINGS";
import {AbstractCommand} from "../AbstractCommand";
import {secureCommand} from "../../guards/RoleConstraint";
import {ICloseableModule} from "../../model/closeableModules/ICloseableModule";
import {AutoRoleSettings} from "../../model/closeableModules/settings/AutoRoleSettings";
import {AutoRole} from "../../events/closeableModules/autoRole/AutoRole";


export class SettingsCommands extends AbstractCommand<any> {

    constructor() {
        super({
            module: {
                name: "Settings",
                description: "Commands to change internal seetings of this bot"
            },
            commands: [
                {
                    name: "prefix",
                    description: {
                        text: "Change the global prefix for this bot",
                        examples: ["prefix '_' = change prefix to _"],
                        args: [
                            {
                                name: "prefix",
                                type: "text",
                                optional: true,
                                description: "Please ensure the prefix does NOT contain spaces"
                            }
                        ]
                    }
                },
                {
                    name: "AutoRoleMinAccountAge",
                    description: {
                        text: "Set the minimum age of the account joining needs to be before they awre allowed to see the rest of the server\nIf an account joins before this age, then they are placed in jail until the account is old enough\nThis requires 'JailRole' to be set\n set to -1 to disable",
                        args: [{
                            name: "value",
                            description: "number in days of limit",
                            optional: false,
                            type: "number"
                        }]
                    }
                },
                {
                    name: "AutoAutoJail",
                    description: {
                        text: "If set to true then users will automatically be re-jailed if they leave the server while in jail and return",
                        args: [{
                            name: "enabled",
                            description: "true or false",
                            optional: false,
                            type: "boolean"
                        }]
                    }
                },
                {
                    name: "AutoRoleAutoMute",
                    description: {
                        text: "If set to true, then members will automatically be muted if they leave as mute and rejoin as long as the mute is still active",
                        args: [{
                            name: "enabled",
                            description: "true or false",
                            optional: false,
                            type: "boolean"
                        }]
                    }
                }
            ]
        });
    }

    @Command("AutoRoleAutoMute")
    @Guard(NotBot, secureCommand)
    private async AutoRoleAutoMute(command: CommandMessage): Promise<void> {
        const argumentArray = StringUtils.splitCommandLine(command.content);
        if (argumentArray.length !== 1) {
            command.reply("Please supply true or false");
            return;
        }
        const autoMute = argumentArray[0] === "true";
        const autoRole: ICloseableModule<AutoRoleSettings> = DIService.instance.getService(AutoRole);
        const setting = {
            autoMute
        };
        try {
            await autoRole.saveSettings(command.guild.id, setting, true);
        } catch (e) {
            command.reply(e.message);
            return;
        }
        command.reply("Setting saved");
    }

    @Command("AutoAutoJail")
    @Guard(NotBot, secureCommand)
    private async AutoAutoJail(command: CommandMessage): Promise<void> {
        const argumentArray = StringUtils.splitCommandLine(command.content);
        if (argumentArray.length !== 1) {
            command.reply("Please supply true or false");
            return;
        }
        const autoJail = argumentArray[0] === "true";
        const autoRole: ICloseableModule<AutoRoleSettings> = DIService.instance.getService(AutoRole);
        const setting = {
            autoJail
        };
        try {
            await autoRole.saveSettings(command.guild.id, setting, true);
        } catch (e) {
            command.reply(e.message);
            return;
        }
        command.reply("Setting saved");
    }

    @Command("AutoRoleMinAccountAge")
    @Guard(NotBot, secureCommand)
    private async AutoRoleMinAccountAge(command: CommandMessage): Promise<void> {
        const argumentArray = StringUtils.splitCommandLine(command.content);
        if (argumentArray.length !== 1) {
            command.reply("Please supply a number");
            return;
        }
        const minAccountAge = parseInt(argumentArray[0]);
        if (isNaN(minAccountAge)) {
            command.reply("Please supply a number");
            return;
        }
        const autoRole: ICloseableModule<AutoRoleSettings> = DIService.instance.getService(AutoRole);
        const setting = {
            minAccountAge
        };
        try {
            await autoRole.saveSettings(command.guild.id, setting, true);
        } catch (e) {
            command.reply(e.message);
            return;
        }
        command.reply("Setting saved");
    }

    @Command("prefix")
    @Guard(NotBot, secureCommand)
    private async setPrefix(command: CommandMessage): Promise<void> {
        const argumentArray = StringUtils.splitCommandLine(command.content);
        if (argumentArray.length !== 1 && argumentArray.length !== 0) {
            command.reply("Please supply one or zero argument(s) only");
            return;
        }
        const [prefix] = argumentArray;
        if (ObjectUtil.isNumeric(prefix)) {
            command.reply("Prefix can not be a number");
            return;
        }
        if (!ObjectUtil.validString(prefix)) {
            await SettingsManager.instance.saveOrUpdateSetting(SETTINGS.PREFIX, DEFAULT_SETTINGS.PREFIX, command.guild.id);
            command.reply(`Prefix has been reset to "${DEFAULT_SETTINGS.PREFIX}"`);
        } else {
            await SettingsManager.instance.saveOrUpdateSetting(SETTINGS.PREFIX, prefix, command.guild.id);
            command.reply(`Prefix has been changed to "${prefix}"`);
        }
    }
}