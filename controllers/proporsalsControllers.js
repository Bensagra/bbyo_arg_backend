import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function resolveChapter({ chapterId, chapterSlug }) {
  if (chapterId) {
    return prisma.chapter.findUnique({ where: { id: Number(chapterId) } });
  }
  if (chapterSlug) {
    return prisma.chapter.findUnique({ where: { slug: String(chapterSlug) } });
  }
  return null;
}

export const listTematicas = async (req, res) => {
  try {
    const { chapterId, chapterSlug } = req.query;
    const chapter = await resolveChapter({ chapterId, chapterSlug });
    if (!chapter) return res.status(400).json({ message: "Debes pasar chapterId o chapterSlug válido." });

    const q = (req.query.q ?? "").toString().trim();
    const take = Number.isFinite(Number(req.query.take)) ? Number(req.query.take) : 50;
    const skip = Number.isFinite(Number(req.query.skip)) ? Number(req.query.skip) : 0;

    const where = {
      usada: false,
      chapterId: chapter.id,
      ...(q ? { tematica: { contains: q, mode: "insensitive" } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.tematica.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.tematica.count({ where }),
    ]);

    res.status(200).json({ total, take, skip, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createTematica = async (req, res) => {
  try {
    const { chapterId, chapterSlug } = req.body;
    const raw = (req.body.tematica ?? "").toString().trim();
    if (!raw) return res.status(400).json({ message: "Falta 'tematica'." });

    const chapter = await resolveChapter({ chapterId, chapterSlug });
    if (!chapter) return res.status(400).json({ message: "Debes indicar chapterId o chapterSlug válido." });

    // Evitar duplicados dentro del mismo chapter (case-insensitive)
    const exists = await prisma.tematica.findFirst({
      where: {
        chapterId: chapter.id,
        tematica: { equals: raw, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (exists) {
      return res.status(409).json({ message: "La temática ya existe en este chapter." });
    }

    const newTematica = await prisma.tematica.create({
      data: {
        tematica: raw,
        chapterId: chapter.id,
      },
    });

    res.status(201).json(newTematica);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};