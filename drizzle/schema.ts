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

// ─── PARCELAS ──────────────────────────────────────────────────────────────
// Una finca puede tener varias parcelas, cada una con su propia variedad,
// año de plantación, marco, suelo, etc. Es la unidad real de gestión técnica.
export const parcels = pgTable("parcels", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").references(() => farms.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // ej: "Parcela A", "Sector Norte"
  surface: decimal("surface", { precision: 10, scale: 2 }), // ha

  // Datos del cultivo
  especie: text("especie"),     // ej: "Arándano"
  variedad: text("variedad"),   // ej: "Blu Aroma®"
  anyoPlantacion: integer("anyo_plantacion"),
  anyoProduccion: integer("anyo_produccion"), // primer año productivo

  // Marco y conducción
  distLineas: decimal("dist_lineas", { precision: 5, scale: 2 }),  // m entre líneas
  distPlantas: decimal("dist_plantas", { precision: 5, scale: 2 }), // m entre plantas
  densidad: integer("densidad"),       // pl/ha
  conduccion: text("conduccion"),      // ej: "Hilera en malla", "Espaldera"
  portainjerto: text("portainjerto"),
  nPlantas: integer("n_plantas"),

  // Suelo
  tipoSuelo: text("tipo_suelo"),
  ph: decimal("ph", { precision: 4, scale: 2 }),
  materiaOrganica: decimal("materia_organica", { precision: 5, scale: 2 }),
  ce: decimal("ce", { precision: 5, scale: 2 }), // dS/m

  // Geometría (polígono GeoJSON serializado)
  polygon: text("polygon"),
  centerLat: decimal("center_lat", { precision: 10, scale: 6 }),
  centerLng: decimal("center_lng", { precision: 10, scale: 6 }),

  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Farm = typeof farms.$inferSelect;
export type Crop = typeof crops.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Parcel = typeof parcels.$inferSelect;

// ─── INFORMES DE VISITA ────────────────────────────────────────────────────
// Un informe agrupa varias entradas (finca+parcela) en un rango de fechas.
// Pensado para visitas de técnico que recorre varias fincas en varios días.

export const visitReports = pgTable("visit_reports", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id").references(() => users.id).notNull(),
  title: text("title").notNull(),             // ej: "Visita Sus-Masa Abril 2025"
  dateStart: timestamp("date_start").notNull(),
  dateEnd: timestamp("date_end").notNull(),
  status: text("status").default("borrador").notNull(), // borrador | finalizado
  internalNotes: text("internal_notes"),       // notas generales del informe
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const visitEntries = pgTable("visit_entries", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => visitReports.id, { onDelete: "cascade" }).notNull(),
  farmId: integer("farm_id").references(() => farms.id).notNull(),
  parcelId: integer("parcel_id").references(() => parcels.id),  // opcional
  visitDate: timestamp("visit_date").notNull(),

  // ── Fenología ──────────────────────────────────────────────────
  estadoFenologico: text("estado_fenologico"), // ej: "Cuajado", "Envero", "Maduración"
  semanasDesdeFlor: integer("semanas_desde_flor"),

  // ── Estado del cultivo (escala 1-5) ───────────────────────────
  vigorVegetativo: integer("vigor_vegetativo"),   // 1=muy bajo … 5=excelente
  colorFoliaje: integer("color_foliaje"),          // 1=amarillo … 5=verde intenso
  estadoSanitario: integer("estado_sanitario"),    // 1=grave … 5=sin problemas
  estadoRiego: integer("estado_riego"),            // 1=deficiente … 5=óptimo

  // ── Plagas y enfermedades ─────────────────────────────────────
  plagasDetectadas: text("plagas_detectadas"),     // texto libre o JSON array
  enfermedadesDetectadas: text("enfermedades_detectadas"),
  presionFitosanitaria: text("presion_fitosanitaria"), // baja | media | alta | crítica

  // ── Mediciones de calidad de fruta ────────────────────────────
  brixGrados: decimal("brix_grados", { precision: 4, scale: 1 }),
  calibreMm: decimal("calibre_mm", { precision: 5, scale: 1 }),
  firmezaKg: decimal("firmeza_kg", { precision: 4, scale: 2 }),
  porcentajeColor: integer("porcentaje_color"),    // 0-100%
  pesoMedioBaya: decimal("peso_medio_baya", { precision: 5, scale: 2 }), // gramos

  // ── Tareas realizadas ─────────────────────────────────────────
  tareasRealizadas: text("tareas_realizadas"),     // texto libre

  // ── Observaciones y recomendaciones ──────────────────────────
  observaciones: text("observaciones"),
  recomendaciones: text("recomendaciones"),

  // ── Geolocalización ───────────────────────────────────────────
  latitude: decimal("latitude", { precision: 10, scale: 6 }),
  longitude: decimal("longitude", { precision: 10, scale: 6 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type VisitReport = typeof visitReports.$inferSelect;
export type VisitEntry = typeof visitEntries.$inferSelect;

// ─── FOTOS DE VISITA ───────────────────────────────────────────────────────
export const visitPhotos = pgTable("visit_photos", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").references(() => visitEntries.id, { onDelete: "cascade" }).notNull(),
  publicId: text("public_id").notNull(),   // ID en Cloudinary
  url: text("url").notNull(),              // URL segura de Cloudinary
  caption: text("caption"),               // descripción opcional
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VisitPhoto = typeof visitPhotos.$inferSelect;
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").references(() => farms.id).notNull(),
  year: integer("year").notNull(), // año de cosecha
  variety: text("variety"),

  // Fenología
  bloomDate: timestamp("bloom_date"), // plena flor
  harvestStartDate: timestamp("harvest_start_date"),
  harvestEndDate: timestamp("harvest_end_date"),

  // Acumulados climáticos al final de campaña
  chillPortions: decimal("chill_portions", { precision: 6, scale: 2 }),
  gddBloomToHarvest: decimal("gdd_bloom_to_harvest", { precision: 8, scale: 2 }),

  // Producción
  yieldKgHa: decimal("yield_kg_ha", { precision: 10, scale: 2 }),
  totalYieldKg: decimal("total_yield_kg", { precision: 12, scale: 2 }),
  meanCaliberMm: decimal("mean_caliber_mm", { precision: 5, scale: 2 }),
  caliberCategory: text("caliber_category"), // AAA, AA, A, B, etc
  brixDegrees: decimal("brix_degrees", { precision: 4, scale: 2 }),
  commercialCategory: text("commercial_category"), // Extra, I, II

  // Eventos / problemas
  frostEvents: integer("frost_events").default(0),
  heatStressEvents: integer("heat_stress_events").default(0),
  hailEvent: boolean("hail_event").default(false),
  pestPressure: text("pest_pressure"), // baja/media/alta

  // Notas
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type CropAttachment = typeof cropAttachments.$inferSelect;
