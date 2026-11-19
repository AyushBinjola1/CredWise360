export type SyntheticDocument = { name: string; mime: string; content_base64: string };

export async function readSynthetic(file: File): Promise<SyntheticDocument> {
  if (file.size === 0 || file.size > 256 * 1024) throw Error('Choose a nonempty file up to 256 KB.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'txt' && extension !== 'pdf') throw Error('Choose a .txt or .pdf synthetic document.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  if (!binary.includes('CREDWISE-SYNTHETIC')) throw Error('The document must include the CREDWISE-SYNTHETIC marker.');
  if (extension === 'pdf' && !binary.startsWith('%PDF-')) throw Error('This file does not have a PDF header.');
  if (extension === 'txt') {
    if (!binary.startsWith('CREDWISE-SYNTHETIC')) throw Error('Start the text file with CREDWISE-SYNTHETIC.');
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw Error('Save your text file as UTF-8.'); }
  }
  return { name: file.name, mime: extension === 'pdf' ? 'application/pdf' : 'text/plain', content_base64: btoa(binary) };
}

export function saveSynthetic(file: SyntheticDocument) {
  const bytes = Uint8Array.from(atob(file.content_base64), char => char.charCodeAt(0));
  const href = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
  const link = document.createElement('a');
  link.href = href; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}
