import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc } from "drizzle-orm";
import * as schema from "../drizzle/schema";

const { users, farms, crops, reviews, photos, activities, tasks, cropAttachments, parcels, visitReports, visitEntries, visitPhotos } = schema;

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL not set");
    const client = postgres(connectionString);
    _db = drizzle(client, { schema });
  }
  return _db;
}

// ===== USERS =====
export async function getUserByEmail(email: string) {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] ?? null;
}

export async function getUserById(id: number) {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createUser(data: { name: string; email: string; passwordHash: string }) {
  const db = getDb();
  const result = await db.insert(users).values(data).returning();
  return result[0];
}

export async function updateLastSignedIn(userId: number) {
  const db = getDb();
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function updateUserProfile(userId: number, data: { companyName?: string; companyLogo?: string }) {
  const db = getDb();
  const result = await db.update(users).set(data).where(eq(users.id, userId)).returning();
  return result[0];
}

// ===== FARMS =====
export async function createFarm(data: typeof farms.$inferInsert) {
  const db = getDb();
  const result = await db.insert(farms).values(data).returning();
  return result[0];
}

export async function getFarmsByOwnerId(ownerId: number) {
  const db = getDb();
  return db.select().from(farms).where(eq(farms.ownerId, ownerId)).orderBy(desc(farms.createdAt));
}

export async function getFarmById(id: number) {
  const db = getDb();
  const result = await db.select().from(farms).where(eq(farms.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateFarm(id: number, data: Partial<typeof farms.$inferInsert>) {
  const db = getDb();
  const result = await db.update(farms).set({ ...data, updatedAt: new Date() }).where(eq(farms.id, id)).returning();
  return result[0];
}

export async function deleteFarm(id: number) {
  const db = getDb();
  await db.delete(farms).where(eq(farms.id, id));
  return { success: true };
}

// ===== CROPS =====
export async function createCrop(data: typeof crops.$inferInsert) {
  const db = getDb();
  const result = await db.insert(crops).values(data).returning();
  return result[0];
}

export async function getCropsByFarmId(farmId: number) {
  const db = getDb();
  return db.select().from(crops).where(eq(crops.farmId, farmId)).orderBy(desc(crops.createdAt));
}

export async function getCropById(id: number) {
  const db = getDb();
  const result = await db.select().from(crops).where(eq(crops.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateCrop(id: number, data: Partial<typeof crops.$inferInsert>) {
  const db = getDb();
  const result = await db.update(crops).set({ ...data, updatedAt: new Date() }).where(eq(crops.id, id)).returning();
  return result[0];
}

export async function deleteCrop(id: number) {
  const db = getDb();
  await db.delete(crops).where(eq(crops.id, id));
  return { success: true };
}

// ===== REVIEWS =====
export async function createReview(data: typeof reviews.$inferInsert) {
  const db = getDb();
  const result = await db.insert(reviews).values(data).returning();
  return result[0];
}

export async function getReviewsByFarmId(farmId: number) {
  const db = getDb();
  return db.select().from(reviews).where(eq(reviews.farmId, farmId)).orderBy(desc(reviews.createdAt));
}

export async function getReviewById(id: number) {
  const db = getDb();
  const result = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  return result[0] ?? null;
}

export async function deleteReview(id: number) {
  const db = getDb();
  await db.delete(reviews).where(eq(reviews.id, id));
  return { success: true };
}

// ===== PHOTOS =====
export async function createPhoto(data: typeof photos.$inferInsert) {
  const db = getDb();
  const result = await db.insert(photos).values(data).returning();
  return result[0];
}

export async function getPhotosByReviewId(reviewId: number) {
  const db = getDb();
  return db.select().from(photos).where(eq(photos.reviewId, reviewId));
}

export async function getPhotoById(id: number) {
  const db = getDb();
  const result = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
  return result[0] ?? null;
}

export async function deletePhoto(id: number) {
  const db = getDb();
  await db.delete(photos).where(eq(photos.id, id));
  return { success: true };
}

// ===== ACTIVITIES =====
export async function createActivity(data: typeof activities.$inferInsert) {
  const db = getDb();
  const result = await db.insert(activities).values(data).returning();
  return result[0];
}

export async function getActivitiesByFarmId(farmId: number) {
  const db = getDb();
  return db.select().from(activities).where(eq(activities.farmId, farmId)).orderBy(desc(activities.activityDate));
}

export async function getActivityById(id: number) {
  const db = getDb();
  const result = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateActivity(id: number, data: Partial<typeof activities.$inferInsert>) {
  const db = getDb();
  const result = await db.update(activities).set(data).where(eq(activities.id, id)).returning();
  return result[0];
}

export async function deleteActivity(id: number) {
  const db = getDb();
  await db.delete(activities).where(eq(activities.id, id));
  return { success: true };
}

// ===== TASKS =====
export async function createTask(data: typeof tasks.$inferInsert) {
  const db = getDb();
  const result = await db.insert(tasks).values(data).returning();
  return result[0];
}

export async function getTasksByFarmId(farmId: number) {
  const db = getDb();
  return db.select().from(tasks).where(eq(tasks.farmId, farmId)).orderBy(desc(tasks.dueDate));
}

export async function getTaskById(id: number) {
  const db = getDb();
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateTask(id: number, data: Partial<typeof tasks.$inferInsert>) {
  const db = getDb();
  const result = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
  return result[0];
}

export async function deleteTask(id: number) {
  const db = getDb();
  await db.delete(tasks).where(eq(tasks.id, id));
  return { success: true };
}

// ===== CROP ATTACHMENTS =====
export async function createCropAttachment(data: typeof cropAttachments.$inferInsert) {
  const db = getDb();
  const result = await db.insert(cropAttachments).values(data).returning();
  return result[0];
}

export async function getCropAttachmentsByCropId(cropId: number) {
  const db = getDb();
  return db.select().from(cropAttachments).where(eq(cropAttachments.cropId, cropId));
}

export async function getCropAttachmentById(id: number) {
  const db = getDb();
  const result = await db.select().from(cropAttachments).where(eq(cropAttachments.id, id)).limit(1);
  return result[0] ?? null;
}

export async function deleteCropAttachment(id: number) {
  const db = getDb();
  await db.delete(cropAttachments).where(eq(cropAttachments.id, id));
  return { success: true };
}

// ===== CAMPAIGNS =====
const { campaigns } = schema;

export async function createCampaign(data: typeof campaigns.$inferInsert) {
  const db = getDb();
  const result = await db.insert(campaigns).values(data).returning();
  return result[0];
}

export async function getCampaignsByFarmId(farmId: number) {
  const db = getDb();
  return db.select().from(campaigns).where(eq(campaigns.farmId, farmId)).orderBy(desc(campaigns.year));
}

export async function getAllCampaigns(ownerId: number) {
  const db = getDb();
  // Hacer JOIN con farms para filtrar por owner
  const allFarms = await db.select().from(schema.farms).where(eq(schema.farms.ownerId, ownerId));
  const farmIds = allFarms.map(f => f.id);
  if (farmIds.length === 0) return [];
  const all = await db.select().from(campaigns);
  return all.filter(c => farmIds.includes(c.farmId)).sort((a, b) => b.year - a.year);
}

export async function getCampaignById(id: number) {
  const db = getDb();
  const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateCampaign(id: number, data: Partial<typeof campaigns.$inferInsert>) {
  const db = getDb();
  const result = await db.update(campaigns).set({ ...data, updatedAt: new Date() }).where(eq(campaigns.id, id)).returning();
  return result[0];
}

export async function deleteCampaign(id: number) {
  const db = getDb();
  await db.delete(campaigns).where(eq(campaigns.id, id));
  return { success: true };
}

export async function deleteAllCampaignsByFarm(farmId: number) {
  const db = getDb();
  await db.delete(campaigns).where(eq(campaigns.farmId, farmId));
  return { success: true };
}

// ===== PARCELS =====
export async function createParcel(data: typeof parcels.$inferInsert) {
  const db = getDb();
  const result = await db.insert(parcels).values(data).returning();
  return result[0];
}

export async function getParcelsByFarmId(farmId: number) {
  const db = getDb();
  return db.select().from(parcels).where(eq(parcels.farmId, farmId)).orderBy(parcels.name);
}

export async function getParcelById(id: number) {
  const db = getDb();
  const result = await db.select().from(parcels).where(eq(parcels.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateParcel(id: number, data: Partial<typeof parcels.$inferInsert>) {
  const db = getDb();
  const result = await db.update(parcels).set({ ...data, updatedAt: new Date() }).where(eq(parcels.id, id)).returning();
  return result[0];
}

export async function deleteParcel(id: number) {
  const db = getDb();
  await db.delete(parcels).where(eq(parcels.id, id));
  return { success: true };
}

// Listar todas las parcelas del owner (para dashboard global con filtros)
export async function getAllParcelsByOwner(ownerId: number) {
  const db = getDb();
  return db
    .select({
      parcel: parcels,
      farm: farms,
    })
    .from(parcels)
    .innerJoin(farms, eq(parcels.farmId, farms.id))
    .where(eq(farms.ownerId, ownerId))
    .orderBy(farms.name, parcels.name);
}

// ===== VISIT REPORTS =====
export async function createVisitReport(data: typeof visitReports.$inferInsert) {
  const db = getDb();
  const result = await db.insert(visitReports).values(data).returning();
  return result[0];
}

export async function getVisitReportsByOwner(technicianId: number) {
  const db = getDb();
  return db.select().from(visitReports)
    .where(eq(visitReports.technicianId, technicianId))
    .orderBy(visitReports.dateStart);
}

export async function getVisitReportById(id: number) {
  const db = getDb();
  const result = await db.select().from(visitReports).where(eq(visitReports.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateVisitReport(id: number, data: Partial<typeof visitReports.$inferInsert>) {
  const db = getDb();
  const result = await db.update(visitReports).set({ ...data, updatedAt: new Date() }).where(eq(visitReports.id, id)).returning();
  return result[0];
}

export async function deleteVisitReport(id: number) {
  const db = getDb();
  await db.delete(visitReports).where(eq(visitReports.id, id));
  return { success: true };
}

// ===== VISIT ENTRIES =====
export async function createVisitEntry(data: typeof visitEntries.$inferInsert) {
  const db = getDb();
  const result = await db.insert(visitEntries).values(data).returning();
  return result[0];
}

export async function getVisitEntriesByReport(reportId: number) {
  const db = getDb();
  return db.select({
    entry: visitEntries,
    farm: farms,
    parcel: parcels,
  })
  .from(visitEntries)
  .innerJoin(farms, eq(visitEntries.farmId, farms.id))
  .leftJoin(parcels, eq(visitEntries.parcelId, parcels.id))
  .where(eq(visitEntries.reportId, reportId))
  .orderBy(visitEntries.visitDate, farms.name);
}

export async function updateVisitEntry(id: number, data: Partial<typeof visitEntries.$inferInsert>) {
  const db = getDb();
  const result = await db.update(visitEntries).set({ ...data, updatedAt: new Date() }).where(eq(visitEntries.id, id)).returning();
  return result[0];
}

export async function deleteVisitEntry(id: number) {
  const db = getDb();
  await db.delete(visitEntries).where(eq(visitEntries.id, id));
  return { success: true };
}

// ===== VISIT PHOTOS =====
export async function createVisitPhoto(data: typeof visitPhotos.$inferInsert) {
  const db = getDb();
  const result = await db.insert(visitPhotos).values(data).returning();
  return result[0];
}

export async function getVisitPhotosByEntry(entryId: number) {
  const db = getDb();
  return db.select().from(visitPhotos).where(eq(visitPhotos.entryId, entryId)).orderBy(visitPhotos.createdAt);
}

export async function deleteVisitPhoto(id: number) {
  const db = getDb();
  const result = await db.select().from(visitPhotos).where(eq(visitPhotos.id, id)).limit(1);
  await db.delete(visitPhotos).where(eq(visitPhotos.id, id));
  return result[0];
}

export async function getVisitEntriesHistorico(farmId: number, parcelId?: number) {
  const db = getDb();
  const conditions = parcelId
    ? and(eq(visitEntries.farmId, farmId), eq(visitEntries.parcelId, parcelId))
    : eq(visitEntries.farmId, farmId);
  return db.select({
    id: visitEntries.id,
    visitDate: visitEntries.visitDate,
    estadoFenologico: visitEntries.estadoFenologico,
    vigorVegetativo: visitEntries.vigorVegetativo,
    colorFoliaje: visitEntries.colorFoliaje,
    estadoSanitario: visitEntries.estadoSanitario,
    estadoRiego: visitEntries.estadoRiego,
    brixGrados: visitEntries.brixGrados,
    calibreMm: visitEntries.calibreMm,
    firmezaKg: visitEntries.firmezaKg,
    parcelId: visitEntries.parcelId,
  })
  .from(visitEntries)
  .where(conditions)
  .orderBy(visitEntries.visitDate);
}

export async function getAllTasksByOwner(ownerId: number) {
  const db = getDb();
  return db.select({ task: tasks, farm: farms })
    .from(tasks)
    .innerJoin(farms, eq(tasks.farmId, farms.id))
    .where(eq(farms.ownerId, ownerId))
    .orderBy(tasks.dueDate);
}

export async function getAllVisitEntriesByOwner(ownerId: number) {
  const db = getDb();
  return db.select({ entry: visitEntries, farm: farms, parcel: parcels })
    .from(visitEntries)
    .innerJoin(farms, eq(visitEntries.farmId, farms.id))
    .leftJoin(parcels, eq(visitEntries.parcelId, parcels.id))
    .where(eq(farms.ownerId, ownerId))
    .orderBy(visitEntries.visitDate);
}

export async function updateVisitPhotoCaption(id: number, caption: string) {
  const db = getDb();
  const result = await db.update(visitPhotos).set({ caption }).where(eq(visitPhotos.id, id)).returning();
  return result[0];
}
