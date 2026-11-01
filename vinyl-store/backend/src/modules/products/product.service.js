const prisma = require('../../config/prisma');

//Returns the public catalog fields needed by the storefront.
async function getProducts({ genre } = {}) {
  const products = await prisma.product.findMany({
    where: genre
      ? { genre: { name: { equals: genre, mode: 'insensitive' } } }
      : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      model: true,
      serialNumber: true,
      quantity: true,
      price: true,
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

module.exports = { getProducts };