import { Injectable } from '@nestjs/common';

/**
 * SortingHelper: Hỗ trợ sắp xếp và lựa chọn nhà hàng/món ăn tốt nhất dựa trên điểm số.
 */
@Injectable()
export class SortingHelper {
    /**
     * Sắp xếp danh sách nhà hàng theo điểm số giảm dần cho từng buổi cụ thể (Sáng, Trưa, Tối).
     * 
     * @param scoredList Danh sách nhà hàng đã được tính điểm
     * @param session Buổi cần sắp xếp ('breakfast' | 'lunch' | 'dinner')
     * @returns Danh sách nhà hàng đã sắp xếp từ cao đến thấp
     */
    sortForSession(scoredList: any[], session: 'breakfast' | 'lunch' | 'dinner') {
        return [...scoredList]
            // Loại bỏ các nhà hàng có điểm số <= 0 (có thể do đóng cửa hoặc không phù hợp)
            .filter(item => item.scores[session] > 0)
            // Sắp xếp giảm dần theo điểm của buổi đó
            .sort((a, b) => b.scores[session] - a.scores[session]);
    }

    /**
     * Lấy món ăn tốt nhất của một nhà hàng mà người dùng chưa từng ăn trong lịch trình này.
     * Tránh việc gợi ý lặp lại cùng một món ăn nhiều lần.
     * 
     * @param restaurant Đối tượng nhà hàng chứa danh sách món ăn gợi ý
     * @param usedDishNames Tập hợp các tên món ăn đã được sử dụng trước đó
     * @returns Món ăn tốt nhất chưa sử dụng, hoặc undefined nếu tất cả món đã ăn rồi
     */
    getBestDish(restaurant: any, usedDishNames: Set<string> = new Set()) {
        // 1. Sắp xếp các món ăn trong nhà hàng theo điểm số gợi ý từ cao xuống thấp
        const sortedDishes = [...restaurant.recommendedDishes].sort((a: any, b: any) => b.score - a.score);

        /**
         * 2. Tìm món ăn đầu tiên chưa xuất hiện trong usedDishNames.
         * Nếu không tìm thấy, hệ thống sẽ bỏ qua quán này để chọn quán tiếp theo có món mới.
         */
        return sortedDishes.find(dish => !usedDishNames.has(dish.name));
    }
}