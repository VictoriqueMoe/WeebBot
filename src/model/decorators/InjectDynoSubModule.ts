import {IDynoAutoModFilter} from "../closeableModules/subModules/dynoAutoMod/IDynoAutoModFilter";
import {DIService} from "@typeit/discord";
import {ISubModule} from "../closeableModules/subModules/ISubModule";
import {ICloseableModule} from "../closeableModules/ICloseableModule";
import {CloseableModule} from "../closeableModules/impl/CloseableModule";
import {AutoModSettings} from "../closeableModules/settings/automod/AutoModSettings";

export function InjectDynoSubModule<T extends CloseableModule<AutoModSettings>>(parentModule: new() => T) {
    // @ts-ignore
    return (constructor: typeof ISubModule) => {
        const parentFilter: ICloseableModule<never> = DIService.instance.getService(parentModule);
        if (parentFilter == null) {
            throw new Error(`Unable to find any module for ${parentModule}`);
        }
        const instance: IDynoAutoModFilter = new constructor(parentFilter);
        console.log(`Register submodule: "${instance.id}" with parent: "${parentFilter.moduleId}"`);
    };
}