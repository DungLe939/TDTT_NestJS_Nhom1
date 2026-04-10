export type RewardType = 'voucher' | 'badge' | 'points';
export type CuisineType = 'japanese' | 'vietnamese' | 'italian' | 'korean' | 'chinese' | 'thai' | 'french' | 'indian';

// Các hành động từ user (khi dùng Blog, feature 1, 2, 3, 4) sẽ được gửi đến AchievementsModule
export type ActivityEventType =
    | 'POST_CREATED'
    | 'RESTAURANT_VISITED'
    | 'POST_LIKED'
    | 'FOOD_SCANNED'
    | 'MENU_TRANSLATED'
    | 'SCHEDULE_COMPLETED'
    | 'GROUP_TASTE_USED';

// payload được gửi từ các feature khác
export interface ActivityEvent {
    userId: string;
    type: ActivityEventType;
    occurredAt: Date;
    payload: any; // e.g. { cuisineType: "japanese" }
}

// achievement condition: hành động mà user cần làm để nhận reward
export interface AchievementCondition {
    eventType: ActivityEventType;
    requiredCount: number;
    filters?: {
        cuisineType?: CuisineType;
        withinDays?: number;
        tag?: string;
    };
}

// định nghĩa reward
export interface Reward {
    id?: string;
    type: RewardType;
    value: number; // e.g., 15 for a 15% discount
    description: string;
    expiresAt?: Date;
}

// định nghĩa achievement
export interface Achievement {
    id?: string;
    name: string;
    description: string;
    condition: AchievementCondition;
    rewardId: string;
    isActive: boolean;
}

// tiến độ của user đối với một achievement nào đó
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

