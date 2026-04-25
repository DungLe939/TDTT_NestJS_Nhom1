import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface Category_Key {
  id: UUIDString;
  __typename?: 'Category_Key';
}

export interface CrawlBatch_Key {
  id: UUIDString;
  __typename?: 'CrawlBatch_Key';
}

export interface CreateCategoryData {
  category_insert: Category_Key;
}

export interface CreateCategoryVariables {
  name: string;
  slug: string;
}

export interface CreateFoodItemData {
  foodItem_insert: FoodItem_Key;
}

export interface CreateFoodItemVariables {
  name: string;
  description?: string | null;
  price: number;
  priceDisplay?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  groupName?: string | null;
  isPopular: boolean;
  totalLike: number;
  shopId: UUIDString;
  categoryId: UUIDString;
}

export interface CreateShopData {
  shop_insert: Shop_Key;
}

export interface CreateShopVariables {
  externalId: string;
  name: string;
  address: string;
  city: string;
  rating?: number | null;
  coverImage?: string | null;
  url?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  priceDisplay?: string | null;
  latitude: number;
  longitude: number;
}

export interface DeletePlanCacheData {
  planCache_delete?: PlanCache_Key | null;
}

export interface DeletePlanCacheVariables {
  guestId: string;
}

export interface FoodItem_Key {
  id: UUIDString;
  __typename?: 'FoodItem_Key';
}

export interface GetFoodDetailData {
  foodItem?: {
    id: UUIDString;
    name: string;
    description?: string | null;
    price: number;
    priceDisplay?: string | null;
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
    groupName?: string | null;
    isPopular: boolean;
    totalLike: number;
    shop: {
      id: UUIDString;
      name: string;
      address: string;
      city: string;
      rating?: number | null;
      coverImage?: string | null;
      url: string;
      openTime?: string | null;
      closeTime?: string | null;
      priceMin?: number | null;
      priceMax?: number | null;
      priceDisplay?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    } & Shop_Key;
      category: {
        id: UUIDString;
        name: string;
        slug: string;
      } & Category_Key;
  } & FoodItem_Key;
}

export interface GetFoodDetailVariables {
  id: UUIDString;
}

export interface GetPlanCacheData {
  planCache?: {
    id: string;
    rawRestaurants?: unknown | null;
    orderedPlan?: unknown | null;
    mealBudgetConfig?: unknown | null;
    preferences?: unknown | null;
    usedCategories: string[];
    dayScores?: unknown | null;
    updatedAt: TimestampString;
  } & PlanCache_Key;
}

export interface GetPlanCacheVariables {
  guestId: string;
}

export interface GetShopDetailData {
  shop?: {
    id: UUIDString;
    externalId?: string | null;
    name: string;
    address: string;
    city: string;
    rating?: number | null;
    coverImage?: string | null;
    url: string;
    openTime?: string | null;
    closeTime?: string | null;
    priceMin?: number | null;
    priceMax?: number | null;
    priceDisplay?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    foodItems_on_shop: ({
      id: UUIDString;
      name: string;
      description?: string | null;
      price: number;
      priceDisplay?: string | null;
      imageUrl?: string | null;
      thumbnailUrl?: string | null;
      groupName?: string | null;
      isPopular: boolean;
      totalLike: number;
      category: {
        id: UUIDString;
        name: string;
        slug: string;
      } & Category_Key;
    } & FoodItem_Key)[];
  } & Shop_Key;
}

export interface GetShopDetailVariables {
  id: UUIDString;
}

export interface ListAllShopsWithMenuData {
  shops: ({
    id: UUIDString;
    externalId?: string | null;
    name: string;
    address: string;
    city: string;
    rating?: number | null;
    coverImage?: string | null;
    url: string;
    openTime?: string | null;
    closeTime?: string | null;
    priceMin?: number | null;
    priceMax?: number | null;
    priceDisplay?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    foodItems_on_shop: ({
      id: UUIDString;
      name: string;
      description?: string | null;
      price: number;
      priceDisplay?: string | null;
      imageUrl?: string | null;
      thumbnailUrl?: string | null;
      groupName?: string | null;
      isPopular: boolean;
      totalLike: number;
      category: {
        id: UUIDString;
        name: string;
        slug: string;
      } & Category_Key;
    } & FoodItem_Key)[];
  } & Shop_Key)[];
}

export interface ListCategoriesData {
  categories: ({
    id: UUIDString;
    name: string;
    slug: string;
  } & Category_Key)[];
}

export interface ListFoodsByCategoryData {
  foodItems: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    price: number;
    priceDisplay?: string | null;
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
    isPopular: boolean;
    totalLike: number;
    shop: {
      id: UUIDString;
      name: string;
      rating?: number | null;
    } & Shop_Key;
      category: {
        id: UUIDString;
        name: string;
        slug: string;
      } & Category_Key;
  } & FoodItem_Key)[];
}

export interface ListFoodsByCategoryVariables {
  categoryId: UUIDString;
  limit?: number | null;
  offset?: number | null;
}

export interface ListFoodsData {
  foodItems: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    price: number;
    priceDisplay?: string | null;
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
    groupName?: string | null;
    isPopular: boolean;
    totalLike: number;
    shop: {
      id: UUIDString;
      name: string;
      rating?: number | null;
      address: string;
    } & Shop_Key;
      category: {
        id: UUIDString;
        name: string;
        slug: string;
      } & Category_Key;
  } & FoodItem_Key)[];
}

export interface ListFoodsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListShopsData {
  shops: ({
    id: UUIDString;
    name: string;
    address: string;
    city: string;
    rating?: number | null;
    coverImage?: string | null;
    priceDisplay?: string | null;
    openTime?: string | null;
    closeTime?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } & Shop_Key)[];
}

export interface ListShopsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface PlanCache_Key {
  id: string;
  __typename?: 'PlanCache_Key';
}

export interface Shop_Key {
  id: UUIDString;
  __typename?: 'Shop_Key';
}

export interface UpdateDayScoresData {
  planCache_update?: PlanCache_Key | null;
}

export interface UpdateDayScoresVariables {
  guestId: string;
  dayScores?: unknown | null;
}

export interface UpdateUsedCategoriesData {
  planCache_update?: PlanCache_Key | null;
}

export interface UpdateUsedCategoriesVariables {
  guestId: string;
  usedCategories: string[];
}

export interface UpsertPlanCacheData {
  planCache_upsert: PlanCache_Key;
}

export interface UpsertPlanCacheVariables {
  guestId: string;
  rawRestaurants?: unknown | null;
  orderedPlan?: unknown | null;
  mealBudgetConfig?: unknown | null;
  preferences?: unknown | null;
  usedCategories: string[];
  dayScores?: unknown | null;
}

/** Generated Node Admin SDK operation action function for the 'CreateCategory' Mutation. Allow users to execute without passing in DataConnect. */
export function createCategory(dc: DataConnect, vars: CreateCategoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCategoryData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCategory' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCategory(vars: CreateCategoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCategoryData>>;

/** Generated Node Admin SDK operation action function for the 'CreateShop' Mutation. Allow users to execute without passing in DataConnect. */
export function createShop(dc: DataConnect, vars: CreateShopVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateShopData>>;
/** Generated Node Admin SDK operation action function for the 'CreateShop' Mutation. Allow users to pass in custom DataConnect instances. */
export function createShop(vars: CreateShopVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateShopData>>;

/** Generated Node Admin SDK operation action function for the 'CreateFoodItem' Mutation. Allow users to execute without passing in DataConnect. */
export function createFoodItem(dc: DataConnect, vars: CreateFoodItemVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateFoodItemData>>;
/** Generated Node Admin SDK operation action function for the 'CreateFoodItem' Mutation. Allow users to pass in custom DataConnect instances. */
export function createFoodItem(vars: CreateFoodItemVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateFoodItemData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertPlanCache' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertPlanCache(dc: DataConnect, vars: UpsertPlanCacheVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertPlanCacheData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertPlanCache' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertPlanCache(vars: UpsertPlanCacheVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertPlanCacheData>>;

/** Generated Node Admin SDK operation action function for the 'DeletePlanCache' Mutation. Allow users to execute without passing in DataConnect. */
export function deletePlanCache(dc: DataConnect, vars: DeletePlanCacheVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeletePlanCacheData>>;
/** Generated Node Admin SDK operation action function for the 'DeletePlanCache' Mutation. Allow users to pass in custom DataConnect instances. */
export function deletePlanCache(vars: DeletePlanCacheVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeletePlanCacheData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateDayScores' Mutation. Allow users to execute without passing in DataConnect. */
export function updateDayScores(dc: DataConnect, vars: UpdateDayScoresVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateDayScoresData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateDayScores' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateDayScores(vars: UpdateDayScoresVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateDayScoresData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUsedCategories' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUsedCategories(dc: DataConnect, vars: UpdateUsedCategoriesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUsedCategoriesData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUsedCategories' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUsedCategories(vars: UpdateUsedCategoriesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUsedCategoriesData>>;

/** Generated Node Admin SDK operation action function for the 'ListCategories' Query. Allow users to execute without passing in DataConnect. */
export function listCategories(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCategoriesData>>;
/** Generated Node Admin SDK operation action function for the 'ListCategories' Query. Allow users to pass in custom DataConnect instances. */
export function listCategories(options?: OperationOptions): Promise<ExecuteOperationResponse<ListCategoriesData>>;

/** Generated Node Admin SDK operation action function for the 'ListFoods' Query. Allow users to execute without passing in DataConnect. */
export function listFoods(dc: DataConnect, vars?: ListFoodsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFoodsData>>;
/** Generated Node Admin SDK operation action function for the 'ListFoods' Query. Allow users to pass in custom DataConnect instances. */
export function listFoods(vars?: ListFoodsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFoodsData>>;

/** Generated Node Admin SDK operation action function for the 'ListFoodsByCategory' Query. Allow users to execute without passing in DataConnect. */
export function listFoodsByCategory(dc: DataConnect, vars: ListFoodsByCategoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFoodsByCategoryData>>;
/** Generated Node Admin SDK operation action function for the 'ListFoodsByCategory' Query. Allow users to pass in custom DataConnect instances. */
export function listFoodsByCategory(vars: ListFoodsByCategoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFoodsByCategoryData>>;

/** Generated Node Admin SDK operation action function for the 'GetFoodDetail' Query. Allow users to execute without passing in DataConnect. */
export function getFoodDetail(dc: DataConnect, vars: GetFoodDetailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetFoodDetailData>>;
/** Generated Node Admin SDK operation action function for the 'GetFoodDetail' Query. Allow users to pass in custom DataConnect instances. */
export function getFoodDetail(vars: GetFoodDetailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetFoodDetailData>>;

/** Generated Node Admin SDK operation action function for the 'GetShopDetail' Query. Allow users to execute without passing in DataConnect. */
export function getShopDetail(dc: DataConnect, vars: GetShopDetailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetShopDetailData>>;
/** Generated Node Admin SDK operation action function for the 'GetShopDetail' Query. Allow users to pass in custom DataConnect instances. */
export function getShopDetail(vars: GetShopDetailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetShopDetailData>>;

/** Generated Node Admin SDK operation action function for the 'ListShops' Query. Allow users to execute without passing in DataConnect. */
export function listShops(dc: DataConnect, vars?: ListShopsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListShopsData>>;
/** Generated Node Admin SDK operation action function for the 'ListShops' Query. Allow users to pass in custom DataConnect instances. */
export function listShops(vars?: ListShopsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListShopsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllShopsWithMenu' Query. Allow users to execute without passing in DataConnect. */
export function listAllShopsWithMenu(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllShopsWithMenuData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllShopsWithMenu' Query. Allow users to pass in custom DataConnect instances. */
export function listAllShopsWithMenu(options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllShopsWithMenuData>>;

/** Generated Node Admin SDK operation action function for the 'GetPlanCache' Query. Allow users to execute without passing in DataConnect. */
export function getPlanCache(dc: DataConnect, vars: GetPlanCacheVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPlanCacheData>>;
/** Generated Node Admin SDK operation action function for the 'GetPlanCache' Query. Allow users to pass in custom DataConnect instances. */
export function getPlanCache(vars: GetPlanCacheVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPlanCacheData>>;

