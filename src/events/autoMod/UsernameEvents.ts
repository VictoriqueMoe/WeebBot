import {ArgsOf, Client, On} from "@typeit/discord";
import {UsernameModel} from "../../model/DB/autoMod/Username.model";
import {DiscordUtils, GuildUtils} from "../../utils/Utils";
import {Roles} from "../../enums/Roles";

export abstract class UsernameEvents {

    @On("guildMemberAdd")
    private async memberJoins([member]: ArgsOf<"guildMemberAdd">, client: Client): Promise<void> {
        let userId = member.id;
        let modelObj = await UsernameModel.findOne({
            where: {
                userId
            }
        });
        if (modelObj) {
            member.setNickname(modelObj.usernameToPersist);
        }
    }

    @On("guildMemberUpdate")
    public async onMemberUpdate([oldUser, newUser]: ArgsOf<"guildMemberUpdate">, client: Client): Promise<void> {
        let isNickChange = oldUser.nickname !== newUser.nickname;
        if (isNickChange) {
            let userId = newUser.id;
            let modelObj = await UsernameModel.findOne({
                where: {
                    userId
                }
            });
            if (modelObj) {
                let fetchedLogs = await newUser.guild.fetchAuditLogs({
                    limit: 1,
                    type: 'MEMBER_UPDATE'
                });
                let roleLog = fetchedLogs.entries.first();
                let executor = roleLog.executor;
                if (executor.id === "806288433323966514") {
                    return;
                }
                let guild = await client.guilds.fetch(GuildUtils.getGuildID());
                let member = await guild.members.fetch(executor.id);
                let isMemberStaff = Roles.isMemberStaff(member);
                if (isMemberStaff || (executor.id === newUser.id && modelObj.force === false)) {
                    let newNick = newUser.nickname;
                    if(newNick  === null){
                        await UsernameModel.destroy({
                            where:{
                                userId
                            }
                        });
                    }else{
                        await UsernameModel.update(
                            {
                                "usernameToPersist": newUser.nickname
                            },
                            {
                                where: {
                                    userId
                                }
                            }
                        );
                    }
                    if(newUser.nickname == null){
                        DiscordUtils.postToLog(`User "${newUser.user.username}" has been reset and all resistance removed`);
                    }else{
                        DiscordUtils.postToLog(`User "${newUser.user.username}" has a persisted nickname of "${modelObj.usernameToPersist}", howerver, this has been updated to "${newUser.nickname === null ? newUser.user.username : newUser.nickname}"`);
                    }
                    return;
                }
                newUser.setNickname(modelObj.usernameToPersist);
            }
        }
    }
}