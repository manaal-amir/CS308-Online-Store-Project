const prisma = require('../../config/prisma')

function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

async function getOrCreateWishList(userId) {
  return prisma.wishList.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
}

async function addToWishList(userId, productId) {
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) {
    throw httpError(404, 'Product not found')
  }

  const wishList = await getOrCreateWishList(userId)

  try {
    await prisma.wishListItem.create({
      data: { wishListId: wishList.id, productId },
    })
  } catch (err) {
    if (err.code === 'P2002') {
      throw httpError(409, 'Product already in wish list')
    }
    throw err
  }

  return { productId, added: true }
}

async function removeFromWishList(userId, productId) {
  const wishList = await prisma.wishList.findUnique({ where: { userId } })
  if (!wishList) {
    throw httpError(404, 'Product not in wish list')
  }

  const result = await prisma.wishListItem.deleteMany({
    where: { wishListId: wishList.id, productId },
  })
  if (result.count === 0) {
    throw httpError(404, 'Product not in wish list')
  }

  return { productId, removed: true }
}

async function getWishList(userId) {
  const wishList = await prisma.wishList.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              model: true,
              price: true,
              quantity: true,
              imageUrl: true,
              artist: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!wishList) {
    return { items: [] }
  }

  return {
    items: wishList.items.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      model: item.product.model,
      artist: item.product.artist?.name || null,
      price: Number(item.product.price),
      imageUrl: item.product.imageUrl,
      stock: item.product.quantity,
      addedAt: item.createdAt,
    })),
  }
}

module.exports = { addToWishList, removeFromWishList, getWishList }