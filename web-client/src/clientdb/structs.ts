// Information Persisted for this Client.
// These are assumed to be stored in a cookie or on the web page that is
// sent to the client.  They originate outside this application, and are
// static for the life of the web client.

export interface User {
    humanName: string
    privateKey: string
    publicKey: string
    locale: string
    localTz: string
    exists: boolean
}

export interface Server {
    serverName: string
    publicKey: string
}

export interface ClientStore {
    user: User
    server: Server
}
