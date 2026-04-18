import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { db } from '../../providers/firebase.provider';
import { AchievementService } from '../achievements/achievements.service';
import { CreatePostDto } from './dto/create-post.dto';
import { FilterPostDto } from './dto/filter-post.dto';
import { AddCommentDto, LikePostDto, VisitRestaurantDto } from './dto/action-post.dto';

@Injectable()
export class BlogService {
    private readonly logger = new Logger(BlogService.name);
    private readonly postsCollection = db.collection('posts');
    private readonly restaurantsCollection = db.collection('restaurants');

    constructor(private readonly achievementService: AchievementService) {}

    async createPost(dto: CreatePostDto) {
        const postData = {
            authorId: dto.authorId,
            content: dto.content,
            tags: dto.tags || [],
            restaurantId: dto.restaurantId || null,
            photoUrls: dto.photoUrls || [],
            createdAt: new Date().toISOString(),
            likesCount: 0,
            likedByUserIds: [],
            comments: [],
        };

        const docRef = await this.postsCollection.add(postData);
        const newPost = { id: docRef.id, ...postData };

        // Log activity: POST_CREATED
        await this.achievementService.handleActivityEvent({
            userId: dto.authorId,
            type: 'POST_CREATED',
            occurredAt: new Date(newPost.createdAt),
            payload: {
                postId: docRef.id,
                tags: dto.tags,
            }
        }).catch(err => this.logger.error('Failed to handle POST_CREATED event', err));

        return newPost;
    }

    async getPosts(filter: FilterPostDto) {
        let query: any = this.postsCollection;

        if (filter.authorId) {
            query = query.where('authorId', '==', filter.authorId);
        }
        if (filter.restaurantId) {
            query = query.where('restaurantId', '==', filter.restaurantId);
        }
        if (filter.tags && filter.tags.length > 0) {
            query = query.where('tags', 'array-contains-any', filter.tags);
        }

        const snapshot = await query.get();
        if (snapshot.empty) return [];

        let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort descending by created time
        posts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return posts;
    }

    async toggleLikePost(postId: string, dto: LikePostDto) {
        const docRef = this.postsCollection.doc(postId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw new NotFoundException(`Post ${postId} not found`);
        }

        const post = doc.data() as any;
        const index = post.likedByUserIds.indexOf(dto.userId);
        const alreadyLiked = index > -1;

        if (alreadyLiked) {
            post.likedByUserIds.splice(index, 1);
            post.likesCount = Math.max(0, post.likesCount - 1);
        } else {
            post.likedByUserIds.push(dto.userId);
            post.likesCount += 1;
        }

        await docRef.update({
            likedByUserIds: post.likedByUserIds,
            likesCount: post.likesCount
        });

        // Log activity: POST_LIKED (only when liking, not unliking)
        if (!alreadyLiked) {
            await this.achievementService.handleActivityEvent({
                userId: dto.userId,
                type: 'POST_LIKED',
                occurredAt: new Date(),
                payload: {
                    postId: postId,
                }
            }).catch(err => this.logger.error('Failed to handle POST_LIKED event', err));
        }

        return { id: docRef.id, ...post };
    }

    async addComment(postId: string, dto: AddCommentDto) {
        const docRef = this.postsCollection.doc(postId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw new NotFoundException(`Post ${postId} not found`);
        }

        const post = doc.data() as any;
        const newComment = {
            id: `cmt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            authorId: dto.userId,
            content: dto.content,
            createdAt: new Date().toISOString(),
        };

        if (!post.comments) {
            post.comments = [];
        }
        post.comments.push(newComment);

        await docRef.update({ comments: post.comments });

        return { id: docRef.id, ...post };
    }

    async visitRestaurant(dto: VisitRestaurantDto) {
        // Log activity: RESTAURANT_VISITED
        await this.achievementService.handleActivityEvent({
            userId: dto.userId,
            type: 'RESTAURANT_VISITED',
            occurredAt: new Date(),
            payload: {
                restaurantId: dto.restaurantId,
                cuisineType: dto.cuisineType as any,
            }
        }).catch(err => this.logger.error('Failed to handle RESTAURANT_VISITED event', err));

        return { success: true, message: `Visited restaurant ${dto.restaurantId}` };
    }
}
