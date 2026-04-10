export type RewardType = 'voucher' | 'badge' | 'points';
export type CuisineType = 'japanese' | 'vietnamese' | 'italian' | 'korean' | 'chinese' | 'thai' | 'french' | 'indian';

// actions that are triggered by the user from Blog or other Features
export type ActivityEventType =
    | 'POST_CREATED'
    | 'RESTAURANT_VISITED'
    | 'POST_LIKED'
    | 'FOOD_SCANNED'
    | 'MENU_TRANSLATED'
    | 'SCHEDULE_COMPLETED'
    | 'GROUP_TASTE_USED';

// payload sent from the external feature
export interface ActivityEvent {
    userId: string;
    type: ActivityEventType;
    occurredAt: Date;
    payload: any; // e.g. { cuisineType: "japanese" }
}

// achievement condition: actions that user need to do to get a reward
export interface AchievementCondition {
    eventType: ActivityEventType;
    requiredCount: number;
    filters?: {
        cuisineType?: CuisineType;
        withinDays?: number;
        tag?: string;
    };
}

// reward definition
export interface Reward {
    id?: string;
    type: RewardType;
    value: number; // e.g., 15 for a 15% discount
    description: string;
    expiresAt?: Date;
}

// achievement definition
export interface Achievement {
    id?: string;
    name: string;
    description: string;
    condition: AchievementCondition;
    rewardId: string;
    isActive: boolean;
}

// user's progress towards one specific achievement
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
