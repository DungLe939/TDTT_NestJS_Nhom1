/**
 * FinalPlanDay: Interface định nghĩa cấu trúc của một ngày trong lịch trình cuối cùng.
 * Bao gồm số thứ tự ngày và các bữa ăn trong ngày đó.
 * FinalPlanDay sẽ là kết quả cuối cùng của pipeline
 */
export interface FinalPlanDay {
    // Thứ tự ngày (ví dụ: ngày 1, ngày 2)
    day: number;

    // Các bữa ăn được sắp xếp trong ngày
    meals: {
        breakfast?: any; // Bữa sáng
        lunch?: any;     // Bữa trưa
        dinner?: any;    // Bữa tối
    };
}