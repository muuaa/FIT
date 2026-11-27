/**
 * Private file storage for attachments (journal photos/files, handwriting, progress photos).
 * Files live in the `files` bucket under `<userId>/…`; the database only stores the path.
 * Viewing uses short-lived signed URLs, cached for the session.
 */
import { currentNamespace, uid } from './localDb';
import { t } from './i18n';
import { supabase } from './supabase';

export const filesAvailable = (): boolean => Boolean(supabase && currentNamespace());

const urlCache = new Map<string, { url: string; expires: number }>();

/** Downscale big photos before upload (phones produce 4–12 MB images). */
async function shrinkImage(file: Blob, max = 2000): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    return out && out.size < file.size ? out : file;
  } catch {
    return file;
  }
}

export async function uploadFile(file: Blob, name: string): Promise<{ path: string; size: number; mime: string }> {
  const user = currentNamespace();
  if (!supabase || !user) throw new Error(t('Sign in to attach files.'));
  if (!navigator.onLine) throw new Error(t("You're offline. Attachments need internet; try again when you're connected."));
  const body = await shrinkImage(file);
  if (body.size > 50 * 1024 * 1024) throw new Error(t('That file is over 50 MB. Try a shorter video.'));
  const ext = (body.type === 'image/jpeg' && file.type !== 'image/jpeg' ? 'jpg' : name.split('.').pop() || 'bin')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);
  const path = `${user}/${new Date().toISOString().slice(0, 7)}/${uid()}.${ext || 'bin'}`;
  const { error } = await supabase.storage.from('files').upload(path, body, { contentType: body.type || 'application/octet-stream' });
  if (error) {
    if (/bucket not found/i.test(error.message)) throw new Error(t('File storage is not set up yet (run the second setup SQL in Supabase).'));
    throw error;
  }
  return { path, size: body.size, mime: body.type || 'application/octet-stream' };
}

export async function fileUrl(path: string): Promise<string> {
  const hit = urlCache.get(path);
  if (hit && hit.expires > Date.now() + 60_000) return hit.url;
  if (!supabase) throw new Error(t('Not signed in'));
  const { data, error } = await supabase.storage.from('files').createSignedUrl(path, 3600);
  if (error || !data) throw error ?? new Error('Could not open file');
  urlCache.set(path, { url: data.signedUrl, expires: Date.now() + 3600_000 });
  return data.signedUrl;
}

export async function deleteFile(path: string): Promise<void> {
  urlCache.delete(path);
  if (!supabase) return;
  await supabase.storage.from('files').remove([path]);
}
