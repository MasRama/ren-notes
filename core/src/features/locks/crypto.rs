//! The key made from the password, and sealing bytes with it: Argon2id for
//! the key, XChaCha20-Poly1305 for the sealing.

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::rand_core::RngCore;
use chacha20poly1305::aead::{Aead, AeadCore, KeyInit, OsRng, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

use crate::shared::error::{Error, Result};

const NONCE_LEN: usize = 24;

/// The key that opens locked notes. It is wiped from memory when dropped.
pub struct Key(pub(super) [u8; 32]);

impl Drop for Key {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

impl std::fmt::Debug for Key {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Key(..)")
    }
}

/// How hard making the key is. Kept with the password, so it can grow later
/// without locking anyone out. Tests use the cheapest setting.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub(super) struct Cost {
    /// Memory in KiB.
    pub m: u32,
    /// Passes.
    pub t: u32,
    /// Lanes.
    pub p: u32,
}

pub(super) const COST: Cost = if cfg!(test) {
    Cost { m: 8, t: 1, p: 1 }
} else {
    // OWASP's Argon2id floor: 19 MiB, two passes.
    Cost {
        m: 19 * 1024,
        t: 2,
        p: 1,
    }
};

pub(super) fn derive(password: &str, salt: &[u8], cost: Cost) -> Result<Key> {
    let params = Params::new(cost.m, cost.t, cost.p, Some(32))
        .map_err(|e| Error::InvalidInput(e.to_string()))?;
    let mut key = Key([0; 32]);
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(password.as_bytes(), salt, &mut key.0)
        .map_err(|e| Error::InvalidInput(e.to_string()))?;
    Ok(key)
}

pub(super) fn random<const N: usize>() -> [u8; N] {
    let mut bytes = [0; N];
    OsRng.fill_bytes(&mut bytes);
    bytes
}

/// Seals `plain` for `bound_to` (a note id): the sealed bytes open only
/// with this key and only for that note.
pub(super) fn seal(key: &Key, bound_to: &str, plain: &[u8]) -> Result<Vec<u8>> {
    let cipher = XChaCha20Poly1305::new((&key.0).into());
    let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
    let sealed = cipher
        .encrypt(
            &nonce,
            Payload {
                msg: plain,
                aad: bound_to.as_bytes(),
            },
        )
        .map_err(|_| Error::InvalidInput("could not seal the note".into()))?;
    Ok([nonce.as_slice(), &sealed].concat())
}

/// Opens what `seal` made; any other key or note is `WrongPassword`.
pub(super) fn unseal(key: &Key, bound_to: &str, sealed: &[u8]) -> Result<Vec<u8>> {
    if sealed.len() < NONCE_LEN {
        return Err(Error::WrongPassword);
    }
    let (nonce, body) = sealed.split_at(NONCE_LEN);
    XChaCha20Poly1305::new((&key.0).into())
        .decrypt(
            XNonce::from_slice(nonce),
            Payload {
                msg: body,
                aad: bound_to.as_bytes(),
            },
        )
        .map_err(|_| Error::WrongPassword)
}

pub(super) fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub(super) fn from_hex(text: &str) -> Result<Vec<u8>> {
    let bad = || Error::InvalidInput("damaged password record".into());
    if !text.len().is_multiple_of(2) {
        return Err(bad());
    }
    (0..text.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(text.get(i..i + 2).ok_or_else(bad)?, 16).map_err(|_| bad()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sealed_bytes_open_only_with_the_same_key_and_note() {
        let key = derive("pw", b"saltsaltsaltsalt", COST).unwrap();
        let same = derive("pw", b"saltsaltsaltsalt", COST).unwrap();
        let other = derive("pw", b"another-salt-xyz", COST).unwrap();
        let sealed = seal(&key, "note-1", b"secret").unwrap();
        assert_ne!(
            seal(&key, "note-1", b"secret").unwrap(),
            sealed,
            "fresh nonce"
        );
        assert_eq!(unseal(&same, "note-1", &sealed).unwrap(), b"secret");
        assert!(matches!(
            unseal(&other, "note-1", &sealed),
            Err(Error::WrongPassword)
        ));
        assert!(matches!(
            unseal(&key, "note-2", &sealed),
            Err(Error::WrongPassword)
        ));
        assert!(matches!(
            unseal(&key, "note-1", b"short"),
            Err(Error::WrongPassword)
        ));
    }

    #[test]
    fn hex_round_trips() {
        assert_eq!(to_hex(&[0, 15, 255]), "000fff");
        assert_eq!(from_hex("000fff").unwrap(), [0, 15, 255]);
        assert!(from_hex("0g").is_err());
        assert!(from_hex("abc").is_err());
    }
}
