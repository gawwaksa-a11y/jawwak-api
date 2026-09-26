import { MigrationInterface, QueryRunner } from "typeorm";

export class DualRatingSystem1790353604709 implements MigrationInterface {
    name = 'DualRatingSystem1790353604709'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "jawwak_reviews" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "vendorId" uuid NOT NULL, "reviewerName" character varying(100) NOT NULL, "visitDate" TIMESTAMP WITH TIME ZONE NOT NULL, "overallScore" numeric NOT NULL, "qualityScore" numeric NOT NULL, "serviceScore" numeric NOT NULL, "cleanlinessScore" numeric NOT NULL, "valueScore" numeric NOT NULL, "ambienceScore" numeric NOT NULL, "summary" text NOT NULL, "detailedReview" text NOT NULL, "prosTips" text, "consTips" text, "badges" text array NOT NULL, "images" text array NOT NULL, "isPublished" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7e55982160f1ba0eeaf785a1b20" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a477a09a726299f800b1d6a7f8" ON "jawwak_reviews" ("vendorId") `);
        await queryRunner.query(`CREATE TABLE "review_helpful_votes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "reviewId" uuid NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_35faec3acea971cc34ff179e836" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b6192e9ee897d9a9aa8d88c5bf" ON "review_helpful_votes" ("reviewId", "userId") `);
        await queryRunner.query(`CREATE TABLE "user_reviews" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "vendorId" uuid NOT NULL, "userId" uuid NOT NULL, "bookingId" uuid, "overallRating" numeric NOT NULL, "foodRating" numeric, "serviceRating" numeric, "ambienceRating" numeric, "valueRating" numeric, "experienceRating" numeric, "reviewText" text, "images" text array NOT NULL, "tags" text array NOT NULL, "isVerifiedVisit" boolean NOT NULL DEFAULT false, "helpfulCount" integer NOT NULL DEFAULT '0', "status" character varying(10) NOT NULL DEFAULT 'approved', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_24de027fbe1bf4d1c39817dc8da" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f67fc4bab2cf969d935e5a48c1" ON "user_reviews" ("bookingId") `);
        await queryRunner.query(`CREATE INDEX "IDX_02f4a781711b099656eaa733e1" ON "user_reviews" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0bcc328690eea7e9098d233d0b" ON "user_reviews" ("vendorId", "status") `);
        await queryRunner.query(`ALTER TABLE "vendors" ADD "avgFoodRating" numeric NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "vendors" ADD "avgServiceRating" numeric NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "vendors" ADD "avgAmbienceRating" numeric NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "vendors" ADD "avgValueRating" numeric NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "vendors" ADD "avgExperienceRating" numeric NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "vendors" ADD "ratingDistribution" jsonb`);
        await queryRunner.query(`ALTER TABLE "vendors" ADD "jawwakScore" numeric`);
        await queryRunner.query(`ALTER TABLE "vendors" ADD "hasJawwakReview" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "vendors" ADD "jawwakLastVisit" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "vendors" ADD "jawwakBadges" text array`);

        // ===== نقل التقييمات القديمة (reviews) إلى user_reviews =====
        // النظام القديم كان يشترط حجزاً مُستخدماً ⇒ كلها زيارات موثّقة.
        await queryRunner.query(`
            INSERT INTO "user_reviews"
                ("id", "vendorId", "userId", "bookingId", "overallRating", "reviewText",
                 "images", "tags", "isVerifiedVisit", "helpfulCount", "status", "createdAt", "updatedAt")
            SELECT "id", "vendorId", "userId", "bookingId", "rating", "comment",
                   '{}', '{}', true, 0, 'approved', "createdAt", "createdAt"
            FROM "reviews"`);
        // توزيع النجوم من التقييمات المنقولة (avgRating/ratingCount محسوبان مسبقاً منها).
        await queryRunner.query(`
            UPDATE "vendors" v SET "ratingDistribution" = (
                SELECT jsonb_build_object(
                    '1', COUNT(*) FILTER (WHERE floor(r."overallRating") = 1),
                    '2', COUNT(*) FILTER (WHERE floor(r."overallRating") = 2),
                    '3', COUNT(*) FILTER (WHERE floor(r."overallRating") = 3),
                    '4', COUNT(*) FILTER (WHERE floor(r."overallRating") = 4),
                    '5', COUNT(*) FILTER (WHERE floor(r."overallRating") = 5))
                FROM "user_reviews" r
                WHERE r."vendorId" = v."id" AND r."status" = 'approved')`);
        await queryRunner.query(`DROP INDEX "public"."IDX_12a0f887b44bb8a6107c02dbb0"`);
        await queryRunner.query(`DROP TABLE "reviews"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ===== استعادة جدول reviews القديم ونقل التقييمات المرتبطة بحجز =====
        await queryRunner.query(`CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "vendorId" uuid NOT NULL, "bookingId" uuid NOT NULL, "rating" integer NOT NULL, "comment" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_12a0f887b44bb8a6107c02dbb0" ON "reviews" ("vendorId") `);
        await queryRunner.query(`
            INSERT INTO "reviews" ("id", "userId", "vendorId", "bookingId", "rating", "comment", "createdAt")
            SELECT "id", "userId", "vendorId", "bookingId", round("overallRating")::int, "reviewText", "createdAt"
            FROM "user_reviews" WHERE "bookingId" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN "jawwakBadges"`);
        await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN "jawwakLastVisit"`);
        await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN "hasJawwakReview"`);
        await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN "jawwakScore"`);
        await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN "ratingDistribution"`);
        await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN "avgExperienceRating"`);
        await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN "avgValueRating"`);
        await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN "avgAmbienceRating"`);
        await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN "avgServiceRating"`);
        await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN "avgFoodRating"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0bcc328690eea7e9098d233d0b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_02f4a781711b099656eaa733e1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f67fc4bab2cf969d935e5a48c1"`);
        await queryRunner.query(`DROP TABLE "user_reviews"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b6192e9ee897d9a9aa8d88c5bf"`);
        await queryRunner.query(`DROP TABLE "review_helpful_votes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a477a09a726299f800b1d6a7f8"`);
        await queryRunner.query(`DROP TABLE "jawwak_reviews"`);
    }

}
