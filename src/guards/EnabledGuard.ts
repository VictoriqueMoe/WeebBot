import {CloseOptionModel} from "../model/DB/autoMod/impl/CloseOption.model";

export const EnabledGuard = (moduleId:string) => async (undefined, client, next) => {
    const module = await CloseOptionModel.findOne({
        where: {
            moduleId
        }
    });
    if(module.status){
        return await next();
    }
};