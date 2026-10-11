const ONES = [
  '',
  'ONE',
  'TWO',
  'THREE',
  'FOUR',
  'FIVE',
  'SIX',
  'SEVEN',
  'EIGHT',
  'NINE',
  'TEN',
  'ELEVEN',
  'TWELVE',
  'THIRTEEN',
  'FOURTEEN',
  'FIFTEEN',
  'SIXTEEN',
  'SEVENTEEN',
  'EIGHTEEN',
  'NINETEEN',
];

const TENS = [
  '',
  '',
  'TWENTY',
  'THIRTY',
  'FORTY',
  'FIFTY',
  'SIXTY',
  'SEVENTY',
  'EIGHTY',
  'NINETY',
];

const SCALES = ['', 'THOUSAND', 'MILLION', 'BILLION'];

export function numberToWords(num: number): string {
  const integerPart = Math.floor(Math.abs(num));
  if (integerPart === 0) return 'ZERO';

  function convertChunk(n: number): string {
    const parts: string[] = [];
    if (n >= 100) {
      parts.push(`${ONES[Math.floor(n / 100)]} HUNDRED`);
      n %= 100;
    }
    if (n >= 20) {
      parts.push(TENS[Math.floor(n / 10)]);
      if (n % 10 > 0) parts.push(ONES[n % 10]);
    } else if (n > 0) {
      parts.push(ONES[n]);
    }
    return parts.join(' ');
  }

  const chunks: string[] = [];
  let chunkIdx = 0;
  let remaining = integerPart;

  while (remaining > 0 && chunkIdx < SCALES.length) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      const chunkStr = convertChunk(chunk);
      const scale = SCALES[chunkIdx];
      chunks.unshift(scale ? `${chunkStr} ${scale}` : chunkStr);
    }
    remaining = Math.floor(remaining / 1000);
    chunkIdx++;
  }

  return chunks.join(' ').trim();
}
