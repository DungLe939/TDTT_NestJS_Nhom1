import { Injectable } from '@nestjs/common';

@Injectable()
export class SortingHelper {
    /**
     * Sắp xếp danh sách nhà hàng theo điểm số giảm dần cho từng buổi cụ thể
     */
    sortForSession(scoredList: any[], session: 'breakfast' | 'lunch' | 'dinner') {
        return [...scoredList]
            .filter(item => item.scores[session] > 0) // Loại bỏ các quán bị điểm âm (dị ứng/đóng cửa)
            .sort((a, b) => b.scores[session] - a.scores[session]);
    }

    getBestDish(restaurant: any, usedDishNames: Set<string> = new Set()) {
        // 1. Sắp xếp các món theo điểm từ cao xuống thấp
        const sortedDishes = [...restaurant.recommendedDishes].sort((a: any, b: any) => b.score - a.score);

        // 2. Tìm món đầu tiên CHƯA nằm trong danh sách đã ăn, NẾU không có thì trả về rỗng
        // để bên ScoringHelper bỏ qua quán này và chạy sang quán hạng thứ 2.
        return sortedDishes.find(dish => !usedDishNames.has(dish.name));
    }
}