import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { WebkassaWebhookDto } from './dto/webhook.dto';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getSubscription(@Request() req: { user: { id: string } }) {
    return this.service.getByUser(req.user.id);
  }

  @Post('create-payment')
  @UseGuards(JwtAuthGuard)
  createPayment(
    @Request() req: { user: { id: string } },
    @Body() dto: CreatePaymentDto,
  ) {
    return this.service.createPayment(req.user.id, dto);
  }

  @Post('webhook')
  handleWebhook(@Body() dto: WebkassaWebhookDto) {
    return this.service.handleWebhook(dto);
  }
}
