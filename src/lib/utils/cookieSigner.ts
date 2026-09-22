import { NextResponse } from 'next/server';

const SECRET_KEY =
  process.env.SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'suongmai_preschool_default_secret_key_2026_secure';

const encoder = new TextEncoder();

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const keyData = encoder.encode(secret);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign', 'verify']
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  let hexString = '';
  for (let i = 0; i < byteArray.length; i++) {
    const hex = byteArray[i].toString(16).padStart(2, '0');
    hexString += hex;
  }
  return hexString;
}

/**
 * Cryptographically signs a cookie value using HMAC SHA-256 via Web Crypto API.
 * Output format: `${value}.${hexSignature}`
 */
export async function signCookieValue(value: string, secret = SECRET_KEY): Promise<string> {
  if (!value) return '';
  try {
    const cryptoKey = await getCryptoKey(secret);
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
    const hexSignature = bufferToHex(signatureBuffer);
    return `${value}.${hexSignature}`;
  } catch (err) {
    console.error('[COOKIE_SIGNER_ERROR] Failed to sign cookie:', err);
    return value;
  }
}

/**
 * Verifies the HMAC SHA-256 signature of a signed cookie value.
 * Returns the original value if signature is valid, or null if tampered/invalid/missing.
 */
export async function verifyAndExtractCookieValue(
  signedValue: string | undefined | null,
  secret = SECRET_KEY
): Promise<string | null> {
  if (!signedValue || typeof signedValue !== 'string') return null;

  const decodedValue = decodeURIComponent(signedValue);
  const lastDotIndex = decodedValue.lastIndexOf('.');
  if (lastDotIndex === -1) return null;

  const rawValue = decodedValue.substring(0, lastDotIndex);
  const signatureHex = decodedValue.substring(lastDotIndex + 1);

  if (!rawValue || !signatureHex || signatureHex.length !== 64) {
    return null;
  }

  try {
    const expectedSigned = await signCookieValue(rawValue, secret);
    const expectedSig = expectedSigned.substring(expectedSigned.lastIndexOf('.') + 1);

    if (signatureHex.length !== expectedSig.length) return null;

    let result = 0;
    for (let i = 0; i < signatureHex.length; i++) {
      result |= signatureHex.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }

    if (result === 0) {
      return rawValue;
    }
  } catch (err) {
    console.error('[COOKIE_VERIFY_ERROR] Verification exception:', err);
  }

  return null;
}

/**
 * Helper to set a cryptographically signed cookie on a NextResponse object.
 */
export async function setSignedCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: {
    path?: string;
    maxAge?: number;
    sameSite?: 'lax' | 'strict' | 'none' | boolean;
    httpOnly?: boolean;
    secure?: boolean;
  } = { path: '/', maxAge: 86400, sameSite: 'lax' }
): Promise<void> {
  const signedValue = await signCookieValue(value);
  response.cookies.set(name, signedValue, options);
}

/**
 * Client-side safe helper to extract the raw value from a cookie string if signed.
 */
export function parseSignedCookieClient(cookieValue: string | undefined | null): string {
  if (!cookieValue) return '';
  const decoded = decodeURIComponent(cookieValue);
  const lastDot = decoded.lastIndexOf('.');
  if (lastDot !== -1) {
    const potentialSig = decoded.substring(lastDot + 1);
    if (potentialSig.length === 64 && /^[0-9a-fA-F]{64}$/.test(potentialSig)) {
      return decoded.substring(0, lastDot);
    }
  }
  return decoded;
}
