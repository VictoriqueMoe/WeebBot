import {Client} from "@typeit/discord";
import {CloseableModule} from "./model/CloseableModule";
import {Sequelize} from "sequelize-typescript";

const {token} = require('../config.json');

export class CloseableModuleSet extends Set<CloseableModule> {
    add(value: CloseableModule): this {
        for (let v of this.values()) {
            if (v.moduleId === value.moduleId) {
                super.delete(v);
                break;
            }
        }
        super.add(value);
        return this;
    }

    has(value: CloseableModule): boolean {
        for (let v of this.values()) {
            if (v.moduleId === value.moduleId) {
                return true;
            }
        }
        return false;
    }

}

export class Main {
    public static closeableModules: CloseableModuleSet = new CloseableModuleSet();

    private static _client: Client;

    public static testMode = true;

    private static _dao: Sequelize;

    public static get dao(): Sequelize {
        return Main._dao;
    }

    static get client(): Client {
        return this._client;
    }

    public static start(): void {
        this._client = new Client();

        Main._dao = new Sequelize('database', 'username', 'password', {
            host: 'localhost',
            dialect: 'sqlite',
            logging: false,
            storage: 'database.sqlite',
            models: [__dirname + '/model/DB/**/*.model.ts'],
            modelMatch: (filename, member) => {
                return `${filename.substring(0, filename.indexOf('.model'))}Model`.toLowerCase() === member.toLowerCase();
            }
        });

        this._client.login(
            token,
            `${__dirname}/discord/*.ts`,
            `${__dirname}/discord/*.js`,
        );
    }
}

Main.start();