import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * POST /api/users
 * body: { name, surname, email, dni, chapterId? , chapterSlug? }
 */
export const createUser = async (req, res) => {
  const { name, surname, email, dni, chapterId, chapterSlug } = req.body;
  try {
    if (!name || !surname || !email || !dni) {
      return res.status(400).json({ message: "Faltan campos obligatorios (name, surname, email, dni)." });
    }
    if (!chapterId && !chapterSlug) {
      return res.status(400).json({ message: "Debes indicar chapterId o chapterSlug." });
    }

    const resolvedChapter = chapterId
      ? await prisma.chapter.findUnique({ where: { id: Number(chapterId) } })
      : await prisma.chapter.findUnique({ where: { slug: String(chapterSlug) } });

    if (!resolvedChapter) return res.status(404).json({ message: "Chapter no encontrado." });

    const user = await prisma.user.create({
      data: {
        name,
        surname,
        email: String(email),
        dni: String(dni),
        chapterId: resolvedChapter.id,
      },
      include: { chapter: true },
    });
    return res.status(201).json(user);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Conflicto de datos únicos.", meta: error.meta });
    }
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/users/:dni
 * query: ?chapterId=... | ?chapterSlug=...
 */
export const getUser = async (req, res) => {
  const { dni } = req.params;
  const { chapterId, chapterSlug } = req.query;
  try {
    let user = null;
    if (chapterId || chapterSlug) {
      user = await prisma.user.findFirst({
        where: {
          dni: String(dni),
          ...(chapterId
            ? { chapterId: Number(chapterId) }
            : { chapter: { slug: String(chapterSlug) } }),
        },
        include: { chapter: true },
      });
    } else {
      user = await prisma.user.findUnique({ where: { dni: String(dni) }, include: { chapter: true } });
    }
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const listChapters = async (req, res) => {
  try {
    const items = await prisma.chapter.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};