const prisma = require('../../config/prisma');

//most different products one merge request can send, stops someone sending a huge list
const MAX_MERGE_ITEMS = 100;

//largest number a postgres Int column can hold, bigger ids or quantities would crash prisma
const MAX_INT = 2147483647;

//creates an error with a status so the error handler sends the right response
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

//returns the user's cart, creating an empty one the first time they use it
async function getOrCreateCart(userId) {
  try {
    return await prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  } catch (err) {
    //P2002 means two requests tried to create this user's first cart at the same moment
    //the other request won, so just load the cart it created
    if (err.code !== 'P2002') throw err;
    return prisma.cart.findUnique({ where: { userId } });
  }
}

//turns prisma's cart (with items and products) into a simple object for the frontend
function formatCart(cart) {
  const items = cart.items.map((item) => {
    //prisma returns prices as Decimal objects, convert them to normal numbers
    const price = Number(item.product.price);
    return {
      productId: item.productId,
      name: item.product.name,
      artist: item.product.artist ? item.product.artist.name : null,
      imageUrl: item.product.imageUrl,
      price,
      quantity: item.quantity,
      stock: item.product.quantity,
      //price for this line, rounded to 2 decimals to avoid values like 2899.9999
      lineTotal: Math.round(price * item.quantity * 100) / 100,
    };
  });

  //add up all lines for the cart total
  const total = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return { items, itemCount, total };
}

//loads a cart by its id with items and product details, oldest items first
async function loadCart(cartId) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        orderBy: { id: 'asc' },
        include: { product: { include: { artist: true } } },
      },
    },
  });
  return formatCart(cart);
}

//returns the logged in user's cart
async function getCart(userId) {
  const cart = await getOrCreateCart(userId);
  return loadCart(cart.id);
}

//finds a product or throws 404
async function findProduct(productId) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw httpError(404, 'Product not found');
  }
  return product;
}

//increases an item's quantity only if the new total stays within stock
//the database checks and updates in one step, so two requests at the same time
//cannot both pass the check and push the cart above stock (requirement 18)
async function increaseWithinStock(cartId, productId, quantity, stock) {
  const result = await prisma.cartItem.updateMany({
    where: { cartId, productId, quantity: { lte: stock - quantity } },
    data: { quantity: { increment: quantity } },
  });
  //count is 1 if the item was updated, 0 if it is not in the cart or would go above stock
  return result.count === 1;
}

//adds a product to the cart, or increases its quantity if it is already there
async function addItem(userId, productId, quantity) {
  const product = await findProduct(productId);

  //out of stock products can still be viewed but not added (requirement 7)
  if (product.quantity === 0) {
    throw httpError(409, 'Product is out of stock');
  }
  const tooMany = httpError(409, `Only ${product.quantity} in stock`);
  if (quantity > product.quantity) {
    throw tooMany;
  }

  const cart = await getOrCreateCart(userId);

  //case 1: the product is already in the cart, increase it if stock allows
  if (await increaseWithinStock(cart.id, productId, quantity, product.quantity)) {
    return loadCart(cart.id);
  }

  //nothing was updated, so either the item is missing or the new total is too high
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });
  if (existing) {
    throw tooMany;
  }

  //case 2: the product is not in the cart yet, create it
  try {
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
  } catch (err) {
    //P2002 means another request created this item a moment ago (e.g. a double click)
    //in that case increase the item that now exists instead
    if (err.code !== 'P2002') throw err;
    if (!(await increaseWithinStock(cart.id, productId, quantity, product.quantity))) {
      throw tooMany;
    }
  }

  return loadCart(cart.id);
}

//sets an item's quantity to an exact number
async function updateItem(userId, productId, quantity) {
  const cart = await getOrCreateCart(userId);

  //load the item together with its product so stock can be checked in the same query
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
    include: { product: true },
  });
  if (!existing) {
    throw httpError(404, 'Item is not in the cart');
  }

  //stock may have changed since the item was added, so check again
  if (quantity > existing.product.quantity) {
    throw httpError(409, `Only ${existing.product.quantity} in stock`);
  }

  await prisma.cartItem.update({
    where: { id: existing.id },
    data: { quantity },
  });

  return loadCart(cart.id);
}

//removes an item from the cart
async function removeItem(userId, productId) {
  const cart = await getOrCreateCart(userId);

  //deleteMany does not throw when nothing matches, so check the count instead
  const result = await prisma.cartItem.deleteMany({
    where: { cartId: cart.id, productId },
  });
  if (result.count === 0) {
    throw httpError(404, 'Item is not in the cart');
  }

  return loadCart(cart.id);
}

//checks if a value is a whole number between 1 and the database limit
function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0 && value <= MAX_INT;
}

//checks the browser cart sent on login, throws 400 if the format is wrong
function checkMergeItems(items) {
  if (!Array.isArray(items)) {
    throw httpError(400, 'items must be a list');
  }
  if (items.length > MAX_MERGE_ITEMS) {
    throw httpError(400, `items can have at most ${MAX_MERGE_ITEMS} entries`);
  }
  for (const item of items) {
    if (!item || !isPositiveInt(item.productId) || !isPositiveInt(item.quantity)) {
      throw httpError(400, 'each item needs a positive integer productId and quantity');
    }
  }
}

//adds the guest's browser cart to their database cart after they log in (requirement 4)
//quantities are capped at stock, and missing or out of stock products are skipped
async function mergeCart(userId, items) {
  checkMergeItems(items);

  //the same product could appear twice in the browser cart, so add those up first
  const incoming = new Map();
  for (const item of items) {
    incoming.set(item.productId, (incoming.get(item.productId) || 0) + item.quantity);
  }

  const cart = await getOrCreateCart(userId);

  //load all the products and existing cart items in two queries instead of one per item
  const productIds = [...incoming.keys()];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const existingItems = await prisma.cartItem.findMany({
    where: { cartId: cart.id, productId: { in: productIds } },
  });

  //lists what could not be fully added, so the frontend can tell the user
  const adjustments = [];
  //collects the database changes so they can be saved together
  const writes = [];

  for (const productId of productIds) {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      adjustments.push({ productId, reason: 'Product not found' });
      continue;
    }
    if (product.quantity === 0) {
      adjustments.push({ productId, reason: 'Product is out of stock' });
      continue;
    }

    const existing = existingItems.find((i) => i.productId === productId);
    const wanted = (existing ? existing.quantity : 0) + incoming.get(productId);
    //never put more in the cart than is in stock
    const finalQuantity = Math.min(wanted, product.quantity);
    if (finalQuantity < wanted) {
      adjustments.push({ productId, reason: `Only ${product.quantity} in stock` });
    }

    writes.push(
      prisma.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId } },
        create: { cartId: cart.id, productId, quantity: finalQuantity },
        update: { quantity: finalQuantity },
      })
    );
  }

  //save all changes in one transaction: either every item is merged or none are
  await prisma.$transaction(writes);

  const merged = await loadCart(cart.id);
  return { ...merged, adjustments };
}

module.exports = { getCart, addItem, updateItem, removeItem, mergeCart };