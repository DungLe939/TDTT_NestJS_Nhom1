import { Controller, Get, Post, Body, Param, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { FilterPostDto } from './dto/filter-post.dto';
import { AddCommentDto, LikePostDto, LikeCommentDto, VisitRestaurantDto } from './dto/action-post.dto';

@Controller('blog')
export class BlogController {
    constructor(private readonly blogService: BlogService) {}

    @Get('posts')
    @UsePipes(new ValidationPipe({ transform: true }))
    async getPosts(@Query() filter: FilterPostDto) {
        return this.blogService.getPosts(filter);
    }

    @Post('posts')
    @UsePipes(new ValidationPipe({ transform: true }))
    async createPost(@Body() dto: CreatePostDto) {
        return this.blogService.createPost(dto);
    }

    @Post('posts/:id/like')
    @UsePipes(new ValidationPipe({ transform: true }))
    async toggleLikePost(@Param('id') id: string, @Body() dto: LikePostDto) {
        return this.blogService.toggleLikePost(id, dto);
    }

    @Post('posts/:id/comments')
    @UsePipes(new ValidationPipe({ transform: true }))
    async addComment(@Param('id') id: string, @Body() dto: AddCommentDto) {
        return this.blogService.addComment(id, dto);
    }

    @Post('posts/:postId/comments/:commentId/like')
    @UsePipes(new ValidationPipe({ transform: true }))
    async toggleLikeComment(
        @Param('postId') postId: string, 
        @Param('commentId') commentId: string, 
        @Body() dto: LikeCommentDto
    ) {
        return this.blogService.toggleLikeComment(postId, commentId, dto);
    }

    @Post('visit-restaurant')
    @UsePipes(new ValidationPipe({ transform: true }))
    async visitRestaurant(@Body() dto: VisitRestaurantDto) {
        return this.blogService.visitRestaurant(dto);
    }

    @Get('restaurants')
    async getRestaurants(@Query('since') since?: string) {
        return this.blogService.getRestaurants(since);
    }
}
