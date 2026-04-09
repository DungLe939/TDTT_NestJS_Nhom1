/**
 * Mock Restaurant Data
 *
 * 10 nhà hàng gần TP. Hồ Chí Minh với taste_vector 8 chiều.
 * Toạ độ thực tế tại: Q1, Q3, Q5, Q10, Bình Thạnh, Phú Nhuận.
 *
 * Taste vector dimensions:
 *   [0] cay, [1] ngot, [2] man, [3] chua,
 *   [4] beo, [5] thanh_dam, [6] hai_san, [7] chay
 *
 * Mapping Firebase: restaurant collection
 *
 * @module restaurants/data/mock
 */

import { IRestaurant } from '../../../../shared/interfaces/restaurant.interface';

export const MOCK_RESTAURANTS: IRestaurant[] = [
  {
    name: 'Phở Hòa Pasteur',
    location: { lat: 10.7769, lng: 106.6952 },  // Q3
    averagePrice: 65000,
    //         [cay, ngot, man, chua, beo, thanh, hai_san, chay]
    taste_vector: [0.3, 0.1, 0.7, 0.2, 0.4, 0.6, 0.0, 0.0],
    rating: 4.5,
    menu_ingredients: ['thit_bo', 'banh_pho', 'hanh', 'gia', 'rau_thom'],
    tags: ['truyen_thong', 'gia_dinh'],
    opening_hours: '06:00-22:00',
  },
  {
    name: 'Cơm Tấm Bụi Sài Gòn',
    location: { lat: 10.7731, lng: 106.6942 },  // Q3
    averagePrice: 45000,
    taste_vector: [0.5, 0.2, 0.8, 0.1, 0.7, 0.2, 0.0, 0.0],
    rating: 4.2,
    menu_ingredients: ['thit_heo', 'trung', 'bi', 'mo_hanh', 'nuoc_mam'],
    tags: ['truyen_thong', 'an_nhanh'],
    opening_hours: '06:00-21:00',
  },
  {
    name: 'Bánh Mì Huỳnh Hoa',
    location: { lat: 10.7715, lng: 106.6930 },  // Q1 cận
    averagePrice: 47000,
    taste_vector: [0.2, 0.1, 0.6, 0.1, 0.6, 0.3, 0.0, 0.0],
    rating: 4.7,
    menu_ingredients: ['thit_nguoi', 'pa_te', 'banh_mi', 'do_chua', 'rau'],
    tags: ['an_nhanh', 'mang_di'],
    opening_hours: '14:30-23:00',
  },
  {
    name: 'Quán Chay Tâm Đức',
    location: { lat: 10.7805, lng: 106.6803 },  // Q10
    averagePrice: 35000,
    taste_vector: [0.1, 0.3, 0.4, 0.2, 0.1, 0.9, 0.0, 1.0],
    rating: 4.0,
    menu_ingredients: ['dau_hu', 'nam', 'rau_cu', 'mi_can', 'bot_mi'],
    tags: ['chay', 'healthy', 'yen_tinh'],
    opening_hours: '07:00-20:00',
  },
  {
    name: 'Bún Bò Huế 3A3',
    location: { lat: 10.7650, lng: 106.6880 },  // Q1 gần cầu
    averagePrice: 55000,
    taste_vector: [0.9, 0.0, 0.7, 0.1, 0.5, 0.3, 0.1, 0.0],
    rating: 4.3,
    menu_ingredients: ['thit_bo', 'gio_heo', 'mam_ruoc', 'sa', 'bun'],
    tags: ['truyen_thong', 'cay'],
    opening_hours: '06:00-21:30',
  },
  {
    name: 'Lẩu Thái Saigon',
    location: { lat: 10.8010, lng: 106.7120 },  // Bình Thạnh
    averagePrice: 180000,
    taste_vector: [0.8, 0.2, 0.5, 0.7, 0.3, 0.2, 0.6, 0.0],
    rating: 4.1,
    menu_ingredients: ['tom', 'muc', 'nam', 'rau', 'sa', 'chanh'],
    tags: ['nhom', 'lau'],
    opening_hours: '10:00-23:00',
  },
  {
    name: 'Hải Sản Năm Đảo',
    location: { lat: 10.7920, lng: 106.7050 },  // Phú Nhuận
    averagePrice: 200000,
    taste_vector: [0.3, 0.1, 0.6, 0.3, 0.4, 0.3, 0.9, 0.0],
    rating: 3.8,
    menu_ingredients: ['tom', 'cua', 'ca', 'muc', 'so_diep', 'oc'],
    tags: ['nhom', 'bia', 'nuong'],
    opening_hours: '16:00-23:00',
  },
  {
    name: 'Trà Sữa & Tráng Miệng Cheese',
    location: { lat: 10.7745, lng: 106.6900 },  // Q1
    averagePrice: 40000,
    taste_vector: [0.0, 0.9, 0.1, 0.1, 0.3, 0.5, 0.0, 0.2],
    rating: 4.4,
    menu_ingredients: ['sua', 'duong', 'tra', 'kem', 'trai_cay'],
    tags: ['trang_mieng', 'an_vat'],
    opening_hours: '09:00-22:30',
  },
  {
    name: 'Quán Ăn Gia Đình Sài Gòn',
    location: { lat: 10.7700, lng: 106.6920 },  // Q1
    averagePrice: 60000,
    taste_vector: [0.4, 0.2, 0.7, 0.3, 0.5, 0.4, 0.2, 0.1],
    rating: 3.5,
    menu_ingredients: ['thit_heo', 'ca', 'rau', 'trung', 'dau_hu'],
    tags: ['gia_dinh', 'truyen_thong'],
    opening_hours: '10:00-21:00',
  },
  {
    name: 'Bún Chả Hà Nội - Chi Nhánh Q3',
    location: { lat: 10.7780, lng: 106.6910 },  // Q3
    averagePrice: 50000,
    taste_vector: [0.3, 0.3, 0.6, 0.2, 0.5, 0.4, 0.0, 0.0],
    rating: 4.6,
    menu_ingredients: ['thit_heo', 'bun', 'nuoc_mam', 'rau_song', 'nem'],
    tags: ['truyen_thong', 'nuong'],
    opening_hours: '10:00-21:00',
  },
];
