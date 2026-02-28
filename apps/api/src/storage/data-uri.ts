export function isDataUri(value: string): boolean {
  return /^data:[^;,]+;base64,/i.test(value);
}

export function estimateDataUriBytes(value: string): number | null {
  if (!isDataUri(value)) {
    return null;
  }

  const commaIndex = value.indexOf(',');
  if (commaIndex < 0) {
    return null;
  }

  const payload = value
    .slice(commaIndex + 1)
    .replace(/\s+/g, '');

  if (!payload) {
    return 0;
  }

  if (!/^[A-Za-z0-9+/=]+$/.test(payload)) {
    return null;
  }

  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  const bytes = Math.floor((payload.length * 3) / 4) - padding;

  return bytes >= 0 ? bytes : null;
}
