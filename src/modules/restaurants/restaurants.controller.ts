import {
  BadRequestException,
  NotFoundException,
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UsePipes,
  ValidationPipe,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { EngineService } from '../engine/engine.service';
import {
  GroupRecommendationDto,
  GroupRecommendationResponseDto,
} from './dto/group-recommendation.dto';
import { RestaurantsService } from './restaurants.service';
import { calculateDistance } from '../../utils/haversine.util';

type GuestRequest = Request & { guest_id?: string };

@Controller('group')
export class RestaurantsController {
  constructor(
    private readonly engineService: EngineService,
    private readonly restaurantsService: RestaurantsService,
  ) { }

  @Post('recommend')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  /**
   * Nhận request gợi ý nhóm và chuyển cho tầng engine xử lý.
   * @param dto Dữ liệu sở thích và ràng buộc của nhóm.
   * @param req Request đã được middleware gắn guest session.
   * @returns Danh sách nhà hàng được chấm điểm theo mức phù hợp nhóm.
   */
  getGroupRecommendations(
    @Body() dto: GroupRecommendationDto,
    @Req() req: GuestRequest,
  ): Promise<GroupRecommendationResponseDto> {
    const guestId = req.guest_id;
    if (!guestId) {
      throw new BadRequestException(
        'Thiếu phiên làm việc của khách. Vui lòng thử lại và đảm bảo trình duyệt đã bật cookie.',
      );
    }

    return this.engineService.getGroupRecommendations(dto, guestId);
  }

  @Post('dish-detail')
  async getDishDetail(
    @Body() body: any,
    @Req() req: GuestRequest,
  ) {
    const guestId = req.guest_id;
    if (!guestId) {
      throw new BadRequestException('Thiếu phiên làm việc của khách.');
    }

    const { restaurantId, dishId, currentLocation, users } = body;

    const allDishes = await this.restaurantsService.findDishesByGuestId(guestId);
    const selectedFood = allDishes.find(d => d.id === dishId);
    if (!selectedFood) throw new NotFoundException('Không tìm thấy món ăn');

    const allRestaurants = await this.restaurantsService.findByGuestId(guestId);
    const selectedRestaurant = allRestaurants.find(r => r.id === restaurantId);
    if (!selectedRestaurant) throw new NotFoundException('Không tìm thấy nhà hàng');

    const menu = allDishes
      .filter(d => d.restaurantId === selectedRestaurant.id)
      .slice(0, 10)
      .map(d => ({
        id: d.id,
        name: d.name,
        price: d.price,
        image_url: d.image_url,
        description: d.description,
      }));

    const distanceKm = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      selectedRestaurant.location.lat,
      selectedRestaurant.location.lng
    );

    const shop = {
      id: selectedRestaurant.id,
      name: selectedRestaurant.name,
      address: selectedRestaurant.address || `Địa chỉ tại Quận 1 (ID: ${selectedRestaurant.id})`,
      rating: selectedRestaurant.rating || 4.0,
      lat: selectedRestaurant.location.lat,
      lng: selectedRestaurant.location.lng,
      openingHours: selectedRestaurant.opening_hours || '08:00 - 22:00',
      totalReviews: Math.floor(Math.random() * 500) + 50,
      cover_image: selectedRestaurant.cover_image,
    };

    const relatedFoods = allDishes
      .filter(d => d.restaurantId !== selectedRestaurant.id && d.tags.some(tag => selectedFood.tags.includes(tag)))
      .slice(0, 6)
      .map(d => ({
        id: d.id,
        name: d.name,
        price: d.price,
        rating: d.rating,
        image_url: d.image_url,
        groupName: d.tags?.[0] || 'Món ăn',
        shop: { id: d.restaurantId, name: d.restaurant!.name }
      }));

    const recommendedShops = allRestaurants
      .filter(r => r.id !== selectedRestaurant.id && r.tags?.some(tag => selectedFood.tags.includes(tag)))
      .slice(0, 6)
      .map(r => ({
        id: r.id,
        name: r.name,
        address: r.address || `Địa chỉ tại Quận 1 (ID: ${r.id})`,
        rating: r.rating || 4.0,
        cover_image: r.cover_image,
      }));

    return {
      selectedFood,
      shop,
      menu,
      relatedFoods,
      recommendedShops,
      map: {
        distance: `${Math.round(distanceKm * 10) / 10} km`,
        duration: `${Math.round((distanceKm / 40) * 60)} phút`,
      }
    };
  }

  @Get('dish/:id')
  async getDishById(@Param('id') id: string, @Req() req: GuestRequest) {
    const guestId = req.guest_id;
    if (!guestId) throw new BadRequestException('Thiếu phiên làm việc của khách');
    const allRestaurants = await this.restaurantsService.findByGuestId(guestId);
    const restId = id.split('_')[0];
    const rest = allRestaurants.find(r => r.id === restId);
    if (!rest) throw new NotFoundException();
    return { 
      id, 
      name: `Món ${id}`, 
      restaurant: rest,
      image_url: rest.cover_image, // Fallback to restaurant image for single dish if needed
    };
  }

  @Get('restaurants')
  async getAllRestaurants(@Req() req: GuestRequest) {
    const guestId = req.guest_id;
    if (!guestId) return [];
    return this.restaurantsService.findByGuestId(guestId);
  }

  @Get('recommend/top')
  async getTopRecommendations(@Req() req: GuestRequest) {
    const guestId = req.guest_id;
    if (!guestId) return [];
    const all = await this.restaurantsService.findByGuestId(guestId);
    return all.slice(0, 1);
  }

  @Get('restaurant/:id')
  async getRestaurantDetail(
    @Param('id') id: string,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Req() req: GuestRequest,
  ) {
    const guestId = req.guest_id;
    if (!guestId) {
      throw new BadRequestException('Thiếu phiên làm việc của khách.');
    }

    const allRestaurants = await this.restaurantsService.findByGuestId(guestId);
    const restaurant = allRestaurants.find(r => r.id === id);

    if (!restaurant) throw new NotFoundException('Không tìm thấy nhà hàng');

    const allDishes = await this.restaurantsService.findDishesByGuestId(guestId);
    const menu = allDishes
      .filter(d => d.restaurantId === id)
      .map(d => ({
        id: d.id,
        name: d.name,
        price: d.price,
        image_url: d.image_url
      }));

    let mapInfo: any = null;
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      if (!isNaN(userLat) && !isNaN(userLng)) {
        const dist = calculateDistance(userLat, userLng, restaurant.location.lat, restaurant.location.lng);
        mapInfo = {
          distance: `${Math.round(dist * 10) / 10} km`,
          duration: `${Math.round((dist / 40) * 60)} phút`
        };
      }
    }

    return {
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address || `Địa chỉ tại Quận 1 (ID: ${restaurant.id})`,
      lat: restaurant.location.lat,
      lng: restaurant.location.lng,
      rating: restaurant.rating || 4.0,
      openingHours: restaurant.opening_hours || '08:00 - 22:00',
      cover_image: restaurant.cover_image,
      menu,
      map: mapInfo
    };
  }

  @Get('recommend/similar-restaurants')
  async getSimilarRestaurants(
    @Query('restaurantId') restaurantId: string,
    @Req() req: GuestRequest,
  ) {
    const guestId = req.guest_id;
    if (!guestId) {
      throw new BadRequestException('Thiếu phiên làm việc của khách.');
    }

    const allRestaurants = await this.restaurantsService.findByGuestId(guestId);
    const target = allRestaurants.find(r => r.id === restaurantId);

    if (!target) return [];

    const recommendedShops = allRestaurants
      .filter(r => r.id !== restaurantId && (!target.tags || !r.tags || r.tags.some(tag => target.tags?.includes(tag))))
      .slice(0, 6)
      .map(r => ({
        id: r.id,
        name: r.name,
        address: r.address || `Địa chỉ tại Quận 1 (ID: ${r.id})`,
        rating: r.rating || 4.0,
        cover_image: r.cover_image,
      }));

    if (recommendedShops.length < 4) {
      const fallback = allRestaurants
        .filter(r => r.id !== restaurantId && !recommendedShops.some(rs => rs.id === r.id))
        .slice(0, 6 - recommendedShops.length)
        .map(r => ({
          id: r.id,
          name: r.name,
          address: r.address || `Địa chỉ tại Quận 1 (ID: ${r.id})`,
          rating: r.rating || 4.0,
          cover_image: r.cover_image,
        }));
      recommendedShops.push(...fallback);
    }

    return recommendedShops;
  }
}
