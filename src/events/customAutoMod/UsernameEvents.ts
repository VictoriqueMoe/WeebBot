import {ArgsOf, Client, On} from "@typeit/discord";
import {UsernameModel} from "../../model/DB/autoMod/impl/Username.model";
import {DiscordUtils} from "../../utils/Utils";
import {Roles} from "../../enums/Roles";

export abstract class UsernameEvents {

    @On("guildMemberUpdate")
    public async onMemberUpdate([oldUser, newUser]: ArgsOf<"guildMemberUpdate">, client: Client): Promise<void> {
        const isNickChange = oldUser.nickname !== newUser.nickname;
        if (isNickChange) {
            const userId = newUser.id;
            const guildId = newUser.guild.id;
            const modelObj = await UsernameModel.findOne({
                where: {
                    userId,
                    guildId
                }
            });
            if (modelObj) {
                const roleLog = await DiscordUtils.getAuditLogEntry("MEMBER_UPDATE", newUser.guild);
                const executor = roleLog.executor;
                if (executor.id === "806288433323966514") {
                    return;
                }
                const guild = await client.guilds.fetch(guildId);
                const member = await guild.members.fetch(executor.id);
                const isMemberStaff = Roles.isMemberStaff(member);
                if (isMemberStaff || (executor.id === newUser.id && modelObj.force === false)) {
                    const newNick = newUser.nickname;
                    if (newNick === null) {
                        await UsernameModel.destroy({
                            where: {
                                userId,
                                guildId
                            }
                        });
                    } else {
                        await UsernameModel.update(
                            {
                                "usernameToPersist": newNick
                            },
                            {
                                where: {
                                    userId,
                                    guildId
                                }
                            }
                        );
                    }
                    if (newNick === null) {
                        DiscordUtils.postToLog(`User "${newUser.user.tag}" has had their username remove from persistence`, guildId);
                    } else {
                        DiscordUtils.postToLog(`User "${newUser.user.tag}" has a persisted nickname of "${modelObj.usernameToPersist}", howerver, this has been updated to "${(newNick)}"`, guildId);
                    }
                    return;
                }
                newUser.setNickname(modelObj.usernameToPersist);
            }
        }
    }

    @On("guildMemberAdd")
    private async memberJoins([member]: ArgsOf<"guildMemberAdd">, client: Client): Promise<void> {
        const userId = member.id;
        const modelObj = await UsernameModel.findOne({
            where: {
                userId,
                guildId: member.guild.id
            }
        });
        if (modelObj) {
            member.setNickname(modelObj.usernameToPersist);
        }
    }
}