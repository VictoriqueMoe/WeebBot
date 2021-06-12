import {ICloseableModule} from "../ICloseableModule";
import {ModuleSettings} from "../settings/ModuleSettings";
import {IModuleSettingsManager} from "../IModuleSettingsManager";

/**
 * A sub module is something that belongs to the parent module
 */
export interface ISubModule<T extends ModuleSettings> extends IModuleSettingsManager<T> {

    /**
     * sub-module ID
     */
    readonly id: string;

    /**
     * Is this filter active
     */
    readonly isActive: boolean;


    /**
     * Get the parent module this belongs to
     */
    readonly parentModule: ICloseableModule<T>;
}