// internal/crypto/encrypt.go
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
)

// Encryptor interface for encrypting and decrypting data
type Encryptor interface {
	Encrypt(plaintext []byte) ([]byte, error)
	Decrypt(ciphertext []byte) ([]byte, error)
}

type encryptor struct {
	gcm cipher.AEAD
}

// NewEncryptorFromBase64Key expects a 16/24/32 byte key, base64-encoded.
func NewEncryptorFromBase64Key(k string) (Encryptor, error) {
	rawKey, err := base64.StdEncoding.DecodeString(k)
	if err != nil {
		return nil, fmt.Errorf("decode key: %w", err)
	}

	block, err := aes.NewCipher(rawKey)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new GCM: %w", err)
	}

	return &encryptor{gcm: gcm}, nil
}

// Encrypt returns encrypted bytes (nonce||ciphertext).
func (e *encryptor) Encrypt(plaintext []byte) ([]byte, error) {
	nonce := make([]byte, e.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("nonce: %w", err)
	}

	ct := e.gcm.Seal(nonce, nonce, plaintext, nil)
	return ct, nil
}

func (e *encryptor) Decrypt(ciphertext []byte) ([]byte, error) {
	if len(ciphertext) < e.gcm.NonceSize() {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce := ciphertext[:e.gcm.NonceSize()]
	ct := ciphertext[e.gcm.NonceSize():]
	pt, err := e.gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt: %w", err)
	}
	return pt, nil
}
