import {BelongsTo, Column, ForeignKey, Model, Table} from "sequelize-typescript";
import {IGuildAware} from "./IGuildAware";
import {GuildableModel} from "./guild/Guildable.model";

@Table
export class BannedAttachmentsModel extends Model implements IGuildAware {

    @Column({unique: false})
    public attachmentHash: string;

    @Column
    public url: string;

    @Column
    public reason: string;

    @Column({defaultValue: false})
    public isEmoji: boolean;

    @ForeignKey(() => GuildableModel)
    @Column
    guildId: string;

    @BelongsTo(() => GuildableModel, {onDelete: "cascade"})
    guildableModel: GuildableModel;
}