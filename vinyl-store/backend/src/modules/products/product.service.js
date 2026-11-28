const prisma = require('../../config/prisma');
const { getRatingSummary, getRatingSummaries } = require('../reviews/reviews.common');

//what an unrated record shows: no average yet and no ratings (requirement 5)
const NO_RATINGS = { averageRating: null, ratingCount: 0 };

//the public fields of a record, shared by every product response
//cost is left out on purpose, it is internal and only used for profit (requirement 11)
const PUBLIC_SELECT = {
  id: true,
  name: true,
  model: true,
  serialNumber: true,
  quantity: true,
  price: true,
  warrantyStatus: true,
  distributor: true,
  description: true,
  imageUrl: true,
  createdAt: true,
  category: { select: { name: true } },
  artist: { select: { name: true } },
  genre: { select: { name: true } },
};

//optional fields the form can leave empty: undefined, null and '' all mean "not given"
//checked exactly, so a cost of 0 that was really entered stays 0
function orNull(value) {
  return value === undefined || value === null || value === '' ? null : value;
}

//Total units sold per product, as a Map of productId -> units (requirement 7: sort by popularity).
//Cancelled orders do not count, because cancelling gives the stock back and refunds the customer.
async function getUnitsSold() {
  const rows = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: { order: { status: { not: 'CANCELLED' } } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((row) => [row.productId, row._sum.quantity ?? 0]));
}

//Returns the public catalog fields needed by the storefront.
async function getProducts({ genre, search, sort } = {}) {
  const conditions = [];

  if (genre) {
    conditions.push({ genre: { name: { equals: genre, mode: 'insensitive' } } });
  }

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  let orderBy = { createdAt: 'desc' };
  if (sort === 'price_asc') {
    orderBy = { price: 'asc' };
  } else if (sort === 'price_desc') {
    orderBy = { price: 'desc' };
  }

  //removed records are never listed, whatever the genre, search or sort (requirement 12)
  const products = await prisma.product.findMany({
    where: conditions.length ? { isHidden: false, AND: conditions } : { isHidden: false },
    orderBy,
    select: PUBLIC_SELECT,
  });

  //one query for the ratings of every listed record, never one per record
  const ratings = await getRatingSummaries(
    prisma,
    products.map((product) => product.id)
  );

  const result = products.map((product) => ({
    ...product,
    price: Number(product.price),
    ...(ratings.get(product.id) || NO_RATINGS),
  }));

  if (sort === 'popularity') {
    //best sellers first. The list is already newest first, and sort() keeps that order
    //for ties, so products with the same units sold (or none sold) stay newest first
    const sold = await getUnitsSold();
    result.sort((a, b) => (sold.get(b.id) || 0) - (sold.get(a.id) || 0));
  }

  return result;
}

//Returns the full detail for one product, or null if it doesn't exist / isn't a valid id.
//A removed record also gives null, so its page shows "not found".
async function getProductById(id) {
  const product = await prisma.product.findUnique({
    where: { id, isHidden: false },
    select: PUBLIC_SELECT,
  });

  if (!product) return null;

  const ratings = await getRatingSummary(prisma, id);
  return { ...product, price: Number(product.price), ...ratings };
}

//Sets the stock of one product to a new total, e.g. 12 means 12 left, not 12 more (requirement 12).
//One update with no read first, so a missing or removed product comes back from Prisma as P2025.
async function updateStock(id, quantity) {
  try {
    return await prisma.product.update({
      where: { id, isHidden: false },
      data: { quantity },
      select: { id: true, quantity: true },
    });
  } catch (err) {
    if (err.code === 'P2025') {
      const notFound = new Error('Product not found');
      notFound.status = 404;
      throw notFound;
    }
    throw err;
  }
}

//Dropdown choices for the catalogue form, each list as { id, name } sorted by name.
async function getProductOptions() {
  const pick = { select: { id: true, name: true }, orderBy: { name: 'asc' } };
  const [categories, artists, genres] = await Promise.all([
    prisma.category.findMany(pick),
    prisma.artist.findMany(pick),
    prisma.genre.findMany(pick),
  ]);
  return { categories, artists, genres };
}

//Adds a new record to the catalogue (requirements 9, 11, 12).
//The data is built from the allowed fields only, so id, createdAt or originalPrice can never be set.
//A missing cost is saved as null, not half the price: checkout already uses half the price when
//cost is null, and saving null keeps "no cost entered" apart from a cost that was really entered.
async function createProduct(input) {
  const data = {
    name: input.name,
    model: input.model,
    serialNumber: input.serialNumber,
    distributor: input.distributor,
    warrantyStatus: input.warrantyStatus,
    description: input.description,
    quantity: input.quantity,
    price: input.price,
    categoryId: input.categoryId,
    artistId: orNull(input.artistId),
    genreId: orNull(input.genreId),
    cost: orNull(input.cost),
    imageUrl: orNull(input.imageUrl),
  };

  try {
    const product = await prisma.product.create({ data, select: PUBLIC_SELECT });
    //a brand new record has no ratings yet
    return { ...product, price: Number(product.price), ...NO_RATINGS };
  } catch (err) {
    //P2002: serialNumber is unique and another record already uses it
    if (err.code === 'P2002') {
      const duplicate = new Error('A record with this serial number already exists');
      duplicate.status = 409;
      throw duplicate;
    }
    //P2003: categoryId, artistId or genreId points to a row that does not exist
    if (err.code === 'P2003') {
      const missing = new Error('Category, artist or genre not found');
      missing.status = 400;
      throw missing;
    }
    throw err;
  }
}

//Removes a record from the shop by hiding it, the row is never deleted (requirement 12).
//Orders keep pointing to it, so order history, invoices and cancellations still work.
//Hiding it and taking it out of every cart happen together in one transaction.
//The update only matches a record that is not hidden yet, so a missing or already
//removed record comes back from Prisma as P2025. Stock is left as it is.
async function removeProduct(id) {
  try {
    await prisma.$transaction([
      prisma.product.update({
        where: { id, isHidden: false },
        data: { isHidden: true },
        select: { id: true },
      }),
      prisma.cartItem.deleteMany({ where: { productId: id } }),
    ]);
    return { id, removed: true };
  } catch (err) {
    if (err.code === 'P2025') {
      const notFound = new Error('Product not found');
      notFound.status = 404;
      throw notFound;
    }
    throw err;
  }
}

module.exports = {
  getProducts,
  getProductById,
  updateStock,
  getProductOptions,
  createProduct,
  removeProduct,
};
