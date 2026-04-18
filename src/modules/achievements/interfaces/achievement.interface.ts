export type RewardType = 'voucher' | 'badge' | 'points';
export type CuisineType =
    | 'japanese' | 'vietnamese' | 'italian' | 'korean'
    | 'chinese' | 'thai' | 'french' | 'indian'
    | 'cafe' | 'street-food' | 'fine-dining';

// Các hành động từ user (khi dùng Blog, feature 1, 2, 3, 4) sẽ được gửi đến AchievementsModule
export type ActivityEventType =
    | 'POST_CREATED'
    | 'RESTAURANT_VISITED'
    | 'POST_LIKED'
    | 'FOOD_SCANNED'
    | 'MENU_TRANSLATED'
    | 'SCHEDULE_COMPLETED'
    | 'GROUP_TASTE_USED';

// payload được gửi từ các feature khác — typed thay vì any
export interface ActivityEventPayload {
    restaurantId?: string;
    cuisineType?: CuisineType;
    postId?: string;
    tags?: string[];
    scannedFoodId?: string;
    translatedMenuId?: string;
    completedScheduleId?: string;
    groupSessionId?: string;
}

export interface ActivityEvent {
    userId: string;
    type: ActivityEventType;
    occurredAt: Date;
    payload: ActivityEventPayload;
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
    icon?: string;
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

// Response interface cho API: achievement kèm tiến độ của user
export interface AchievementWithProgress extends Achievement {
    progress: ProgressTracker;
}

// Record phần thưởng đã cấp cho user
export interface UserReward {
    id?: string;
    userId: string;
    rewardId: string;
    achievementId: string;
    issuedAt: Date;
    isUsed: boolean;
    expiresAt?: Date;
}

// Response interface cho API: user reward kèm chi tiết reward
export interface UserRewardResolved extends UserReward {
    reward: Reward | null;
}

