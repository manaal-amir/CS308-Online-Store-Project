const prisma = require('../../config/prisma');

//Returns the public catalog fields needed by the storefront.
async function getProducts() {
  const products = await prisma.product.findMany({
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