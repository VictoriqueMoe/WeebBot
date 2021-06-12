import {ModuleSettings} from "./ModuleSettings";

export interface AutoRoleSettings extends ModuleSettings {
    minAccountAge?: number,
    autoJail?: boolean,
    autoMute?: boolean
}