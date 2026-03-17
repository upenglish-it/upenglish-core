import * as NodeRSA from 'node-rsa';

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
                    MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAMab+qnjMyvfIq4UKKu6mjo0PQSi5tpa
                    BrDrBNB5phvZne4JjXUA/mUCjw+CuEUM3sqNzLCBVwk4VsdJsgxVMhcCAwEAAQ==
                    -----END PUBLIC KEY-----`;

const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
                    MIIBOgIBAAJBAMab+qnjMyvfIq4UKKu6mjo0PQSi5tpaBrDrBNB5phvZne4JjXUA
                    /mUCjw+CuEUM3sqNzLCBVwk4VsdJsgxVMhcCAwEAAQJAU9RWcwqw+J2QN8XOfN2g
                    Z1zRPHm90wAYvugT+iK+mBX8/rhz26khIg//05xXBLqF415qYCHZ4NzSIdV2uwSt
                    UQIhAPsFlZLxcT0zsWhqdXRU8ZEHkGmoBabNboHqcjDmwKMtAiEAyoxNFeNM2vJD
                    rWUZ5rwGsobG178qlMvgKa8cBSZKBNMCIBQFRv+4SArUk6K7UvDbUYT6sHbs0r6S
                    Be1QsJjb3qNlAiBdLaAEsrVXf93cdcctm1AlbtUoyTvIieXMp07nm46vmwIhAK9f
                    cLOxqhvTrkhQiF8M6eO5B6FjQniEKLvsrD+nlz1F
                    -----END RSA PRIVATE KEY-----`;

export const NodeRSAEncryptService = (data: object | string) => {
  try {
    const key = new NodeRSA();
    key.importKey(PUBLIC_KEY, 'pkcs8-public-pem');
    const dataType = typeof data === 'string' ? data : JSON.stringify(data);
    const encrypted = key.encrypt(dataType, 'base64');
    return encrypted;
  } catch (error) {
    return null;
  }
};

export const NodeRSADecryptService = (data: string) => {
  try {
    const key = new NodeRSA();
    key.importKey(PRIVATE_KEY, 'pkcs1-pem');
    const decryptedString = key.decrypt(data, 'utf8');
    const decrypedObject = JSON.parse(decryptedString);
    return decrypedObject;
  } catch (error) {
    return null;
  }
};
