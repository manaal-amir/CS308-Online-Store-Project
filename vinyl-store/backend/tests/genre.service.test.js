//tests for adding and removing genres with a fake database, so no docker is needed
//the real database test (genre.db.test.js) checks the case rule and the kept records for real

//replace prisma with fake functions
jest.mock('../src/config/prisma', () => ({
  genre: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
}));

const prisma = require('../src/config/prisma');
const { createGenre, deleteGenre } = require('../src/modules/genres/genre.service');

//makes an error like the ones prisma throws, e.g. P2002 or P2025
function prismaError(code) {
  const err = new Error(`prisma error ${code}`);
  err.code = code;
  return err;
}

beforeEach(() => {
  jest.resetAllMocks();
  //by default no genre has the name yet, and create returns the saved row
  prisma.genre.findFirst.mockResolvedValue(null);
  prisma.genre.create.mockImplementation(({ data }) => Promise.resolve({ id: 7, ...data }));
});

describe('create genre service', () => {
  //test 1: the name and description reach the database as given and the new genre is returned
  it('saves the genre and returns it', async () => {
    const result = await createGenre({ name: 'Blues', description: 'Twelve bars' });

    expect(prisma.genre.create).toHaveBeenCalledWith({
      data: { name: 'Blues', description: 'Twelve bars' },
    });
    expect(result).toEqual({ id: 7, name: 'Blues', description: 'Twelve bars' });
  });

  //test 2: the duplicate check ignores case
  it('looks for the name without caring about case', async () => {
    await createGenre({ name: 'Blues' });

    expect(prisma.genre.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'Blues', mode: 'insensitive' } },
      select: { id: true },
    });
  });

  //test 3: a missing, empty or null description is saved as no description
  it.each([undefined, '', null])('saves description %p as null', async (description) => {
    const result = await createGenre({ name: 'Blues', description });

    expect(prisma.genre.create).toHaveBeenCalledWith({
      data: { name: 'Blues', description: null },
    });
    expect(result.description).toBeNull();
  });

  //test 4: fields that are not name or description never reach the database
  it('ignores extra fields in the body', async () => {
    await createGenre({ name: 'Blues', id: 99, Products: { connect: { id: 1 } } });

    expect(prisma.genre.create).toHaveBeenCalledWith({
      data: { name: 'Blues', description: null },
    });
  });

  //test 5: "blues" is rejected when "Blues" already exists
  it('rejects a name that already exists in another case', async () => {
    prisma.genre.findFirst.mockResolvedValue({ id: 3 });

    await expect(createGenre({ name: 'blues' })).rejects.toMatchObject({
      status: 409,
      message: 'A genre with this name already exists',
    });
    expect(prisma.genre.create).not.toHaveBeenCalled();
  });

  //test 6: a double click can pass the check twice, the unique rule (P2002) stops the second one
  it('turns a unique rule error into 409', async () => {
    prisma.genre.create.mockRejectedValue(prismaError('P2002'));

    await expect(createGenre({ name: 'Blues' })).rejects.toMatchObject({
      status: 409,
      message: 'A genre with this name already exists',
    });
  });

  //test 7: other database errors are not hidden
  it('rethrows other errors', async () => {
    const err = new Error('connection lost');
    prisma.genre.create.mockRejectedValue(err);

    await expect(createGenre({ name: 'Blues' })).rejects.toBe(err);
  });
});

describe('delete genre service', () => {
  //test 1: the genre is removed and the id is returned
  it('removes the genre', async () => {
    prisma.genre.delete.mockResolvedValue({ id: 7 });

    const result = await deleteGenre(7);

    expect(prisma.genre.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(result).toEqual({ id: 7, removed: true });
  });

  //test 2: P2025 means there is no genre with this id
  it('returns 404 when the genre does not exist', async () => {
    prisma.genre.delete.mockRejectedValue(prismaError('P2025'));

    await expect(deleteGenre(7)).rejects.toMatchObject({
      status: 404,
      message: 'Genre not found',
    });
  });

  //test 3: other database errors are not hidden
  it('rethrows other errors', async () => {
    const err = prismaError('P2003');
    prisma.genre.delete.mockRejectedValue(err);

    await expect(deleteGenre(7)).rejects.toBe(err);
  });
});
