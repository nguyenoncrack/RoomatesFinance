const TOKEN_RE = /^[0-9a-f]{16,128}$/;

/**
 * Pulls an invite token out of whatever the user pasted: a full invite link from any origin
 * ("https://…/join/<token>"), a bare path ("/join/<token>"), or just the code itself.
 * Tokens are lowercase hex, so case and surrounding whitespace or punctuation are forgiven.
 */
export function parseInviteToken(input: string): string | null {
  const raw = input.trim().replace(/^[<"'(]+|[>"').,]+$/g, "");
  if (!raw) return null;
  const match = /\/join\/([^/?#\s]+)/i.exec(raw);
  const candidate = (match ? match[1] : raw).toLowerCase();
  return TOKEN_RE.test(candidate) ? candidate : null;
}
