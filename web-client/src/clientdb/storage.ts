// Loads the client db structures.

// TODO have this work instead with the redux store.

import { User, Server, ClientStore } from './structs'
import { parseJsonLookup } from '../lib/typed-json'

// Generic JSON typing.  Should probably be moved to a standard place.


// loadClientStore Load the existing client store information
export function loadClientStore(
    serverName: string | null,
    serverPublicKey: string | null,
): ClientStore {
    const user = loadUserStore()
    const server = loadServerStore(serverName, serverPublicKey)
    return { user, server }
}

// createUser Store a new user and return the new client store information.
export function createUser(
    originalClient: ClientStore,
    newUser: User,
): ClientStore {
    storeUserStore(newUser)
    return { user: newUser, server: originalClient.server }
}


// FIXME PLACEHOLDER
function createDefaultUserData(): User {
    console.error('FIXME USING PLACEHOLDER USER DATA.')
    return {
        humanName: 'User',
        privateKey: 'really private',
        publicKey: 'really public',
        locale: 'en-us',
        localTz: 'UTC',
        exists: false,
    }
}


function loadUserStore(): User {
    // Must be stored local storage.
    // Strange that it's not a promise.  Oh well.
    const localData = window.localStorage.getItem('user-settings')
    const jsonData = parseJsonLookup(localData || '')
    if (typeof jsonData === 'string') {
        return createDefaultUserData()
    }
    return {
        humanName: jsonData.asStrOr('-not set-', 'humanName'),
        privateKey: jsonData.asStrOr('-not set-', 'privateKey'),
        publicKey: jsonData.asStrOr('-not set-', 'publicKey'),
        locale: jsonData.asStrOr('-not set-', 'locale'),
        localTz: jsonData.asStrOr('-not set-', 'localTz'),
        exists: true,
    }
}


function storeUserStore(user: User) {
    window.localStorage.setItem('user-settings', JSON.stringify({
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
        return { serverName, publicKey: serverPublicKey }
    }
    const cookieData = getCookie('server-description')
    const jsonData = parseJsonLookup(cookieData || '')
    if (typeof jsonData === 'string') {
        // Should be an error.  Or, we're running in single player / disconnected mode.
        return { serverName: 'unknown', publicKey: 'unknown' }
    }
    return {
        serverName: jsonData.asStrOr('-not set-', 'serverName'),
        publicKey: jsonData.asStrOr('-not set-', 'serverPublicKey'),
    }
}


// General utils for managing cookies in Typescript.
//   From https://gist.github.com/joduplessis/7b3b4340353760e945f972a69e855d11
/*
export function setCookie(name: string, val: string) {
    const date = new Date();
    const value = val;

    // Set it expire in 7 days
    date.setTime(date.getTime() + (7 * 24 * 60 * 60 * 1000));

    // Set it
    document.cookie = name+"="+value+"; expires="+date.toUTCString()+"; path=/";
}

function deleteCookie(name: string) {
    const date = new Date();

    // Set it expire in -1 days
    date.setTime(date.getTime() + (-1 * 24 * 60 * 60 * 1000));

    // Set it
    document.cookie = name+"=; expires="+date.toUTCString()+"; path=/";
}

*/

function getCookie(name: string): string {
    const value = '; ' + document.cookie
    const parts = value.split('; ' + name + '=')
    return parts.pop()?.split(';').shift() || ''
}
