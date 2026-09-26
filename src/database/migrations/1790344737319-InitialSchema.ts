import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1790344737319 implements MigrationInterface {
    name = 'InitialSchema1790344737319'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "vendorId" uuid NOT NULL, "moodSessionId" uuid, "status" character varying(12) NOT NULL DEFAULT 'pending', "paymentMethod" character varying(12) NOT NULL, "amount" numeric NOT NULL DEFAULT '0', "discountPct" numeric NOT NULL DEFAULT '0', "qrCode" text, "qrScannedAt" TIMESTAMP WITH TIME ZONE, "checkoutId" text, "transactionId" text, "paymentBrand" character varying(30), "paymentResultCode" character varying(20), "paidAt" TIMESTAMP WITH TIME ZONE, "rating" integer, "reviewText" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7d895a3f015624351717b1ef0a" ON "bookings" ("status", "expiresAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_22dc9459ddb58ff370f5a8f48f" ON "bookings" ("vendorId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_38a69a58a323647f2e75eb994d" ON "bookings" ("userId") `);
        await queryRunner.query(`CREATE TABLE "mood_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "companion" character varying(10) NOT NULL, "mood" character varying(12) NOT NULL, "budgetMin" integer NOT NULL, "budgetMax" integer NOT NULL, "timeSlot" character varying(12) NOT NULL, "userLat" double precision NOT NULL, "userLng" double precision NOT NULL, "results" text array, "selectedVendorId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_999b3b9de7f3a111b39d69c05d1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6388f3ec3543edfc4939cdc407" ON "mood_sessions" ("userId") `);
        await queryRunner.query(`CREATE TABLE "offers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "vendorId" uuid NOT NULL, "title" character varying(120) NOT NULL, "discountPct" integer NOT NULL, "startDate" TIMESTAMP WITH TIME ZONE NOT NULL, "endDate" TIMESTAMP WITH TIME ZONE NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4c88e956195bba85977da21b8f4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_efe1342c6c4c5827074d16e8a1" ON "offers" ("vendorId") `);
        await queryRunner.query(`CREATE TABLE "points_ledger" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "points" integer NOT NULL, "reason" character varying(12) NOT NULL, "referenceId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1894c07f712716bfe637e82cc05" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_51982aa6ef701ae3c011509d2f" ON "points_ledger" ("userId") `);
        await queryRunner.query(`CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "vendorId" uuid NOT NULL, "bookingId" uuid NOT NULL, "rating" integer NOT NULL, "comment" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_12a0f887b44bb8a6107c02dbb0" ON "reviews" ("vendorId") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "phone" character varying(15) NOT NULL, "displayName" character varying(100) NOT NULL, "avatarUrl" text, "locale" character varying(5) NOT NULL DEFAULT 'ar', "points" integer NOT NULL DEFAULT '0', "tier" character varying(10) NOT NULL DEFAULT 'bronze', "deviceToken" text, "firebaseUid" character varying, "deletedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "lastActiveAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e621f267079194e5428e19af2f" ON "users" ("firebaseUid") `);
        await queryRunner.query(`CREATE TABLE "vendors" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "ownerUserId" uuid NOT NULL, "businessNameAr" character varying(200) NOT NULL, "businessNameEn" character varying(200) NOT NULL, "category" character varying(20) NOT NULL, "lat" double precision NOT NULL, "lng" double precision NOT NULL, "addressText" text NOT NULL, "priceRange" character varying(20) NOT NULL, "moodTags" text array NOT NULL, "companionTags" text array NOT NULL, "verified" boolean NOT NULL DEFAULT false, "avgRating" numeric NOT NULL DEFAULT '0', "ratingCount" integer NOT NULL DEFAULT '0', "operatingHours" jsonb, "images" text array NOT NULL, "crNumber" character varying(20), "contractSignedAt" TIMESTAMP WITH TIME ZONE, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9c956c9797edfae5c6ddacc4e6e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_53b4faa79665b59d2d4040666d" ON "vendors" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5e75e686dcd964c52fbeb8330" ON "vendors" ("ownerUserId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f5e75e686dcd964c52fbeb8330"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_53b4faa79665b59d2d4040666d"`);
        await queryRunner.query(`DROP TABLE "vendors"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e621f267079194e5428e19af2f"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_12a0f887b44bb8a6107c02dbb0"`);
        await queryRunner.query(`DROP TABLE "reviews"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_51982aa6ef701ae3c011509d2f"`);
        await queryRunner.query(`DROP TABLE "points_ledger"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_efe1342c6c4c5827074d16e8a1"`);
        await queryRunner.query(`DROP TABLE "offers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6388f3ec3543edfc4939cdc407"`);
        await queryRunner.query(`DROP TABLE "mood_sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_38a69a58a323647f2e75eb994d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_22dc9459ddb58ff370f5a8f48f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7d895a3f015624351717b1ef0a"`);
        await queryRunner.query(`DROP TABLE "bookings"`);
    }

}
