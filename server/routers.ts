import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "./trpc";
import * as db from "./db";

// ─── Helpers ───────────────────────────────────────────────────────────────
async function assertFarmOwner(farmId: number, userId: number) {
  const farm = await db.getFarmById(farmId);
  if (!farm || farm.ownerId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
  return farm;
}
async function assertReviewOwner(reviewId: number, userId: number) {
  const review = await db.getReviewById(reviewId);
  if (!review) throw new TRPCError({ code: "NOT_FOUND" });
  await assertFarmOwner(review.farmId, userId);
  return review;
}
async function assertCropOwner(cropId: number, userId: number) {
  const crop = await db.getCropById(cropId);
  if (!crop) throw new TRPCError({ code: "NOT_FOUND" });
  await assertFarmOwner(crop.farmId, userId);
  return crop;
}
async function assertActivityOwner(id: number, userId: number) {
  const a = await db.getActivityById(id);
  if (!a) throw new TRPCError({ code: "NOT_FOUND" });
  await assertFarmOwner(a.farmId, userId);
  return a;
}
async function assertTaskOwner(id: number, userId: number) {
  const t = await db.getTaskById(id);
  if (!t) throw new TRPCError({ code: "NOT_FOUND" });
  await assertFarmOwner(t.farmId, userId);
  return t;
}

const date = z.coerce.date();
const cropStatus = z.enum(["activo", "completado", "archivado"]);
const activityType = z.enum(["labor", "aplicacion", "riego", "cosecha", "mantenimiento", "otro"]);
const priority = z.enum(["baja", "media", "alta"]);

export const appRouter = router({

  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: protectedProcedure.mutation(({ ctx }) => {
      ctx.res.setHeader("Set-Cookie", "agrivisit_session=; Max-Age=-1; Path=/");
      return { success: true };
    }),
    updateProfile: protectedProcedure
      .input(z.object({ companyName: z.string().optional(), companyLogo: z.string().optional() }))
      .mutation(({ input, ctx }) => db.updateUserProfile(ctx.user.id, input)),
  }),

  farms: router({
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional(), location: z.string().optional(), totalHectares: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional() }))
      .mutation(({ input, ctx }) => db.createFarm({ ...input, ownerId: ctx.user.id, totalHectares: input.totalHectares, latitude: input.latitude?.toString(), longitude: input.longitude?.toString() })),

    list: protectedProcedure.query(({ ctx }) => db.getFarmsByOwnerId(ctx.user.id)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input, ctx }) => assertFarmOwner(input.id, ctx.user.id)),

    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional(), location: z.string().optional(), totalHectares: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        await assertFarmOwner(input.id, ctx.user.id);
        const { id, latitude, longitude, ...data } = input;
        return db.updateFarm(id, { ...data, latitude: latitude?.toString(), longitude: longitude?.toString() });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => { await assertFarmOwner(input.id, ctx.user.id); return db.deleteFarm(input.id); }),
  }),

  crops: router({
    create: protectedProcedure
      .input(z.object({ farmId: z.number(), species: z.string().min(1), variety: z.string().optional(), plantingYear: z.number().int(), harvestYear: z.number().int().optional(), surface: z.string().optional(), plantingDate: date.optional(), harvestDate: date.optional(), expectedProduction: z.string().optional(), actualProduction: z.string().optional(), productionUnit: z.string().optional(), irrigationType: z.string().optional(), soilType: z.string().optional(), fertilizer: z.string().optional(), pesticides: z.string().optional(), notes: z.string().optional(), status: cropStatus.optional() }))
      .mutation(async ({ input, ctx }) => { await assertFarmOwner(input.farmId, ctx.user.id); return db.createCrop(input); }),

    listByFarm: protectedProcedure
      .input(z.object({ farmId: z.number() }))
      .query(async ({ input, ctx }) => { await assertFarmOwner(input.farmId, ctx.user.id); return db.getCropsByFarmId(input.farmId); }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input, ctx }) => assertCropOwner(input.id, ctx.user.id)),

    update: protectedProcedure
      .input(z.object({ id: z.number(), species: z.string().optional(), variety: z.string().optional(), plantingYear: z.number().int().optional(), harvestYear: z.number().int().optional(), surface: z.string().optional(), plantingDate: date.optional(), harvestDate: date.optional(), expectedProduction: z.string().optional(), actualProduction: z.string().optional(), productionUnit: z.string().optional(), irrigationType: z.string().optional(), soilType: z.string().optional(), fertilizer: z.string().optional(), pesticides: z.string().optional(), notes: z.string().optional(), status: cropStatus.optional() }))
      .mutation(async ({ input, ctx }) => { await assertCropOwner(input.id, ctx.user.id); const { id, ...data } = input; return db.updateCrop(id, data); }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => { await assertCropOwner(input.id, ctx.user.id); return db.deleteCrop(input.id); }),
  }),

  reviews: router({
    create: protectedProcedure
      .input(z.object({ farmId: z.number(), cropStatus: z.string().optional(), infrastructure: z.string().optional(), supplies: z.string().optional(), generalObservations: z.string().optional(), recommendations: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional(), visitDate: date.optional() }))
      .mutation(async ({ input, ctx }) => { await assertFarmOwner(input.farmId, ctx.user.id); return db.createReview({ ...input, technicianId: ctx.user.id, latitude: input.latitude?.toString(), longitude: input.longitude?.toString() }); }),

    listByFarm: protectedProcedure
      .input(z.object({ farmId: z.number() }))
      .query(async ({ input, ctx }) => { await assertFarmOwner(input.farmId, ctx.user.id); return db.getReviewsByFarmId(input.farmId); }),

    allReviews: protectedProcedure.query(async ({ ctx }) => {
      const farms = await db.getFarmsByOwnerId(ctx.user.id);
      const results = await Promise.all(farms.map(f => db.getReviewsByFarmId(f.id)));
      return results.flat();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input, ctx }) => assertReviewOwner(input.id, ctx.user.id)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => { await assertReviewOwner(input.id, ctx.user.id); return db.deleteReview(input.id); }),
  }),

  activities: router({
    create: protectedProcedure
      .input(z.object({ farmId: z.number(), activityType, description: z.string().min(1), activityDate: date, responsibleId: z.number().optional(), isCompleted: z.boolean().optional(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => { await assertFarmOwner(input.farmId, ctx.user.id); return db.createActivity(input); }),

    listByFarm: protectedProcedure
      .input(z.object({ farmId: z.number() }))
      .query(async ({ input, ctx }) => { await assertFarmOwner(input.farmId, ctx.user.id); return db.getActivitiesByFarmId(input.farmId); }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), isCompleted: z.boolean().optional(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => { await assertActivityOwner(input.id, ctx.user.id); const { id, ...data } = input; return db.updateActivity(id, data); }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => { await assertActivityOwner(input.id, ctx.user.id); return db.deleteActivity(input.id); }),
  }),

  tasks: router({
    create: protectedProcedure
      .input(z.object({ farmId: z.number(), title: z.string().min(1), description: z.string().optional(), dueDate: date, assignedToId: z.number().optional(), priority: priority.optional() }))
      .mutation(async ({ input, ctx }) => { await assertFarmOwner(input.farmId, ctx.user.id); return db.createTask({ ...input, createdById: ctx.user.id }); }),

    listByFarm: protectedProcedure
      .input(z.object({ farmId: z.number() }))
      .query(async ({ input, ctx }) => { await assertFarmOwner(input.farmId, ctx.user.id); return db.getTasksByFarmId(input.farmId); }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), isCompleted: z.boolean().optional(), priority: priority.optional() }))
      .mutation(async ({ input, ctx }) => { await assertTaskOwner(input.id, ctx.user.id); const { id, ...data } = input; return db.updateTask(id, data); }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => { await assertTaskOwner(input.id, ctx.user.id); return db.deleteTask(input.id); }),
  }),

  cropAttachments: router({
    upload: protectedProcedure
      .input(z.object({ cropId: z.number(), fileName: z.string(), fileUrl: z.string().url(), fileType: z.string(), fileSize: z.number().optional(), attachmentType: z.enum(["analisis_suelo","foto_crecimiento","registro_plagas","registro_fertilizante","registro_riego","registro_cosecha","otro"]).optional(), description: z.string().optional() }))
      .mutation(async ({ input, ctx }) => { await assertCropOwner(input.cropId, ctx.user.id); return db.createCropAttachment(input); }),

    listByCrop: protectedProcedure
      .input(z.object({ cropId: z.number() }))
      .query(async ({ input, ctx }) => { await assertCropOwner(input.cropId, ctx.user.id); return db.getCropAttachmentsByCropId(input.cropId); }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const att = await db.getCropAttachmentById(input.id);
        if (!att) throw new TRPCError({ code: "NOT_FOUND" });
        await assertCropOwner(att.cropId, ctx.user.id);
        return db.deleteCropAttachment(input.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
