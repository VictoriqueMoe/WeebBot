import {ModuleSettings} from "../../ModuleSettings";

export interface BaseAutoModFilterSettings extends ModuleSettings {

    /**
     * Get the actions that are done when this filter is violated
     */
    actions: string[];

}