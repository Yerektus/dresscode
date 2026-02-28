import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCreditPackPricingToKzt20260227150000 implements MigrationInterface {
  name = 'UpdateCreditPackPricingToKzt20260227150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'credit_purchases'
            AND column_name = 'amount_usd_cents'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'credit_purchases'
            AND column_name = 'amount_kzt'
        ) THEN
          ALTER TABLE "credit_purchases"
          RENAME COLUMN "amount_usd_cents" TO "amount_kzt";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'credit_purchases'
            AND column_name = 'amount_kzt'
        ) THEN
          UPDATE "credit_purchases"
          SET "amount_kzt" = CASE
            WHEN "package_code" = 'credits_20' THEN 2000
            WHEN "package_code" = 'credits_50' THEN 5000
            WHEN "package_code" = 'credits_100' THEN 10000
            ELSE "amount_kzt"
          END;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'credit_purchases'
            AND column_name = 'amount_kzt'
        ) THEN
          UPDATE "credit_purchases"
          SET "amount_kzt" = CASE
            WHEN "package_code" = 'credits_20' THEN 200
            WHEN "package_code" = 'credits_50' THEN 300
            WHEN "package_code" = 'credits_100' THEN 600
            ELSE "amount_kzt"
          END;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'credit_purchases'
            AND column_name = 'amount_kzt'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'credit_purchases'
            AND column_name = 'amount_usd_cents'
        ) THEN
          ALTER TABLE "credit_purchases"
          RENAME COLUMN "amount_kzt" TO "amount_usd_cents";
        END IF;
      END $$;
    `);
  }
}
