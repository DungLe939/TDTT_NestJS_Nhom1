import { RestaurantDto } from "../../restaurants/dto/restaurant.dto";

export class ClusterDto {
    clusterId: number;
    centroid: [number, number];
    restaurants: RestaurantDto[];
}