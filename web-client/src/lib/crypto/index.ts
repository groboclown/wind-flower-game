
// Cryptography helpers.
import { KEYUTIL, KJUR, RSAKey } from 'jsrsasign'


export type EncryptionKey = RSAKey | KJUR.crypto.DSA | KJUR.crypto.ECDSA


export function generateEncryptionKeyFrom(keyText: string, passKey?: string): Promise<EncryptionKey> {
  return Promise.resolve(KEYUTIL.getKey(keyText, passKey))
}


export function createSignature(
    privateKey: EncryptionKey, hashAlgorithm: string, message: string
): Promise<string> {
  const sig = new KJUR.crypto.Signature({alg: hashAlgorithm})
  sig.init(privateKey)
  sig.updateString(message)
  return Promise.resolve(sig.sign())
}


export function verifySignature(
    publicKey: EncryptionKey, hashAlgorithm: string, message: string, signature: string
): Promise<boolean> {
  const sig = new KJUR.crypto.Signature({alg: hashAlgorithm})
  sig.init(publicKey)
  sig.updateString(message)
  return Promise.resolve(sig.verify(signature))
}


// generateKeyPair create the public and private key pair for the client's signature generation.
export function generateKeyPair(
  privatePassKey: string,
): Promise<{ publicPEM: string, privatePEM: string }> {
  const keyPair = KEYUTIL.generateKeypair('EC', 'secp256r1')
  const publicKey = keyPair.pubKeyObj as KJUR.crypto.ECDSA
  const privateKey = keyPair.prvKeyObj as KJUR.crypto.ECDSA
  return Promise.resolve({
    publicPEM: KEYUTIL.getPEM(publicKey),
    privatePEM: KEYUTIL.getPEM(privateKey, 'PKCS5PRV', privatePassKey),
  })
}


export function generateSha512(text: string): Promise<string> {
  const digest = new KJUR.crypto.MessageDigest({'alg': 'sha512'})
  digest.updateString(text)
  return Promise.resolve(digest.digest())
}
