import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { BodyProfile } from '../entities/body-profile.entity';
import { MannequinVersion } from '../entities/mannequin-version.entity';
import { TryOnRequest } from '../entities/try-on-request.entity';
import { TryOnResult } from '../entities/try-on-result.entity';
import { Subscription } from '../entities/subscription.entity';
import { CreditPurchase } from '../entities/credit-purchase.entity';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'dresscode',
  entities: [
    User,
    BodyProfile,
    MannequinVersion,
    TryOnRequest,
    TryOnResult,
    Subscription,
    CreditPurchase,
    EmailVerificationToken,
  ],
  migrations: ['src/database/migrations/*.ts'],
});
