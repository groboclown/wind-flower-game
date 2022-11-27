// Loads the state data from the server.
import { GameProps, MutableState } from './state'
import { HostApi } from '../server'
import { User } from '../clientdb'

export class HostLoader {
    private host: HostApi
    private user: User
    constructor(
        connection: HostApi,
        user: User,
    ) {
        this.host = connection
        this.user = user
    }

    async getState(gameId: string): Promise<MutableState> {
        throw new Error("Not implemented: " + gameId + ", " + this.host + ", " + this.user)
    }

    async getProps(gameId: string): Promise<GameProps> {
        throw new Error("not implemented: " + gameId)
    }
}
