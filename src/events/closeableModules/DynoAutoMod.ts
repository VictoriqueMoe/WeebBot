import {CloseableModule} from "../../model/closeableModules/impl/CloseableModule";
import {CloseOptionModel} from "../../model/DB/autoMod/impl/CloseOption.model";
import {ArgsOf, Client, Guard, On} from "@typeit/discord";
import {NotBot} from "../../guards/NotABot";
import {TimedSet} from "../../model/Impl/TimedSet";
import {AbstractFilter} from "../../model/closeableModules/subModules/dynoAutoMod/AbstractFilter";
import {ACTION} from "../../enums/ACTION";
import {IDynoAutoModFilter} from "../../model/closeableModules/subModules/dynoAutoMod/IDynoAutoModFilter";
import {GuildMember} from "discord.js";
import {MuteModel} from "../../model/DB/autoMod/impl/Mute.model";
import {MuteSingleton} from "../../commands/customAutoMod/userBlock/MuteSingleton";
import {Main} from "../../Main";
import {DiscordUtils, GuildUtils, ObjectUtil} from "../../utils/Utils";
import * as Immutable from "immutable";
import {MessageEventEditTrigger} from "../../model/decorators/MessageEventEditTrigger";
import {AutoModSettings} from "../../model/closeableModules/settings/automod/AutoModSettings";

export class DynoAutoMod extends CloseableModule<AutoModSettings> {

    private _muteTimeoutArray: TimedSet<MuteViolation> = new TimedSet(AbstractFilter.muteViolationTimeout * 1000);

    private static _uid = ObjectUtil.guid();

    constructor() {
        super(CloseOptionModel, DynoAutoMod._uid);
    }

    @MessageEventEditTrigger
    @On("message")
    @Guard(NotBot)
    private async process([message]: ArgsOf<"message">, client: Client): Promise<void> {
        if (!await this.canRun(message.guild.id, message.member, message.channel)) {
            return;
        }
        const filters = this.submodules;
        const violatedFilters: IDynoAutoModFilter<any>[] = [];
        if (!message.member) {
            return;
        }
        const member = message.member;
        const userId = member.id;
        if (Main.testMode && userId !== "697417252320051291") {
            return;
        }
        for (const filter of filters) {
            if (!filter.isActive) {
                continue;
            }
            const didPassFilter = filter.doFilter(message);
            if (!didPassFilter) {
                violatedFilters.push(filter);
            }
        }
        violatedFilters.sort((a, b) => a.priority - b.priority);
        const mutedRole = await GuildUtils.RoleUtils.getMuteRole(message.guild.id);
        outer:
            for (const filter of violatedFilters) {
                const actionsToTake = filter.actions;
                let didPreformTerminaloperation = false;
                for (const action of actionsToTake) {
                    switch (action) {
                        case ACTION.MUTE: {
                            if (!mutedRole) {
                                return;
                            }
                            let fromArray = this.getFromArray(userId, member.guild.id);
                            if (fromArray) {
                                fromArray.muteViolations++;
                                this._muteTimeoutArray.refresh(fromArray);
                            } else {
                                fromArray = new MuteViolation(userId, filter.id, member.guild.id);
                                this._muteTimeoutArray.add(fromArray);
                            }
                            if (fromArray.hasViolationLimitReached) {
                                try {
                                    await this.muteUser(fromArray, member, "Auto mod violation limit reached", Main.client.user.id, AbstractFilter.autoMuteTimeout);
                                    didPreformTerminaloperation = true;
                                } catch (e) {
                                    console.error(e);
                                    continue;
                                }
                            }
                            break;
                        }
                        case ACTION.WARN: {
                            const warnResponse = await message.reply(filter.warnMessage);
                            setTimeout(() => {
                                warnResponse.delete();
                            }, 5000);
                            break;
                        }
                        case ACTION.DELETE: {
                            if ('cooldownArray' in filter) {
                                // @ts-ignore
                                const entry = filter.getFromArray(message.member.id, message.guild.id);
                                const toDelete = entry.messageArray;
                                for (const messageToDelete of toDelete) {
                                    await messageToDelete.delete({
                                        // @ts-ignore
                                        reason: `Auto mod violation "${filter.id}"`
                                    });
                                }
                                entry.messageArray = [];
                            } else {
                                await message.delete({
                                    reason: `Auto mod violation "${filter.id}"`
                                });
                            }
                            break;
                        }
                    }
                    if (didPreformTerminaloperation) {
                        break outer;
                    }
                }
                const enabled = await this.isEnabled(member.guild.id);
                console.log(`message from server ${member.guild.name} (${member.guild.id}) violated filter ${filter.id}. Filter status is ${enabled}`);
                filter.postProcess(message);
            }
    }

    private async muteUser(violationObj: MuteViolation, user: GuildMember, reason: string, creatorID: string, seconds?: number): Promise<MuteModel> {
        const model = await MuteSingleton.instance.muteUser(user, reason, creatorID, seconds);
        this._muteTimeoutArray.delete(violationObj);
        await DiscordUtils.postToLog(`User: "${user.user.username}" has been muted for the reason: "${reason}" by module: "${violationObj.filterId}" for ${ObjectUtil.secondsToHuman(seconds)}`, user.guild.id);
        return model;
    }

    public get isDynoReplacement(): boolean {
        return true;
    }

    public get moduleId(): string {
        return "DynoAutoMod";
    }

    private getFromArray(userId: string, guildid: string): MuteViolation {
        const arr = this._muteTimeoutArray.rawSet;
        return arr.find(value => value.userId === userId && value._guildId === guildid);
    }

    public get submodules(): Immutable.Set<IDynoAutoModFilter<any>> {
        return super.submodules as Immutable.Set<IDynoAutoModFilter<any>>;
    }

}

class MuteViolation {
    public muteViolations: number;

    constructor(public userId, public filterId: string, public _guildId: string) {
        this.muteViolations = 1;
    }

    public get hasViolationLimitReached(): boolean {
        return this.muteViolations >= AbstractFilter.autoMuteViolationCount;
    }
}