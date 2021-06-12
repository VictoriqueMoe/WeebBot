import {ISubModule} from "../ISubModule";
import {ModuleSettings} from "../../settings/ModuleSettings";
import {ICloseableModule} from "../../ICloseableModule";
import {ModuleSettingsManager} from "../../manager/ModuleSettingsManager";
import {CloseOptionModel} from "../../../DB/autoMod/impl/CloseOption.model";

export abstract class SubModule<T extends ModuleSettings> extends ModuleSettingsManager<T> implements ISubModule<T> {

    protected constructor(_model: typeof CloseOptionModel, private objectKey: string, _moduleId: string) {
        super(_model, _moduleId);
    }

    public async saveSettings(guildId: string, setting: T, merge = false): Promise<void> {
        let obj = {
            [this.objectKey]: {...setting}
        };
        if (merge) {
            const percistedSettings = await this.getSettings(guildId);
            obj = {...percistedSettings, ...obj};
        }
        return super.saveSettings(guildId, obj, false);
    }

    abstract readonly id: string;
    abstract readonly isActive: boolean;
    abstract readonly parentModule: ICloseableModule<T>;
}