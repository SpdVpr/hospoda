// User roles
// admin = full access
// shift_manager = can create/assign shifts (vedoucí směny)
// brigadnik_senior = zaučený brigádník — může brát i senior-only směny
// brigadnik_junior = nový brigádník — může brát pouze směny kategorie "all"
// employee = legacy/neutrální role (chová se jako senior z hlediska oprávnění brát směny)
export type UserRole = 'admin' | 'shift_manager' | 'brigadnik_senior' | 'brigadnik_junior' | 'employee';

// Shift category - determines who can sign up for a shift
// senior_only = pouze brigadnik_senior (a admin / shift_manager / employee)
// all         = libovolný brigádník (junior i senior)
export type ShiftCategory = 'senior_only' | 'all';

// User profile
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    role: UserRole;
    phone?: string;
    address?: string;
    birthDate?: string;
    startDate?: string;
    position?: string;
    adminNotes?: string;
    hourlyRate?: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Shift status
export type ShiftStatus = 'open' | 'assigned' | 'completed' | 'cancelled';

// Shift
export interface Shift {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    position: string;
    category?: ShiftCategory; // missing = 'all' (zpětná kompatibilita pro starší směny)
    status: ShiftStatus;
    assignedTo?: string;
    assignedToName?: string;
    notes?: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

// Task priority
export type TaskPriority = 'low' | 'medium' | 'high';

// Task status
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

// Task
export interface Task {
    id: string;
    title: string;
    description?: string;
    shiftId?: string;
    assignedTo?: string;
    assignedToName?: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate?: string;
    completedAt?: Date;
    completedBy?: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

// Announcement
export interface Announcement {
    id: string;
    title: string;
    content: string;
    priority: 'normal' | 'important' | 'urgent';
    isActive: boolean;
    expiresAt?: Date;
    createdBy: string;
    createdByName: string;
    createdAt: Date;
    updatedAt: Date;
}

// Gallery Photo (Vesnický Instagram)
export interface GalleryPhoto {
    id: string;
    imageUrl: string;
    storagePath?: string; // Path in Firebase Storage for deletion
    caption?: string;
    uploadedBy: string;
    uploadedByName: string;
    uploadedByPhoto?: string;
    likes: string[]; // array of user UIDs who liked
    createdAt: Date;
}
