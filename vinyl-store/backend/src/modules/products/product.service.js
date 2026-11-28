const prisma = require('../../config/prisma');
const { getRatingSummary, getRatingSummaries } = require('../reviews/reviews.common');

//what an unrated record shows: no average yet and no ratings (requirement 5)
const NO_RATINGS = { averageRating: null, ratingCount: 0 };

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

  const products = await prisma.product.findMany({
    where: conditions.length ? { AND: conditions } : undefined,
    orderBy,
    select: {
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
    },
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
async function getProductById(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
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
    },
  });

  if (!product) return null;

  const ratings = await getRatingSummary(prisma, id);
  return { ...product, price: Number(product.price), ...ratings };
}

module.exports = { getProducts, getProductById };
