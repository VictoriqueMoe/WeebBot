import {ICloseOption} from "../../DB/autoMod/ICloseOption";
import {Main} from "../../../Main";
import {ICloseableModule} from "../ICloseableModule";
import {ISubModule} from "../subModules/ISubModule";
import * as Immutable from "immutable";
import {SubModuleManager} from "../manager/SubModuleManager";
import {ModuleSettings} from "../settings/ModuleSettings";
import {GuildUtils, ObjectUtil} from "../../../utils/Utils";
import {Channel, GuildMember, TextChannel} from "discord.js";
import {Roles} from "../../../enums/Roles";
import {CloseOptionModel} from "../../DB/autoMod/impl/CloseOption.model";
import {ModuleSettingsManager} from "../manager/ModuleSettingsManager";
import RolesEnum = Roles.RolesEnum;

export abstract class CloseableModule<T extends ModuleSettings> extends ModuleSettingsManager<T> implements ICloseableModule<T> {

    private _isEnabled: Map<string, boolean | null>;

    protected constructor(_model: typeof CloseOptionModel, private _uid: string, _moduleId: string) {
        super(_model, _moduleId);
        Main.closeableModules.add(this);

        this._isEnabled = new Map();
    }

    public get moduleId(): string {
        return this._moduleId;
    }

    public abstract get isDynoReplacement(): boolean;

    public get submodules(): Immutable.Set<ISubModule<T>> {
        return SubModuleManager.instance.getSubModulesFromParent(this);
    }

    public get uid(): string {
        return this._uid;
    }

    /**
     * Close this module, this prevents all events from being fired. events are NOT queued
     */
    public async close(guildId: string): Promise<boolean> {
        const m = await this._model.update(
            {
                "status": false
            },
            {
                where: {
                    "moduleId": this.moduleId,
                    guildId
                }
            }
        );
        this._isEnabled.set(guildId, m[0] === 1);
        console.log(`Module: ${this.moduleId} disabled`);
        return m[0] === 1;
    }

    /**
     * Opens this module, allowing events to be fired.
     */
    public async open(guildId: string): Promise<boolean> {
        const m = await this._model.update(
            {
                "status": true
            },
            {
                where: {
                    "moduleId": this.moduleId,
                    guildId
                }
            }
        );
        this._isEnabled.set(guildId, m[0] === 1);
        console.log(`Module: ${this.moduleId} enabled`);
        return m[0] === 1;
    }

    public async isEnabled(guildId: string): Promise<boolean> {
        if (!this._isEnabled.has(guildId)) {
            const model: ICloseOption = await this._model.findOne({
                attributes: ["status"],
                where: {
                    "moduleId": this.moduleId,
                    guildId
                }
            });
            this._isEnabled.set(guildId, model.status);
        }
        return this._isEnabled.get(guildId);
    }

    /**
     * Will check if:
     * Current user is able to trigger this module
     * is this module enabled
     * @param guildId
     * @param member
     * @param channel
     * @protected
     */
    protected async canRun(guildId: string, member: GuildMember | null, channel: Channel | null): Promise<boolean> {
        if (!ObjectUtil.validString(guildId)) {
            throw new Error("Unable to find guild");
        }
        const enabled = await this.isEnabled(guildId);
        if (!enabled) {
            return false;
        }

        if (member) {
            //TODO remove when i figure out how to get all closeable modules to implement ITriggerConstraint
            if (GuildUtils.isMemberAdmin(member)) {
                return false;
            }
            const memberRoles = member.roles.cache;
            const hardCodedImmunes = [RolesEnum.OVERWATCH_ELITE, RolesEnum.CIVIL_PROTECTION, RolesEnum.ZOMBIES];
            for (const immuneRoles of hardCodedImmunes) {
                if (memberRoles.has(immuneRoles)) {
                    return false;
                }
            }
        }
        if (channel) {
            if (!(channel instanceof TextChannel)) {
                return false;
            }
        }
        const module = await CloseOptionModel.findOne({
            where: {
                moduleId: this.moduleId,
                guildId,
                status: true
            }
        });
        return module && module.status;
    }
}