const prisma = require('../../config/prisma');

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

  return products.map((product) => ({
    ...product,
    price: Number(product.price),
  }));
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

  return { ...product, price: Number(product.price) };
}

module.exports = { getProducts, getProductById };
