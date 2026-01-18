// User roles
export type UserRole = 'admin' | 'employee';

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
