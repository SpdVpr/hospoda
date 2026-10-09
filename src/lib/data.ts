import { getSupabase } from './supabase';
import type {
    Announcement,
    GalleryPhoto,
    Shift,
    ShiftStatus,
    Task,
    TaskPriority,
    TaskStatus,
    UserProfile,
    UserRole,
} from '@/types';

/*
 * Data access for the staff app (Supabase tables team_*, formerly Firestore
 * collections users / shifts / tasks / announcements / gallery). Rows are mapped to
 * the app's camelCase types; `uid` of a profile is the team member id.
 * Every function throws on error, like the Firestore SDK did.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Supabase rows, mapped field by field below
type Row = Record<string, any>;

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
    if (res.error) throw new Error(res.error.message);
    return res.data as NonNullable<T>;
}

const date = (v: string | null | undefined) => (v ? new Date(v) : undefined);
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');
const orNull = (v: string | null | undefined) => (v ? v : null);

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const toProfile = (r: Row): UserProfile => ({
    uid: r.id,
    userId: r.user_id ?? undefined,
    email: r.email,
    displayName: r.display_name,
    photoURL: r.photo_url ?? undefined,
    role: r.role as UserRole,
    phone: r.phone ?? undefined,
    address: r.address ?? undefined,
    birthDate: r.birth_date ?? undefined,
    startDate: r.start_date ?? undefined,
    position: r.position ?? undefined,
    adminNotes: r.admin_notes ?? undefined,
    hourlyRate: r.hourly_rate ?? undefined,
    isActive: r.is_active,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
});

/** Profile of the signed-in account plus its effective role (web admins are admins here too). */
export async function getMyProfile(userId: string): Promise<UserProfile | null> {
    const supabase = getSupabase();
    const [row, role, webProfile] = await Promise.all([
        supabase.rpc('team_directory'),
        supabase.rpc('team_role'),
        supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
    ]);
    if (row.error) throw new Error(row.error.message);
    const data = (row.data as Row[] | null)?.find(r => r.user_id === userId);
    if (!data) return null;
    const profile = toProfile(data);
    if (role.data) profile.role = role.data as UserRole;
    if (webProfile.data?.role === 'admin') profile.role = 'admin';
    return profile;
}

export async function listMembers(opts: { activeOnly?: boolean } = {}): Promise<UserProfile[]> {
    const result = await getSupabase().rpc('team_directory');
    const rows = (check(result) as Row[]).filter(r => !opts.activeOnly || r.is_active).map(toProfile);
    return rows.sort((a, b) => a.displayName.localeCompare(b.displayName, 'cs'));
}

/** Admin edit on the Zaměstnanci page. */
export async function updateMember(id: string, data: { role: UserRole; position: string; hourlyRate: number; adminNotes: string; isActive: boolean }) {
    check(await getSupabase().from('team_members').update({
        role: data.role,
        position: orNull(data.position),
        hourly_rate: data.hourlyRate || null,
        admin_notes: orNull(data.adminNotes),
        is_active: data.isActive,
    }).eq('id', id));
}

export async function deleteMember(id: string) {
    check(await getSupabase().from('team_members').delete().eq('id', id));
}

/** Personal details on the Profil page. */
export async function updateOwnProfile(id: string, data: { displayName: string; phone: string; address: string; birthDate: string }) {
    check(await getSupabase().from('team_members').update({
        display_name: data.displayName.trim() || 'Uživatel',
        phone: orNull(data.phone),
        address: orNull(data.address),
        birth_date: orNull(data.birthDate),
    }).eq('id', id));
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

const toShift = (r: Row): Shift => ({
    id: r.id,
    date: r.date,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    position: r.position,
    status: r.status as ShiftStatus,
    assignedTo: r.assigned_to ?? undefined,
    assignedToName: r.assigned_to_name ?? undefined,
    notes: r.notes ?? undefined,
    createdBy: r.created_by ?? '',
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
});

export async function listShifts(opts: { from?: string; to?: string; limit?: number } = {}): Promise<Shift[]> {
    let q = getSupabase().from('team_shifts').select('*');
    if (opts.from) q = q.gte('date', opts.from);
    if (opts.to) q = q.lte('date', opts.to);
    q = q.order('date').order('start_time');
    if (opts.limit) q = q.limit(opts.limit);
    return check(await q).map(toShift);
}

type ShiftInput = { date: string; startTime: string; endTime: string; position: string; notes?: string };

const shiftColumns = (s: ShiftInput) => ({
    date: s.date,
    start_time: s.startTime,
    end_time: s.endTime,
    position: s.position,
    notes: orNull(s.notes),
});

/** Creates open shifts and returns their ids in the same order. */
export async function createShifts(shifts: ShiftInput[], createdBy: string): Promise<string[]> {
    const rows = check(await getSupabase().from('team_shifts')
        .insert(shifts.map((s) => ({ ...shiftColumns(s), status: 'open', created_by: createdBy })))
        .select('id'));
    return rows.map((r: Row) => r.id);
}

export async function updateShift(id: string, s: ShiftInput) {
    check(await getSupabase().from('team_shifts').update(shiftColumns(s)).eq('id', id));
}

export async function assignShift(id: string, member: { uid: string; displayName: string }) {
    check(await getSupabase().from('team_shifts')
        .update({ status: 'assigned', assigned_to: member.uid, assigned_to_name: member.displayName })
        .eq('id', id));
}

export async function releaseShift(id: string) {
    check(await getSupabase().from('team_shifts')
        .update({ status: 'open', assigned_to: null, assigned_to_name: null })
        .eq('id', id));
}

export async function deleteShift(id: string) {
    check(await getSupabase().from('team_shifts').delete().eq('id', id));
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

const toTask = (r: Row): Task => ({
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    shiftId: r.shift_id ?? undefined,
    assignedTo: r.assigned_to ?? undefined,
    assignedToName: r.assigned_to_name ?? undefined,
    priority: r.priority as TaskPriority,
    status: r.status as TaskStatus,
    dueDate: r.due_date ?? undefined,
    completedAt: date(r.completed_at),
    completedBy: r.completed_by ?? undefined,
    createdBy: r.created_by ?? '',
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
});

/** Newest first. */
export async function listTasks(opts: { shiftIds?: string[]; limit?: number } = {}): Promise<Task[]> {
    let q = getSupabase().from('team_tasks').select('*');
    if (opts.shiftIds) q = q.in('shift_id', opts.shiftIds);
    q = q.order('created_at', { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    return check(await q).map(toTask);
}

type TaskInput = { title: string; description?: string; priority: TaskPriority; dueDate?: string; shiftId?: string };

export async function createTasks(tasks: TaskInput[], createdBy: string) {
    if (!tasks.length) return;
    check(await getSupabase().from('team_tasks').insert(tasks.map((t) => ({
        title: t.title,
        description: orNull(t.description),
        priority: t.priority,
        due_date: orNull(t.dueDate),
        shift_id: t.shiftId ?? null,
        status: 'pending',
        created_by: createdBy,
    }))));
}

export async function updateTask(id: string, t: TaskInput) {
    check(await getSupabase().from('team_tasks').update({
        title: t.title,
        description: orNull(t.description),
        priority: t.priority,
        due_date: orNull(t.dueDate),
    }).eq('id', id));
}

export async function setTaskStatus(id: string, status: TaskStatus, memberId: string) {
    const done = status === 'completed';
    check(await getSupabase().from('team_tasks').update({
        status,
        completed_at: done ? new Date().toISOString() : null,
        completed_by: done ? memberId : null,
    }).eq('id', id));
}

export async function deleteTask(id: string) {
    check(await getSupabase().from('team_tasks').delete().eq('id', id));
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

const toAnnouncement = (r: Row): Announcement => ({
    id: r.id,
    title: r.title,
    content: r.content,
    priority: r.priority,
    isActive: r.is_active,
    expiresAt: date(r.expires_at),
    createdBy: r.created_by ?? '',
    createdByName: r.created_by_name ?? '',
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
});

/** Newest first. */
export async function listAnnouncements(opts: { activeOnly?: boolean; limit?: number } = {}): Promise<Announcement[]> {
    let q = getSupabase().from('team_announcements').select('*');
    if (opts.activeOnly) q = q.eq('is_active', true);
    q = q.order('created_at', { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    return check(await q).map(toAnnouncement);
}

type AnnouncementInput = { title: string; content: string; priority: Announcement['priority'] };

export async function createAnnouncement(a: AnnouncementInput, author: { uid: string; displayName: string }) {
    check(await getSupabase().from('team_announcements').insert({
        ...a,
        is_active: true,
        created_by: author.uid,
        created_by_name: author.displayName,
    }));
}

export async function updateAnnouncement(id: string, a: AnnouncementInput) {
    check(await getSupabase().from('team_announcements').update(a).eq('id', id));
}

export async function deleteAnnouncement(id: string) {
    check(await getSupabase().from('team_announcements').delete().eq('id', id));
}

// ---------------------------------------------------------------------------
// INSTAVES
// ---------------------------------------------------------------------------

const BUCKET = 'instaves';

const toPhoto = (r: Row): GalleryPhoto => ({
    id: r.id,
    imageUrl: r.image_url,
    storagePath: r.storage_path ?? undefined,
    caption: r.caption ?? undefined,
    uploadedBy: r.uploaded_by ?? '',
    uploadedByName: r.uploaded_by_name ?? '',
    uploadedByPhoto: r.uploaded_by_photo ?? undefined,
    likes: r.likes ?? [],
    createdAt: new Date(r.created_at),
});

export async function listPhotos(limit = 50): Promise<GalleryPhoto[]> {
    const supabase = getSupabase();
    const rows = check(await supabase.from('team_photos').select('*').order('created_at', { ascending: false }).limit(limit)) as Row[];
    return Promise.all(rows.map(async row => {
        const path = row.storage_path || (typeof row.image_url === 'string' && row.image_url.includes('/storage/v1/object/public/instaves/') ? decodeURIComponent(row.image_url.split('/storage/v1/object/public/instaves/')[1].split('?')[0]) : null);
        if (!path) return toPhoto({ ...row, image_url: '' });
        const signed = check(await supabase.storage.from(BUCKET).createSignedUrl(path, 3600));
        return toPhoto({ ...row, image_url: signed.signedUrl });
    }));
}

/** Uploads a JPEG into the member's own folder and creates the post. */
export async function uploadPhoto(image: Blob, caption: string, author: UserProfile) {
    const supabase = getSupabase();
    const path = `${author.uid}/${Date.now()}.jpg`;
    check(await supabase.storage.from(BUCKET).upload(path, image, { contentType: 'image/jpeg' }));
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    check(await supabase.from('team_photos').insert({
        image_url: data.publicUrl,
        storage_path: path,
        caption: caption || null,
        uploaded_by: author.uid,
        uploaded_by_name: author.displayName,
        uploaded_by_photo: author.photoURL ?? null,
    }));
}

/** Likes or unlikes as the signed-in member; returns the new list of likes. */
export async function toggleLike(photoId: string): Promise<string[]> {
    return check(await getSupabase().rpc('team_toggle_like', { p_photo: photoId })) ?? [];
}

export async function deletePhoto(photo: GalleryPhoto) {
    const supabase = getSupabase();
    if (photo.storagePath) {
        const { error } = await supabase.storage.from(BUCKET).remove([photo.storagePath]);
        if (error) console.warn('Could not delete from storage:', error);
    }
    check(await supabase.from('team_photos').delete().eq('id', photo.id));
}

// ---------------------------------------------------------------------------
// Reservations from the website (read-only, allow-listed e-mails only)
// ---------------------------------------------------------------------------

export type Reservation = {
    time: string;
    party_size: number;
    name: string;
    phone: string;
    status: string;
    table_label: string | null;
    note: string | null;
    internal_note: string | null;
};

export async function listReservations(day: string): Promise<Reservation[]> {
    return check(await getSupabase().rpc('team_reservations', { p_date: day })) ?? [];
}
