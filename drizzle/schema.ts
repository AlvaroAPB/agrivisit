import { pgTable, serial, text, timestamp, integer, boolean, decimal, pgEnum, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["tecnico", "supervisor"]);
export const activityTypeEnum = pgEnum("activity_type", ["labor", "aplicacion", "riego", "cosecha", "mantenimiento", "otro"]);
export const priorityEnum = pgEnum("priority", ["baja", "media", "alta"]);
export const cropStatusEnum = pgEnum("crop_status", ["activo", "completado", "archivado"]);
export const attachmentTypeEnum = pgEnum("attachment_type", ["analisis_suelo", "foto_crecimiento", "registro_plagas", "registro_fertilizante", "registro_riego", "registro_cosecha", "otro"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").default("tecnico").notNull(),
  companyName: text("company_name"),
  companyLogo: text("company_logo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export const farms = pgTable("farms", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  totalHectares: decimal("total_hectares", { precision: 10, scale: 2 }),
  latitude: decimal("latitude", { precision: 10, scale: 6 }),
  longitude: decimal("longitude", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const crops = pgTable("crops", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").references(() => farms.id).notNull(),
  species: text("species").notNull(),
  variety: text("variety"),
  plantingYear: integer("planting_year").notNull(),
  harvestYear: integer("harvest_year"),
  surface: decimal("surface", { precision: 10, scale: 2 }),
  plantingDate: timestamp("planting_date"),
  harvestDate: timestamp("harvest_date"),
  expectedProduction: decimal("expected_production", { precision: 10, scale: 2 }),
  actualProduction: decimal("actual_production", { precision: 10, scale: 2 }),
  productionUnit: text("production_unit"),
  irrigationType: text("irrigation_type"),
  soilType: text("soil_type"),
  fertilizer: text("fertilizer"),
  pesticides: text("pesticides"),
  notes: text("notes"),
  status: cropStatusEnum("status").default("activo").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").references(() => farms.id).notNull(),
  technicianId: integer("technician_id").references(() => users.id).notNull(),
  cropStatus: text("crop_status"),
  infrastructure: text("infrastructure"),
  supplies: text("supplies"),
  generalObservations: text("general_observations"),
  recommendations: text("recommendations"),
  latitude: decimal("latitude", { precision: 10, scale: 6 }),
  longitude: decimal("longitude", { precision: 10, scale: 6 }),
  visitDate: timestamp("visit_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  reviewId: integer("review_id").references(() => reviews.id).notNull(),
  photoUrl: text("photo_url").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").references(() => farms.id).notNull(),
  activityType: activityTypeEnum("activity_type").notNull(),
  description: text("description").notNull(),
  activityDate: timestamp("activity_date").notNull(),
  responsibleId: integer("responsible_id").references(() => users.id),
  isCompleted: boolean("is_completed").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").references(() => farms.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date").notNull(),
  assignedToId: integer("assigned_to_id").references(() => users.id),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  priority: priorityEnum("priority").default("media").notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cropAttachments = pgTable("crop_attachments", {
  id: serial("id").primaryKey(),
  cropId: integer("crop_id").references(() => crops.id).notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  attachmentType: attachmentTypeEnum("attachment_type").default("otro"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Farm = typeof farms.$inferSelect;
export type Crop = typeof crops.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type CropAttachment = typeof cropAttachments.$inferSelect;
