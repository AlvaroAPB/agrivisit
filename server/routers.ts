import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "./trpc";
import * as db from "./db";
import { v2 as cloudinary } from "cloudinary";

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
async function assertParcelOwner(id: number, userId: number) {
  const p = await db.getParcelById(id);
  if (!p) throw new TRPCError({ code: "NOT_FOUND" });
  await assertFarmOwner(p.farmId, userId);
  return p;
}

const date = z.coerce.date();
const cropStatus = z.enum(["activo", "completado", "archivado"]);
const activityType = z.enum(["labor", "aplicacion", "riego", "cosecha", "mantenimiento", "otro"]);
const priority = z.enum(["baja", "media", "alta"]);

// ─── Cloudinary config ─────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

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

  parcels: router({
    create: protectedProcedure
      .input(z.object({
        farmId: z.number(),
        name: z.string().min(1),
        surface: z.string().optional(),
        especie: z.string().optional(),
        variedad: z.string().optional(),
        anyoPlantacion: z.number().int().optional(),
        anyoProduccion: z.number().int().optional(),
        distLineas: z.string().optional(),
        distPlantas: z.string().optional(),
        densidad: z.number().int().optional(),
        conduccion: z.string().optional(),
        portainjerto: z.string().optional(),
        nPlantas: z.number().int().optional(),
        tipoSuelo: z.string().optional(),
        ph: z.string().optional(),
        materiaOrganica: z.string().optional(),
        ce: z.string().optional(),
        polygon: z.string().optional(),
        centerLat: z.number().optional(),
        centerLng: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertFarmOwner(input.farmId, ctx.user.id);
        const { centerLat, centerLng, ...rest } = input;
        return db.createParcel({
          ...rest,
          centerLat: centerLat?.toString(),
          centerLng: centerLng?.toString(),
        });
      }),

    listByFarm: protectedProcedure
      .input(z.object({ farmId: z.number() }))
      .query(async ({ input, ctx }) => {
        await assertFarmOwner(input.farmId, ctx.user.id);
        return db.getParcelsByFarmId(input.farmId);
      }),

    listAll: protectedProcedure.query(({ ctx }) => db.getAllParcelsByOwner(ctx.user.id)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input, ctx }) => assertParcelOwner(input.id, ctx.user.id)),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        surface: z.string().optional(),
        especie: z.string().optional(),
        variedad: z.string().optional(),
        anyoPlantacion: z.number().int().optional(),
        anyoProduccion: z.number().int().optional(),
        distLineas: z.string().optional(),
        distPlantas: z.string().optional(),
        densidad: z.number().int().optional(),
        conduccion: z.string().optional(),
        portainjerto: z.string().optional(),
        nPlantas: z.number().int().optional(),
        tipoSuelo: z.string().optional(),
        ph: z.string().optional(),
        materiaOrganica: z.string().optional(),
        ce: z.string().optional(),
        polygon: z.string().optional(),
        centerLat: z.number().optional(),
        centerLng: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertParcelOwner(input.id, ctx.user.id);
        const { id, centerLat, centerLng, ...data } = input;
        return db.updateParcel(id, {
          ...data,
          centerLat: centerLat?.toString(),
          centerLng: centerLng?.toString(),
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await assertParcelOwner(input.id, ctx.user.id);
        return db.deleteParcel(input.id);
      }),

    // Migración one-shot: para cada finca del usuario sin parcelas,
    // crea una parcela inicial con los datos del JSON description de la finca.
    migrateFromFarmJSON: protectedProcedure.mutation(async ({ ctx }) => {
      const userFarms = await db.getFarmsByOwnerId(ctx.user.id);
      let created = 0;
      for (const farm of userFarms) {
        const existing = await db.getParcelsByFarmId(farm.id);
        if (existing.length > 0) continue;

        let extra: any = {};
        try { extra = JSON.parse(farm.description || "{}"); } catch {}

        await db.createParcel({
          farmId: farm.id,
          name: extra.variedad ? `Parcela ${extra.variedad}` : "Parcela 1",
          surface: extra.superficie ? String(extra.superficie) : (farm.totalHectares ? String(farm.totalHectares) : undefined),
          especie: extra.especie || undefined,
          variedad: extra.variedad || undefined,
          anyoPlantacion: extra.anyoPlantacion ? parseInt(extra.anyoPlantacion) : undefined,
          anyoProduccion: extra.anyoProduccion ? parseInt(extra.anyoProduccion) : undefined,
          distLineas: extra.distLineas || undefined,
          distPlantas: extra.distPlantas || undefined,
          densidad: extra.densidad ? parseInt(extra.densidad) : undefined,
          conduccion: extra.conduccion || undefined,
          portainjerto: extra.portainjerto || undefined,
          nPlantas: extra.nPlantas ? parseInt(extra.nPlantas) : undefined,
          tipoSuelo: extra.tipoSuelo || undefined,
          ph: extra.ph || undefined,
          materiaOrganica: extra.materiaOrganica || undefined,
          polygon: extra.polygon ? JSON.stringify(extra.polygon) : undefined,
          centerLat: farm.latitude ? String(farm.latitude) : undefined,
          centerLng: farm.longitude ? String(farm.longitude) : undefined,
        });
        created++;
      }
      return { created, totalFarms: userFarms.length };
    }),
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

    listAll: protectedProcedure.query(async ({ ctx }) => db.getAllTasksByOwner(ctx.user.id)),

    update: protectedProcedure
      .input(z.object({ id: z.number(), title: z.string().optional(), description: z.string().optional(), dueDate: date.optional(), isCompleted: z.boolean().optional(), priority: priority.optional() }))
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

  // ── Predicción de cosecha ────────────────────────────────────────────────
  prediction: router({
    predictFarm: protectedProcedure
      .input(z.object({
        farmId: z.number(),
        year: z.number().int().optional(),
      }))
      .query(async ({ input, ctx }) => {
        await assertFarmOwner(input.farmId, ctx.user.id);
        const farm = await db.getFarmById(input.farmId);
        if (!farm) throw new TRPCError({ code: "NOT_FOUND" });

        // Parcelas de la finca
        const parcelas = await db.getParcelsByFarmId(input.farmId);
        let extra: any = {};
        try { extra = JSON.parse(farm.description || "{}"); } catch {}

        // Clima actual (Open-Meteo, último año agrícola)
        const now = new Date();
        const startDate = `${now.getFullYear() - 1}-10-01`;
        const endDate = `${now.getFullYear()}-03-31`;
        let clima = { chillPortions: 30, tmean: 15, totalPrecipitation: 400, frostDays: 2 };
        if (farm.latitude && farm.longitude) {
          try {
            const { buildClimateSummary } = await import("./climate");
            const c = await buildClimateSummary(parseFloat(farm.latitude), parseFloat(farm.longitude), startDate, endDate);
            clima = {
              chillPortions: c.chillPortions,
              tmean: c.monthlyStats.reduce((a: number, b: any) => a + b.tmean, 0) / Math.max(c.monthlyStats.length, 1),
              totalPrecipitation: c.monthlyStats.reduce((a: number, b: any) => a + b.precipitation, 0),
              frostDays: c.frostRisk.totalFrostDays,
            };
          } catch {}
        }

        // Histórico de campañas
        const campaigns = await db.getCampaignsByFarmId(input.farmId);
        const historico = campaigns.map((c: any) => ({
          year: c.year,
          variety: c.variety,
          yieldKgHa: c.yieldKgHa ? parseFloat(c.yieldKgHa) : undefined,
          totalYieldKg: c.totalYieldKg ? parseFloat(c.totalYieldKg) : undefined,
          chillPortions: c.chillPortions ? parseFloat(c.chillPortions) : undefined,
          frostEvents: c.frostEvents || 0,
          pestPressure: c.pestPressure,
        }));

        const { predecirCosechaFinca } = await import("./prediction");
        return predecirCosechaFinca(
          {
            id: farm.id,
            name: farm.name,
            location: farm.location || "",
            dotacionAgua: extra.dotacionAgua ? parseFloat(extra.dotacionAgua) : undefined,
            irrigationType: extra.irrigationType,
            latitude: farm.latitude ? parseFloat(farm.latitude) : undefined,
            longitude: farm.longitude ? parseFloat(farm.longitude) : undefined,
            parcelas: parcelas.map((p: any) => ({
              id: p.id,
              name: p.name,
              especie: p.especie || extra.especie || "",
              variedad: p.variedad || extra.variedad || "",
              surface: p.surface ? parseFloat(p.surface) : 0,
              anyoPlantacion: p.anyoPlantacion || (extra.anyoPlantacion ? parseInt(extra.anyoPlantacion) : undefined),
              anyoProduccion: p.anyoProduccion,
              densidad: p.densidad,
              ph: p.ph ? parseFloat(p.ph) : (extra.ph ? parseFloat(extra.ph) : undefined),
              ce: p.ce ? parseFloat(p.ce) : undefined,
              materiaOrganica: p.materiaOrganica ? parseFloat(p.materiaOrganica) : undefined,
            })),
          },
          clima,
          historico,
          input.year || now.getFullYear()
        );
      }),

    predictAll: protectedProcedure.query(async ({ ctx }) => {
      const farms = await db.getFarmsByOwnerId(ctx.user.id);
      const results = [];
      for (const farm of farms) {
        try {
          const parcelas = await db.getParcelsByFarmId(farm.id);
          if (parcelas.length === 0) continue;
          let extra: any = {};
          try { extra = JSON.parse(farm.description || "{}"); } catch {}
          const campaigns = await db.getCampaignsByFarmId(farm.id);
          const historico = campaigns.map((c: any) => ({
            year: c.year, variety: c.variety,
            yieldKgHa: c.yieldKgHa ? parseFloat(c.yieldKgHa) : undefined,
            totalYieldKg: c.totalYieldKg ? parseFloat(c.totalYieldKg) : undefined,
          }));
          const { predecirCosechaFinca } = await import("./prediction");
          const pred = predecirCosechaFinca(
            {
              id: farm.id, name: farm.name, location: farm.location || "",
              dotacionAgua: extra.dotacionAgua ? parseFloat(extra.dotacionAgua) : undefined,
              irrigationType: extra.irrigationType,
              parcelas: parcelas.map((p: any) => ({
                id: p.id, name: p.name,
                especie: p.especie || extra.especie || "",
                variedad: p.variedad || extra.variedad || "",
                surface: p.surface ? parseFloat(p.surface) : 0,
                anyoPlantacion: p.anyoPlantacion,
                anyoProduccion: p.anyoProduccion,
                ph: p.ph ? parseFloat(p.ph) : undefined,
              })),
            },
            { chillPortions: 30, tmean: 15, totalPrecipitation: 400, frostDays: 0 },
            historico
          );
          results.push({ farmId: farm.id, farmName: farm.name, totalToneladas: pred.totalToneladas, rendimientoMedioKgHa: pred.rendimientoMedioKgHa, superficieTotalHa: pred.superficieTotalHa });
        } catch {}
      }
      return results;
    }),
  }),

  climate: router({
    getFarmClimate: protectedProcedure
      .input(z.object({
        farmId: z.number(),
        startDate: z.string(), // YYYY-MM-DD
        endDate: z.string(),
        gddStartDate: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        await assertFarmOwner(input.farmId, ctx.user.id);
        const farm = await db.getFarmById(input.farmId);
        if (!farm || !farm.latitude || !farm.longitude) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "La finca no tiene coordenadas GPS" });
        }
        const { buildClimateSummary } = await import("./climate");
        return buildClimateSummary(
          parseFloat(farm.latitude),
          parseFloat(farm.longitude),
          input.startDate,
          input.endDate,
          input.gddStartDate
        );
      }),

    compareFarms: protectedProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        const farms = await db.getFarmsByOwnerId(ctx.user.id);
        const farmsWithCoords = farms.filter(f => f.latitude && f.longitude);
        const { buildClimateSummary } = await import("./climate");

        const results = await Promise.all(
          farmsWithCoords.map(async (farm) => {
            try {
              const climate = await buildClimateSummary(
                parseFloat(farm.latitude!),
                parseFloat(farm.longitude!),
                input.startDate,
                input.endDate,
              );
              let extra: any = {};
              try { extra = JSON.parse(farm.description || "{}"); } catch {}
              return {
                farmId: farm.id,
                farmName: farm.name,
                location: farm.location,
                especie: extra.especie,
                variedad: extra.variedad,
                requerimientoFrio: extra.requerimientoFrio ? parseFloat(extra.requerimientoFrio) : null,
                chillPortions: climate.chillPortions,
                chillHours: climate.chillHours,
                tmean: climate.monthlyStats.length > 0
                  ? Math.round((climate.monthlyStats.reduce((a, b) => a + b.tmean, 0) / climate.monthlyStats.length) * 10) / 10
                  : 0,
                totalPrecipitation: climate.monthlyStats.reduce((a, b) => a + b.precipitation, 0),
                frostDays: climate.frostRisk.totalFrostDays,
              };
            } catch (e) {
              return null;
            }
          })
        );
        return results.filter(r => r !== null);
      }),
  }),

  campaigns: router({
    listByFarm: protectedProcedure
      .input(z.object({ farmId: z.number() }))
      .query(async ({ input, ctx }) => {
        await assertFarmOwner(input.farmId, ctx.user.id);
        return db.getCampaignsByFarmId(input.farmId);
      }),

    listAll: protectedProcedure.query(({ ctx }) => db.getAllCampaigns(ctx.user.id)),

    create: protectedProcedure
      .input(z.object({
        farmId: z.number(),
        year: z.number().int(),
        variety: z.string().optional(),
        bloomDate: z.coerce.date().optional(),
        harvestStartDate: z.coerce.date().optional(),
        harvestEndDate: z.coerce.date().optional(),
        chillPortions: z.string().optional(),
        gddBloomToHarvest: z.string().optional(),
        yieldKgHa: z.string().optional(),
        totalYieldKg: z.string().optional(),
        meanCaliberMm: z.string().optional(),
        caliberCategory: z.string().optional(),
        brixDegrees: z.string().optional(),
        commercialCategory: z.string().optional(),
        frostEvents: z.number().int().optional(),
        heatStressEvents: z.number().int().optional(),
        hailEvent: z.boolean().optional(),
        pestPressure: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertFarmOwner(input.farmId, ctx.user.id);
        return db.createCampaign(input);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const c = await db.getCampaignById(input.id);
        if (!c) throw new TRPCError({ code: "NOT_FOUND" });
        await assertFarmOwner(c.farmId, ctx.user.id);
        return db.deleteCampaign(input.id);
      }),

    generateSynthetic: protectedProcedure
      .input(z.object({
        years: z.array(z.number().int()),
        clearExisting: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const farms = await db.getFarmsByOwnerId(ctx.user.id);
        const { generateSyntheticCampaign, VARIETIES } = await import("./syntheticData");

        const created: any[] = [];
        const errors: string[] = [];

        for (const farm of farms) {
          if (!farm.latitude || !farm.longitude) continue;

          let extra: any = {};
          try { extra = JSON.parse(farm.description || "{}"); } catch {}

          let variety = extra.variedad;
          const profileExists = variety && VARIETIES.find(v => v.name.toLowerCase() === variety.toLowerCase());
          if (!profileExists) {
            const speciesMatch = VARIETIES.find(v => v.species === extra.especie);
            variety = speciesMatch?.name ?? VARIETIES[0].name;
          }

          if (input.clearExisting) {
            await db.deleteAllCampaignsByFarm(farm.id);
          }

          for (const year of input.years) {
            try {
              const campaign = await generateSyntheticCampaign({
                farmId: farm.id,
                lat: parseFloat(farm.latitude),
                lng: parseFloat(farm.longitude),
                variety,
                surface: parseFloat(extra.superficie || farm.totalHectares || "10"),
                density: parseFloat(extra.densidad || "1500"),
                plantingYear: parseInt(extra.anyoPlantacion || "2015"),
              }, year);

              if (campaign) {
                const inserted = await db.createCampaign(campaign);
                created.push(inserted);
              }
            } catch (e: any) {
              errors.push(`Finca ${farm.name} año ${year}: ${e.message}`);
            }
          }
        }

        return { created: created.length, errors };
      }),

    listVarieties: protectedProcedure.query(async () => {
      const { VARIETIES } = await import("./syntheticData");
      return VARIETIES;
    }),

    validateModel: protectedProcedure.query(async ({ ctx }) => {
      const allCampaigns = await db.getAllCampaigns(ctx.user.id);

      if (allCampaigns.length === 0) {
        return { campaigns: 0, byVariety: [], correlations: { frostVsYield: 0, heatVsYield: 0, cpVsYield: 0 }, summary: null };
      }

      const byVariety = new Map<string, any[]>();
      for (const c of allCampaigns) {
        const v = c.variety || "sin variedad";
        if (!byVariety.has(v)) byVariety.set(v, []);
        byVariety.get(v)!.push(c);
      }

      const varietyStats = Array.from(byVariety.entries()).map(([variety, campaigns]) => {
        const yields = campaigns.map(c => parseFloat(c.yieldKgHa || "0"));
        const calibers = campaigns.map(c => parseFloat(c.meanCaliberMm || "0"));
        const brixes = campaigns.map(c => parseFloat(c.brixDegrees || "0"));
        const cps = campaigns.map(c => parseFloat(c.chillPortions || "0"));

        const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const std = (arr: number[]) => {
          const m = mean(arr);
          return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
        };

        return {
          variety,
          n: campaigns.length,
          yieldMean: Math.round(mean(yields)),
          yieldStd: Math.round(std(yields)),
          caliberMean: Math.round(mean(calibers) * 10) / 10,
          brixMean: Math.round(mean(brixes) * 10) / 10,
          cpMean: Math.round(mean(cps) * 10) / 10,
        };
      });

      const yields = allCampaigns.map(c => parseFloat(c.yieldKgHa || "0"));
      const frostEvents = allCampaigns.map(c => c.frostEvents || 0);
      const heatEvents = allCampaigns.map(c => c.heatStressEvents || 0);
      const cps = allCampaigns.map(c => parseFloat(c.chillPortions || "0"));

      const pearson = (x: number[], y: number[]) => {
        const n = x.length;
        if (n < 2) return 0;
        const mx = x.reduce((a, b) => a + b, 0) / n;
        const my = y.reduce((a, b) => a + b, 0) / n;
        let num = 0, dx = 0, dy = 0;
        for (let i = 0; i < n; i++) {
          num += (x[i] - mx) * (y[i] - my);
          dx += (x[i] - mx) ** 2;
          dy += (y[i] - my) ** 2;
        }
        const denom = Math.sqrt(dx * dy);
        return denom === 0 ? 0 : Math.round((num / denom) * 1000) / 1000;
      };

      return {
        campaigns: allCampaigns.length,
        byVariety: varietyStats,
        correlations: {
          frostVsYield: pearson(frostEvents, yields),
          heatVsYield: pearson(heatEvents, yields),
          cpVsYield: pearson(cps, yields),
        },
        summary: {
          totalCampaigns: allCampaigns.length,
          totalProductionKg: Math.round(allCampaigns.reduce((a, c) => a + parseFloat(c.totalYieldKg || "0"), 0)),
          meanYieldKgHa: Math.round(yields.reduce((a, b) => a + b, 0) / yields.length),
          frostAffectedCampaigns: allCampaigns.filter(c => (c.frostEvents || 0) > 0).length,
          hailAffectedCampaigns: allCampaigns.filter(c => c.hailEvent).length,
        },
      };
    }),
  }),

  visitReports: router({
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        dateStart: z.coerce.date(),
        dateEnd: z.coerce.date(),
        internalNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createVisitReport({ ...input, technicianId: ctx.user.id, status: "borrador" });
      }),

    list: protectedProcedure.query(({ ctx }) => db.getVisitReportsByOwner(ctx.user.id)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const report = await db.getVisitReportById(input.id);
        if (!report || report.technicianId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return report;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        dateStart: z.coerce.date().optional(),
        dateEnd: z.coerce.date().optional(),
        status: z.enum(["borrador", "finalizado"]).optional(),
        internalNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const report = await db.getVisitReportById(id);
        if (!report || report.technicianId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        return db.updateVisitReport(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const report = await db.getVisitReportById(input.id);
        if (!report || report.technicianId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        return db.deleteVisitReport(input.id);
      }),

    // Entradas de visita
    addEntry: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        farmId: z.number(),
        parcelId: z.number().optional(),
        visitDate: z.coerce.date(),
        estadoFenologico: z.string().optional(),
        semanasDesdeFlor: z.number().int().optional(),
        vigorVegetativo: z.number().int().min(1).max(5).optional(),
        colorFoliaje: z.number().int().min(1).max(5).optional(),
        estadoSanitario: z.number().int().min(1).max(5).optional(),
        estadoRiego: z.number().int().min(1).max(5).optional(),
        plagasDetectadas: z.string().optional(),
        enfermedadesDetectadas: z.string().optional(),
        presionFitosanitaria: z.enum(["baja", "media", "alta", "crítica"]).optional(),
        brixGrados: z.string().optional(),
        calibreMm: z.string().optional(),
        firmezaKg: z.string().optional(),
        porcentajeColor: z.number().int().min(0).max(100).optional(),
        pesoMedioBaya: z.string().optional(),
        tareasRealizadas: z.string().optional(),
        observaciones: z.string().optional(),
        recomendaciones: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const report = await db.getVisitReportById(input.reportId);
        if (!report || report.technicianId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await assertFarmOwner(input.farmId, ctx.user.id);
        const { latitude, longitude, ...rest } = input;
        return db.createVisitEntry({
          ...rest,
          latitude: latitude?.toString(),
          longitude: longitude?.toString(),
        });
      }),

    getEntries: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ input, ctx }) => {
        const report = await db.getVisitReportById(input.reportId);
        if (!report || report.technicianId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        return db.getVisitEntriesByReport(input.reportId);
      }),

    updateEntry: protectedProcedure
      .input(z.object({
        id: z.number(),
        estadoFenologico: z.string().optional(),
        semanasDesdeFlor: z.number().int().optional(),
        vigorVegetativo: z.number().int().min(1).max(5).optional(),
        colorFoliaje: z.number().int().min(1).max(5).optional(),
        estadoSanitario: z.number().int().min(1).max(5).optional(),
        estadoRiego: z.number().int().min(1).max(5).optional(),
        plagasDetectadas: z.string().optional(),
        enfermedadesDetectadas: z.string().optional(),
        presionFitosanitaria: z.enum(["baja", "media", "alta", "crítica"]).optional(),
        brixGrados: z.string().optional(),
        calibreMm: z.string().optional(),
        firmezaKg: z.string().optional(),
        porcentajeColor: z.number().int().min(0).max(100).optional(),
        pesoMedioBaya: z.string().optional(),
        tareasRealizadas: z.string().optional(),
        observaciones: z.string().optional(),
        recomendaciones: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        return db.updateVisitEntry(id, data);
      }),

    deleteEntry: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => db.deleteVisitEntry(input.id)),

    // Histórico de una parcela o finca para gráfica de evolución
    historicoParcela: protectedProcedure
      .input(z.object({ farmId: z.number(), parcelId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        await assertFarmOwner(input.farmId, ctx.user.id);
        return db.getVisitEntriesHistorico(input.farmId, input.parcelId);
      }),

    // Todas las entradas del usuario para vista global de Revisiones
    allEntries: protectedProcedure.query(async ({ ctx }) => db.getAllVisitEntriesByOwner(ctx.user.id)),
  }),

  // ── Fotos de visita (upload firmado con Cloudinary) ──────────────────────
  visitPhotos: router({
    // 1. El cliente pide una firma al servidor
    signUpload: protectedProcedure
      .input(z.object({ entryId: z.number(), folder: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const timestamp = Math.round(Date.now() / 1000);
        const folder = input.folder || `agrivisit/visitas`;
        const paramsToSign: Record<string, string | number> = {
          timestamp,
          folder,
        };
        const signature = cloudinary.utils.api_sign_request(
          paramsToSign,
          process.env.CLOUDINARY_API_SECRET!
        );
        return {
          signature,
          timestamp,
          folder,
          apiKey: process.env.CLOUDINARY_API_KEY!,
          cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
        };
      }),

    // 2. Tras el upload el cliente guarda la referencia en la BD
    save: protectedProcedure
      .input(z.object({
        entryId: z.number(),
        publicId: z.string(),
        url: z.string().url(),
        caption: z.string().optional(),
      }))
      .mutation(async ({ input }) => db.createVisitPhoto(input)),

    listByEntry: protectedProcedure
      .input(z.object({ entryId: z.number() }))
      .query(({ input }) => db.getVisitPhotosByEntry(input.entryId)),

    updateCaption: protectedProcedure
      .input(z.object({ id: z.number(), caption: z.string() }))
      .mutation(async ({ input }) => db.updateVisitPhotoCaption(input.id, input.caption)),

    delete: protectedProcedure
      .input(z.object({ id: z.number(), publicId: z.string() }))
      .mutation(async ({ input }) => {
        await cloudinary.uploader.destroy(input.publicId);
        return db.deleteVisitPhoto(input.id);
      }),

    // El servidor descarga las fotos de Cloudinary y las devuelve en base64
    // Evita problemas de CORS en el cliente al generar el PDF
    fetchAsBase64: protectedProcedure
      .input(z.object({ urls: z.array(z.string().url()) }))
      .mutation(async ({ input }) => {
        const results = await Promise.all(
          input.urls.map(async (url) => {
            try {
              // Versión reducida para el PDF (200x200, jpg, calidad 70)
              const pdfUrl = url.replace("/upload/", "/upload/w_200,h_200,c_fill,f_jpg,q_70/");
              const res = await fetch(pdfUrl);
              if (!res.ok) return null;
              const buffer = await res.arrayBuffer();
              const base64 = Buffer.from(buffer).toString("base64");
              return { url, base64 };
            } catch {
              return null;
            }
          })
        );
        return results.filter(Boolean);
      }),
  }),
});

export type AppRouter = typeof appRouter;
