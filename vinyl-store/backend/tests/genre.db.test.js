//these tests add and remove real genres in the real database (docker must be running)
//they check what fake tests cannot: the case rule and that records and artists are kept

//load DATABASE_URL from .env so this file knows whether a database is available
require('dotenv').config();

//skip these tests where there is no database
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

//database calls are slower than fake ones, so allow up to 20 seconds per test
jest.setTimeout(20000);

describeIfDb('add and remove genres with the real database', () => {
  let prisma;
  let genreService;
  const genreIds = [];
  const productIds = [];
  const artistIds = [];

  //a name no other genre has, so the tests never touch the seeded genres
  function uniqueName() {
    return `Genre Test ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
  }

  //adds a genre through the service and remembers it for cleanup
  async function createGenre(data) {
    const genre = await genreService.createGenre(data);
    genreIds.push(genre.id);
    return genre;
  }

  beforeAll(async () => {
    //load prisma only when the tests really run, so a skipped run never touches the database
    prisma = require('../src/config/prisma');
    genreService = require('../src/modules/genres/genre.service');
  });

  afterAll(async () => {
    //only this file's rows are removed, genres that a test already deleted are simply not found
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.artist.deleteMany({ where: { id: { in: artistIds } } });
    await prisma.genre.deleteMany({ where: { id: { in: genreIds } } });
    await prisma.$disconnect();
  });

  //test 1: the genre is saved with a missing description stored as null
  it('saves a new genre', async () => {
    const name = uniqueName();
    const genre = await createGenre({ name });

    expect(genre).toEqual({ id: expect.any(Number), name, description: null });
    const row = await prisma.genre.findUnique({ where: { id: genre.id } });
    expect(row).toMatchObject({ name, description: null });
  });

  //test 2: the same name in another case is rejected, the database still has one genre
  it('rejects the same name in another case', async () => {
    const name = uniqueName();
    await createGenre({ name });

    await expect(genreService.createGenre({ name: name.toUpperCase() })).rejects.toMatchObject({
      status: 409,
    });
    const count = await prisma.genre.count({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    expect(count).toBe(1);
  });

  //test 3: removing a genre in use keeps its records and artists, they just have no genre
  it('keeps records and artists of a removed genre', async () => {
    const genre = await createGenre({
      name: uniqueName(),
      description: 'Only used by genre tests',
    });
    const category = await prisma.category.findFirst();

    const artist = await prisma.artist.create({
      data: { name: `Genre Test Artist ${Date.now()} ${Math.random()}`, genreId: genre.id },
    });
    artistIds.push(artist.id);
    const product = await prisma.product.create({
      data: {
        name: 'Genre Test Record',
        model: 'Test',
        serialNumber: `GENRE-TEST-${Date.now()}-${Math.random()}`,
        quantity: 1,
        price: '100.00',
        warrantyStatus: 'None',
        distributor: 'Test',
        description: 'Only used by genre tests',
        categoryId: category.id,
        artistId: artist.id,
        genreId: genre.id,
      },
    });
    productIds.push(product.id);

    const result = await genreService.deleteGenre(genre.id);

    expect(result).toEqual({ id: genre.id, removed: true });
    expect(await prisma.genre.findUnique({ where: { id: genre.id } })).toBeNull();
    const keptProduct = await prisma.product.findUnique({ where: { id: product.id } });
    const keptArtist = await prisma.artist.findUnique({ where: { id: artist.id } });
    expect(keptProduct).toMatchObject({ id: product.id, genreId: null });
    expect(keptArtist).toMatchObject({ id: artist.id, genreId: null });
  });

  //test 4: removing a genre that does not exist gives 404
  it('returns 404 for a genre that does not exist', async () => {
    const genre = await createGenre({ name: uniqueName() });
    await genreService.deleteGenre(genre.id);

    await expect(genreService.deleteGenre(genre.id)).rejects.toMatchObject({ status: 404 });
  });
});
