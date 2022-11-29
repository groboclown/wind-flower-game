// Client-Server API.
import { JsonLookup } from '../lib/typed-json'

export interface RestApiConnection {
    getJson(path: string, parameters: Map<string, string>): Promise<Map<string, JsonLookup>>
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
