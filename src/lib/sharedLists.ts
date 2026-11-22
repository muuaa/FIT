/** Lists shared between accounts (online only; each person's other data stays private). */
import { supabase } from './supabase';
import { t } from './i18n';

export interface SharedList {
  id: string;
  name: string;
  owner: string;
  join_code: string;
  created_at: string;
}
export interface SharedItem {
  id: string;
  list_id: string;
  text: string;
  done: boolean;
  created_by: string;
  created_at: string;
}
export interface SharedMember {
  list_id: string;
  user_id: string;
  email: string;
}

function db() {
  if (!supabase) throw new Error(t('Sign in to use shared lists.'));
  return supabase;
}

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) {
    if (/shared_list|does not exist|Could not find/i.test(r.error.message))
      throw new Error(t('Shared lists are not set up yet (run the second setup SQL in Supabase).'));
    throw new Error(r.error.message);
  }
  return r.data as T;
}

export async function fetchLists(): Promise<{ lists: SharedList[]; members: SharedMember[]; items: SharedItem[] }> {
  const lists = check(await db().from('shared_lists').select('*').order('created_at')) as SharedList[];
  if (!lists.length) return { lists, members: [], items: [] };
  const ids = lists.map((l) => l.id);
  const [m, i] = await Promise.all([
    db().from('shared_list_members').select('list_id,user_id,email').in('list_id', ids),
    db().from('shared_list_items').select('*').in('list_id', ids).order('created_at'),
  ]);
  return { lists, members: check(m) as SharedMember[], items: check(i) as SharedItem[] };
}

export async function createList(name: string): Promise<SharedList> {
  return check(await db().from('shared_lists').insert({ name }).select().single()) as SharedList;
}
export async function renameList(id: string, name: string) {
  check(await db().from('shared_lists').update({ name }).eq('id', id));
}
export async function deleteList(id: string) {
  check(await db().from('shared_lists').delete().eq('id', id));
}
export async function joinList(code: string): Promise<string> {
  const { data, error } = await db().rpc('join_shared_list', { code });
  if (error) throw new Error(/No list with that code/.test(error.message) ? t('No list with that code. Check it and try again.') : error.message);
  return data as string;
}
export async function leaveList(listId: string, userId: string) {
  check(await db().from('shared_list_members').delete().eq('list_id', listId).eq('user_id', userId));
}
export async function addItem(listId: string, text: string): Promise<SharedItem> {
  return check(await db().from('shared_list_items').insert({ list_id: listId, text }).select().single()) as SharedItem;
}
export async function setItemDone(id: string, done: boolean) {
  check(await db().from('shared_list_items').update({ done }).eq('id', id));
}
export async function deleteItem(id: string) {
  check(await db().from('shared_list_items').delete().eq('id', id));
}
export async function clearDone(listId: string) {
  check(await db().from('shared_list_items').delete().eq('list_id', listId).eq('done', true));
}
