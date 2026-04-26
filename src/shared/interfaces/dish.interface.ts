import { IRestaurant } from './restaurant.interface';

export interface IDish {
  id: string;
  name: string;
  price: number;
  tags: string[];
  rating: number;
  restaurantId: string;
  restaurant?: IRestaurant;
}
