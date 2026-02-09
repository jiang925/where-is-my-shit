/**
 * Generate SHA-256 fingerprint for message deduplication
 */
export async function generateFingerprint(
  conversationId: string,
  role: string,
  content: string
): Promise<string> {
  // Normalize content: trim whitespace, collapse multiple spaces
  const normalized = content.trim().replace(/\s+/g, ' ');

  // Hash format: conversationId|role|content
  const text = `${conversationId}|${role}|${normalized}`;

  // Use Web Crypto API for SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
