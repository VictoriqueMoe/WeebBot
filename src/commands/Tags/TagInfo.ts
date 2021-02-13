import {Command, CommandMessage, Guard} from "@typeit/discord";
import {roleConstraints} from "../../guards/RoleConstraint";
import {TagModel} from "../../model/DB/Tag.model";
import {Roles} from "../../enums/Roles";
import {StringUtils} from "../../utils/Utils";
import {BlockGuard} from "../../guards/BlockGuard";
import RolesEnum = Roles.RolesEnum;

export abstract class TagInfo {
    @Command("tagInfo")
    @Guard(roleConstraints(RolesEnum.CIVIL_PROTECTION, RolesEnum.OVERWATCH_ELITE), BlockGuard)
    private async tagInfo(command: CommandMessage): Promise<TagModel> {
        let argumentArray = StringUtils.splitCommandLine(command.content);
        if (argumentArray.length !== 1) {
            command.reply("Invalid arguments, please supply tag name");
            return;
        }
        let [_name] = argumentArray;
        let tag = await TagModel.findOne({where: {_name: _name}});
        if (tag) {
            command.channel.send(`${_name} was created by ${tag.username} at ${tag.createdAt} and has been used ${tag.usage_count} times.`);
            return;
        }
        command.reply(`Could not find tag: ${_name}`);
    }
}