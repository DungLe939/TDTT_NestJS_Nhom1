import { IRestaurant } from './restaurant.interface';

export interface IDish {
  id: string;
  name: string;
  price: number;
  tags: string[];
  rating: number;
  image_url?: string;
  description?: string;
  restaurantId: string;
  restaurant?: IRestaurant;
}
