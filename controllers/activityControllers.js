import { EstadoActividad, PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/* helpers */
async function resolveChapter({ chapterId, chapterSlug }) {
  if (chapterId) return prisma.chapter.findUnique({ where: { id: Number(chapterId) } });
  if (chapterSlug) return prisma.chapter.findUnique({ where: { slug: String(chapterSlug) } });
  return null;
}
async function getActivityBasic(activityId) {
  return prisma.activity.findUnique({ where: { id: activityId }, select: { id: true, chapterId: true } });
}

/**
 * POST /api/activities
 * body: { date, notas?, chapterId? | chapterSlug? }
 */
export const createActivity = async (req, res) => {
  const { date, notas, chapterId, chapterSlug } = req.body;
  try {
    if (!date) return res.status(400).json({ message: "Falta 'date'." });
    const chapter = await resolveChapter({ chapterId, chapterSlug });
    if (!chapter) return res.status(400).json({ message: "Debes indicar un chapter válido (chapterId o chapterSlug)." });

    const newActivity = await prisma.activity.create({
      data: {
        fecha: new Date(date),
        chapterId: chapter.id,
        ...(notas ? { notas: String(notas) } : {}),
      },
      include: {
        participants: { include: { user: true } },
        tematicas: { include: { tematica: true } },
      },
    });
    return res.status(201).json(newActivity);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Ya existe una actividad con esa fecha." });
    }
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/activities
 * query: ?chapterId=... | ?chapterSlug=... &from=YYYY-MM-DD &to=YYYY-MM-DD &q=&take=&skip=&estado=
 */
export const listActivities = async (req, res) => {
  try {
    const { chapterId, chapterSlug } = req.query;
    const chapter = await resolveChapter({ chapterId, chapterSlug });
    if (!chapter) return res.status(400).json({ message: "Debes indicar chapterId o chapterSlug." });

    const q = (req.query.q ?? "").toString().trim();
    const take = Number.isFinite(Number(req.query.take)) ? Number(req.query.take) : 50;
    const skip = Number.isFinite(Number(req.query.skip)) ? Number(req.query.skip) : 0;
    const estado = (req.query.estado ?? "").toString().trim(); // Nuevo

    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const where = { chapterId: chapter.id };
    if (from || to) where.fecha = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    if (q) where.OR = [{ notas: { contains: q, mode: "insensitive" } }];
    if (estado) where.estado = estado; // e.g. 'FUE_PLANIFICADA'

    const [items, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { fecha: "asc" },
        take,
        skip,
        include: {
          participants: { include: { user: true } },
          tematicas: { include: { tematica: true } },
        },
      }),
      prisma.activity.count({ where }),
    ]);

    return res.status(200).json({ total, take, skip, items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * PATCH /api/activities/:id
 * body: { planificada?: boolean, notas?: string }
 */
export const patchActivity = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { planificada, notas } = req.body;
  try {
    const activity = await getActivityBasic(id);
    if (!activity) return res.status(404).json({ message: "Actividad no encontrada" });

    let nuevoEstado;
    if (planificada === true) {
      nuevoEstado = EstadoActividad.FUE_PLANIFICADA;
    } else {
      const totalParticipants = await prisma.activityUser.count({
        where: { activityId: id, chapterId: activity.chapterId },
      });
      nuevoEstado =
        totalParticipants >= 3
          ? EstadoActividad.YA_HAY_GENTE_PERO_NO_SE_PLANIFICO
          : EstadoActividad.HAY_GENTE_PERO_NO_NECESARIA;
    }

    const updated = await prisma.activity.update({
      where: { id },
      data: { estado: nuevoEstado, ...(notas !== undefined ? { notas: String(notas) } : {}) },
      include: {
        participants: { include: { user: true } },
        tematicas: { include: { tematica: true } },
      },
    });
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /api/activities/:id
 * body: { participants: string[] (DNIs), topics: string[] (labels) }
 */
export const updateActivity = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  const { participants: dnis = [], topics = [] } = req.body;

  try {
    const act = await getActivityBasic(activityId);
    if (!act) return res.status(404).json({ message: "Actividad no encontrada" });

    // Temáticas por chapter
    const tematicas = await Promise.all(
      topics.map(async (labelRaw) => {
        const label = String(labelRaw).trim();
        if (!label) return null;

        let tema = await prisma.tematica.findFirst({
          where: { chapterId: act.chapterId, tematica: { equals: label, mode: "insensitive" } },
        });

        if (!tema) {
          tema = await prisma.tematica.create({
            data: { tematica: label, usada: true, chapterId: act.chapterId },
          });
        } else if (!tema.usada) {
          await prisma.tematica.update({ where: { id: tema.id }, data: { usada: true } });
        }
        return tema;
      })
    );
    const validTemas = tematicas.filter(Boolean);

    // Usuarios por DNI + chapter
    const users = await prisma.user.findMany({
      where: { dni: { in: dnis.map(String) }, chapterId: act.chapterId },
    });

    const encontrados = new Set(users.map((u) => u.dni));
    const faltantes = dnis.filter((d) => !encontrados.has(String(d)));
    if (faltantes.length > 0) {
      return res.status(400).json({ error: `Usuarios no encontrados en este chapter: ${faltantes.join(", ")}` });
    }

    // Vincular
    await prisma.$transaction([
      prisma.activityUser.createMany({
        data: users.map((u) => ({ activityId, userId: u.id, chapterId: act.chapterId })),
        skipDuplicates: true,
      }),
      prisma.activityTematica.createMany({
        data: validTemas.map((t) => ({ activityId, tematicaId: t.id })),
        skipDuplicates: true,
      }),
    ]);

    // Recalcular estado
    const totalParticipants = await prisma.activityUser.count({
      where: { activityId, chapterId: act.chapterId },
    });
    const nuevoEstado =
      totalParticipants >= 3
        ? EstadoActividad.YA_HAY_GENTE_PERO_NO_SE_PLANIFICO
        : EstadoActividad.HAY_GENTE_PERO_NO_NECESARIA;

    await prisma.activity.update({ where: { id: activityId }, data: { estado: nuevoEstado } });

    const updated = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        participants: { include: { user: true } },
        tematicas: { include: { tematica: true } },
      },
    });
    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error en updateActivity:", error);
    return res.status(500).json({ error: error.message });
  }
};