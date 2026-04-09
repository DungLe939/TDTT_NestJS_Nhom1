import { calculateDistance } from '../src/utils/haversine.util';

describe('calculateDistance (Haversine)', () => {
  it('should calculate distance between Chợ Bến Thành and Nhà thờ Đức Bà (~0.86km)', () => {
    const distance = calculateDistance(10.7721, 106.698, 10.7798, 106.699);
    expect(distance).toBeGreaterThan(0.7);
    expect(distance).toBeLessThan(1.1);
  });

  it('should return 0 when both points are the same', () => {
    const distance = calculateDistance(10.7721, 106.698, 10.7721, 106.698);
    expect(distance).toBe(0);
  });

  it('should calculate longer distance between Q1 and Bình Thạnh', () => {
    const distance = calculateDistance(10.7769, 106.6952, 10.8010, 106.7120);
    expect(distance).toBeGreaterThan(2);
    expect(distance).toBeLessThan(5);
  });
});

/*
npx jest --rootDir=. test/haversine.spec.ts
*/