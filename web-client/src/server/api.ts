// Client-Server API.
import { JsonLookup, JSONValueType } from '../lib/typed-json'

export interface RestApiConnection {
    getJson(path: string, parameters: JSONValueType): Promise<JsonLookup>
}

export class HostApi {
    private connection: RestApiConnection

    constructor(
        connection: RestApiConnection,
    ) {
        this.connection = connection
    }

    async createAccount(  // eslint-disable-line @typescript-eslint/require-await

    ) {
        return await this.connection.getJson('/some/api/path', {})
    }
}
