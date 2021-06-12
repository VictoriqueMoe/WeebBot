import {ModuleSettings} from "./settings/ModuleSettings";

export interface IModuleSettingsManager<T extends ModuleSettings> {

    /**
     * Get the settings object of this module, may be null
     * @param guildId
     */
    getSettings(guildId: string): Promise<T | null>;

    /**
     * Save the setting for this module, this will overwrite the current settings. if merge is passed only the keys in the settings object will be updated
     * @param guildId
     * @param setting
     * @param merge
     */
    saveSettings(guildId: string, setting: T | null, merge?: boolean): Promise<void>;
}