// Loads the client db structures.

import { User, Server, ClientStore } from './structs'

// Load the existing client store information
export async function loadClientStore(
    serverName: string | null,
    serverPublicKey: string | null,
): Promise<ClientStore> {
    let user = loadUserStore()
    let server = loadServerStore(serverName, serverPublicKey)
    return new ClientStoreImpl(user, server)
}

// Store a new user and return the new client store information.
export async function createUser(
    originalClient: ClientStore,
    newUser: User,
): Promise<ClientStore> {
    storeUserStore(newUser)
    return new ClientStoreImpl(newUser, originalClient.server)
}



class UserImpl implements User {
    humanName: string
    privateKey: string
    publicKey: string
    locale: string
    localTz: string
    exists: boolean

    constructor(args: {
        humanName: string,
        privateKey: string,
        publicKey: string,
        locale: string,
        localTz: string,
        exists: boolean,
    }) {
        this.humanName = args.humanName
        this.privateKey = args.privateKey
        this.publicKey = args.publicKey
        this.locale = args.locale
        this.localTz = args.localTz
        this.exists = args.exists
    }
}

class ServerImpl implements Server {
    serverName: string
    publicKey: string

    constructor(
        serverName: string,
        publicKey: string,
    ) {
        this.serverName = serverName
        this.publicKey = publicKey
    }
}


class ClientStoreImpl implements ClientStore {
    user: User
    server: Server

    constructor(
        user: User,
        server: Server,
    ) {
        this.user = user
        this.server = server
    }
}



// FIXME PLACEHOLDER
function createDefaultUserData(): object {
    console.error("FIXME USING PLACEHOLDER USER DATA.")
    return {
        humanName: "User",
        privateKey: "really private",
        publicKey: "really public",
        locale: "en-us",
        localTz: "UTC",
    }
}


function loadUserStore(): User {
    // Must be stored local storage.
    let localData = window.localStorage.getItem("user-settings")
    let rawData: any
    let exists: boolean
    try {
        rawData = JSON.parse(localData ? localData : "")
        exists = true
    } catch (err) {
        // Should be an error.
        rawData = createDefaultUserData()
        exists = false
    }
    return new UserImpl({
        humanName: rawData?.humanName,
        privateKey: rawData?.privateKey,
        publicKey: rawData?.publicKey,
        locale: rawData?.locale,
        localTz: rawData?.localTz,
        exists,
    })
}


function storeUserStore(user: User) {
    window.localStorage.setItem("user-settings", JSON.stringify({
        humanName: user.humanName,
        privateKey: user.privateKey,
        publicKey: user.publicKey,
        locale: user.locale,
        localTz: user.localTz,
    }))
}


function loadServerStore(
    serverName: string | null,
    serverPublicKey: string | null,
): Server {
    // Must be stored in a cookie or passed from the web page.
    if (serverName != null && serverPublicKey != null) {
        return new ServerImpl(serverName, serverPublicKey)
    }
    let cookieData = getCookie("server-description")
    let rawData: any
    try {
        rawData = JSON.parse(cookieData)
    } catch (err) {
        // Should be an error.
        rawData = createDefaultUserData()
    }
    return new ServerImpl(
        rawData?.serverName,
        rawData?.serverPublicKey,
    )
}


// General utils for managing cookies in Typescript.
//   From https://gist.github.com/joduplessis/7b3b4340353760e945f972a69e855d11
export function setCookie(name: string, val: string) {
    const date = new Date();
    const value = val;

    // Set it expire in 7 days
    date.setTime(date.getTime() + (7 * 24 * 60 * 60 * 1000));

    // Set it
    document.cookie = name+"="+value+"; expires="+date.toUTCString()+"; path=/";
}

export function getCookie(name: string): string {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    return parts.pop()?.split(";").shift() || ""
}

export function deleteCookie(name: string) {
    const date = new Date();

    // Set it expire in -1 days
    date.setTime(date.getTime() + (-1 * 24 * 60 * 60 * 1000));

    // Set it
    document.cookie = name+"=; expires="+date.toUTCString()+"; path=/";
}
