import base64
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def derive_key(device_uuid: str) -> bytes:
    """Derive encryption key from device UUID using HKDF."""
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b'relay-cli-fallback',
        info=device_uuid.encode(),
    )
    return hkdf.derive(device_uuid.encode())


def encrypt_token(token: str, device_uuid: str) -> str:
    """Encrypt token using AES-GCM with key derived from device_uuid."""
    key = derive_key(device_uuid)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, token.encode(), None)
    return base64.b64encode(nonce + ciphertext).decode()


def decrypt_token(encrypted: str, device_uuid: str) -> str:
    """Decrypt token using AES-GCM with key derived from device_uuid."""
    key = derive_key(device_uuid)
    aesgcm = AESGCM(key)
    data = base64.b64decode(encrypted)
    nonce = data[:12]
    ciphertext = data[12:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode()