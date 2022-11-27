// Client-Server API.

export interface RestApiConnection {
    getJson(path: string, parameters: Map<string, string>): Map<String, any>
}

export class HostApi {
    private connection: RestApiConnection

    constructor(
        connection: RestApiConnection,
    ) {
        this.connection = connection
    }

    async createAccount(
    ) {
        throw new Error("not implemented: " + this.connection)
    }
}
