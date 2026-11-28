const prisma = require('../../config/prisma');

//creates an error with a status so the error handler sends the right response
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const DUPLICATE_MESSAGE = 'A genre with this name already exists';

//turns a saved genre into a simple object for the frontend
function formatGenre(genre) {
  return { id: genre.id, name: genre.name, description: genre.description };
}

//adds a new genre (requirement 12)
//only name and description are used, any other field in the body is ignored
async function createGenre({ name, description }) {
  //the genre filter ignores case but the unique rule in the database does not,
  //so "blues" must be rejected when "Blues" already exists
  const existing = await prisma.genre.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) {
    throw httpError(409, DUPLICATE_MESSAGE);
  }

  try {
    const genre = await prisma.genre.create({
      //the validator lets an empty or null description through, save it as no description
      data: { name, description: description || null },
    });
    return formatGenre(genre);
  } catch (err) {
    //P2002 means another request saved the same name a moment ago (e.g. a double click)
    if (err.code === 'P2002') {
      throw httpError(409, DUPLICATE_MESSAGE);
    }
    throw err;
  }
}

//removes a genre (requirement 12)
//records and artists of this genre are kept, the database sets their genreId to null (onDelete: SetNull)
async function deleteGenre(id) {
  try {
    await prisma.genre.delete({ where: { id } });
    return { id, removed: true };
  } catch (err) {
    //P2025 means there is no genre with this id
    if (err.code === 'P2025') {
      throw httpError(404, 'Genre not found');
    }
    throw err;
  }
}

module.exports = { createGenre, deleteGenre };
