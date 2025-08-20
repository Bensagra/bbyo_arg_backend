import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * POST /users
 * body: { name, surname, email, dni, chapterId? , chapterSlug? }
 * - Requiere chapterId o chapterSlug
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

    // Resolver chapter
    let resolvedChapter = null;
    if (chapterId) {
      resolvedChapter = await prisma.chapter.findUnique({ where: { id: Number(chapterId) } });
    } else if (chapterSlug) {
      resolvedChapter = await prisma.chapter.findUnique({ where: { slug: String(chapterSlug) } });
    }

    if (!resolvedChapter) {
      return res.status(404).json({ message: "Chapter no encontrado." });
    }

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
    // Manejo de violaciones de unique (dni/email) u otros errores
    if (error.code === "P2002") {
      // Prisma unique constraint failed
      return res.status(409).json({
        message: "Conflicto de datos únicos.",
        meta: error.meta, // campos que chocaron (dni/email)
      });
    }
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /users/:dni
 * query opcional: ?chapterId=... o ?chapterSlug=...
 * - Aunque DNI sea único global, filtramos por chapter para respetar límites multi-tenant.
 */
export const getUser = async (req, res) => {
  const { dni } = req.params;
  const { chapterId, chapterSlug } = req.query;

  try {
    let user = null;

    if (chapterId || chapterSlug) {
      // Buscar dentro de un chapter específico
      user = await prisma.user.findFirst({
        where: {
          dni: String(dni),
          ...(chapterId
            ? { chapterId: Number(chapterId) }
            : chapterSlug
            ? { chapter: { slug: String(chapterSlug) } }
            : {}),
        },
        include: { chapter: true },
      });
    } else {
      // Fallback: DNI único global
      user = await prisma.user.findUnique({
        where: { dni: String(dni) },
        include: { chapter: true },
      });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};