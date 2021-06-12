import {IModuleSettingsManager} from "../IModuleSettingsManager";
import {ICloseOption} from "../../DB/autoMod/ICloseOption";
import {ObjectUtil} from "../../../utils/Utils";
import {ModuleSettings} from "../settings/ModuleSettings";
import {CloseOptionModel} from "../../DB/autoMod/impl/CloseOption.model";

export abstract class ModuleSettingsManager<T extends ModuleSettings> implements IModuleSettingsManager<T> {
    private _settings: Map<string, T | null>;

    protected constructor(protected _model: typeof CloseOptionModel, protected _moduleId: string) {
        this._settings = new Map();
    }

    public async saveSettings(guildId: string, setting: T, merge = false): Promise<void> {
        let obj = setting;
        if (merge) {
            const percistedSettings = await this.getSettings(guildId);
            obj = {...percistedSettings, ...setting};
        }
        await this._model.update(
            {
                "settings": obj
            },
            {
                where: {
                    "moduleId": this._moduleId,
                    guildId
                }
            }
        );
        this._settings.set(guildId, obj);
    }

    public async getSettings(guildId: string): Promise<T | null> {
        if (this._settings.has(guildId)) {
            return this._settings.get(guildId);
        }
        const model: ICloseOption = await this._model.findOne({
            attributes: ["settings"],
            where: {
                "moduleId": this._moduleId,
                guildId
            }
        });
        if (!model || !ObjectUtil.isValidObject(model.settings)) {
            return null;
        }
        this._settings.set(guildId, model.settings as T);
        return this._settings.get(guildId);
    }

}