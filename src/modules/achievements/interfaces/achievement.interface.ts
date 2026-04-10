export type RewardType = 'voucher' | 'badge' | 'points';
export type CuisineType = 'japanese' | 'vietnamese' | 'italian' | 'korean' | 'chinese' | 'thai' | 'french' | 'indian';

// Any action triggered by the user from Blog or other Features
export type ActivityEventType =
    | 'POST_CREATED'
    | 'RESTAURANT_VISITED'
    | 'POST_LIKED'
    | 'FOOD_SCANNED'
    | 'MENU_TRANSLATED'
    | 'SCHEDULE_COMPLETED'
    | 'GROUP_TASTE_USED';

// The payload sent from the external feature
export interface ActivityEvent {
    userId: string;
    type: ActivityEventType;
    occurredAt: Date;
    payload: any; // e.g. { cuisineType: "japanese" }
}

// How we define what actions cause a reward
export interface AchievementCondition {
    eventType: ActivityEventType;
    requiredCount: number;
    filters?: {
        cuisineType?: CuisineType;
        withinDays?: number;
        tag?: string;
    };
}

// A reward that can be earned
export interface Reward {
    id?: string;
    type: RewardType;
    value: number; // e.g., 15 for a 15% discount
    description: string;
    expiresAt?: Date;
}

// The core Achievement Definition
export interface Achievement {
    id?: string;
    name: string;
    description: string;
    condition: AchievementCondition;
    rewardId: string;
    isActive: boolean;
}

// Represents one user's progress towards one specific achievement
export interface ProgressTracker {
    id?: string;
    userId: string;
    achievementId: string;
    currentCount: number;
    requiredCount: number;
    progressPercent: number;
    isCompleted: boolean;
    completedAt?: Date;
}
