const prisma = require('../../config/prisma');
const { chargeCard } = require('./mockBank');
const { buildInvoice } = require('../invoices/invoice.service');
const { generatePdf } = require('../invoices/invoice.pdf');
const { sendInvoiceEmail } = require('../invoices/invoice.email');

//how long the checkout transaction may run before prisma cancels it (default is 5 seconds)
//when many customers buy the same record, each one waits for the previous to finish
const TRANSACTION_TIMEOUT_MS = 10000;

//creates an error with a status so the error handler sends the right response
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

//prices have 2 decimals, so all maths is done in whole cents
//this avoids results like 0.1 + 0.2 = 0.30000000000000004
function toCents(value) {
  return Math.round(Number(value) * 100);
}

//turns cents back into text like "12.50", which prisma saves exactly into a Decimal column
function toMoney(cents) {
  return (cents / 100).toFixed(2);
}

//cost of one unit for profit reports later, half the price if no cost was entered (requirement 11)
function unitCostCents(product) {
  if (product.cost !== null && product.cost !== undefined) {
    return toCents(product.cost);
  }
  return Math.round(toCents(product.price) / 2);
}

//turns the saved order into a simple object for the frontend
//card details are not in it because only the last 4 digits were ever saved
function formatOrder(order, invoiceNumber) {
  return {
    id: order.id,
    status: order.status,
    totalPrice: Number(order.totalPrice),
    deliveryAddress: order.deliveryAddress,
    cardLast4: order.cardLast4,
    createdAt: order.createdAt,
    invoiceNumber,
    items: order.items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: (toCents(item.unitPrice) * item.quantity) / 100,
    })),
  };
}

//creates the invoice and emails it as a pdf once (requirement 4)
//the order is already paid at this point, so a problem here is only logged instead of undoing the order
async function issueInvoice(order, userId) {
  let invoice;
  try {
    invoice = await buildInvoice(order.id, { id: userId, role: 'CUSTOMER' });
  } catch (err) {
    console.error(`[checkout] invoice for order ${order.id} failed: ${err.message}`);
    return null;
  }

  //the invoice exists now, so the customer can still see it on screen even if the email fails
  try {
    const pdf = await generatePdf(invoice);
    const email = await sendInvoiceEmail(invoice, pdf);
    //sendInvoiceEmail returns sent: false when smtp is not set up in .env
    //emailedAt is only saved when the email really went out, so it never claims a false send
    if (email && email.sent) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { emailedAt: new Date() } });
    }
  } catch (err) {
    //emailedAt stays empty, so the team can see which invoices were never emailed
    console.error(`[checkout] invoice email for order ${order.id} failed: ${err.message}`);
  }
  return invoice.invoiceNumber;
}

//removes the customer's cart items and returns exactly what was removed, in one step
//"delete ... returning" means the quantities used are the ones in the cart at that moment,
//even if the customer changed a quantity in another tab a second earlier
//a second checkout at the same moment (e.g. a double click) waits for the first one to finish,
//then finds nothing left to remove, so one cart can never become two orders
async function takeCartItems(tx, userId) {
  return tx.$queryRaw`
    DELETE FROM "CartItem"
    USING "Cart"
    WHERE "CartItem"."cartId" = "Cart"."id" AND "Cart"."userId" = ${userId}
    RETURNING "CartItem"."productId", "CartItem"."quantity"`;
}

//uses the address typed at checkout, otherwise the customer's home address
async function findDeliveryAddress(tx, userId, deliveryAddress) {
  if (deliveryAddress) {
    return deliveryAddress;
  }
  const user = await tx.user.findUnique({ where: { id: userId }, select: { homeAddress: true } });
  if (!user || !user.homeAddress) {
    throw httpError(400, 'deliveryAddress is required');
  }
  return user.homeAddress;
}

//turns the logged in customer's cart into a paid order
//only these card fields are used here, cvv and the card holder are checked by the route and dropped
//everything inside the transaction happens together or not at all:
//if stock runs out or the bank declines, the stock and the cart go back to how they were
async function checkout(userId, { cardNumber, expiryMonth, expiryYear, deliveryAddress }) {
  const order = await prisma.$transaction(async (tx) => {
    const cartItems = await takeCartItems(tx, userId);
    if (cartItems.length === 0) {
      throw httpError(400, 'Your cart is empty');
    }

    const address = await findDeliveryAddress(tx, userId, deliveryAddress);

    //load the products in the cart, keyed by id for quick lookup
    const products = await tx.product.findMany({
      where: { id: { in: cartItems.map((item) => item.productId) } },
    });
    const productsById = new Map(products.map((product) => [product.id, product]));

    //update products in id order, so two orders with the same products
    //always lock them in the same order and cannot block each other forever
    const items = [...cartItems].sort((a, b) => a.productId - b.productId);

    let totalCents = 0;
    const orderItems = [];
    for (const item of items) {
      const product = productsById.get(item.productId);
      //a product removed from the shop while it was in the cart
      if (!product) {
        throw httpError(409, 'A product in your cart is no longer available');
      }

      //decrease stock only if enough is left, the database checks and updates in one step
      //so two customers can never both buy the last copy (requirements 3 and 18)
      const updated = await tx.product.updateMany({
        where: { id: product.id, quantity: { gte: item.quantity } },
        data: { quantity: { decrement: item.quantity } },
      });
      if (updated.count === 0) {
        throw httpError(409, `Not enough stock for "${product.name}"`);
      }

      //price and cost are copied now, so later price changes or discounts do not change this order
      const unitPriceCents = toCents(product.price);
      totalCents += unitPriceCents * item.quantity;
      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: toMoney(unitPriceCents),
        unitCost: toMoney(unitCostCents(product)),
      });
    }

    //ask the mock bank last, if it declines everything above is rolled back (requirement 4)
    const payment = chargeCard({ cardNumber, expiryMonth, expiryYear });
    if (!payment.approved) {
      throw httpError(402, `Payment declined: ${payment.reason}`);
    }

    //save the order as PROCESSING, which puts it on the delivery list (requirement 3)
    //only the last 4 digits are kept, never the full number or cvv (requirement 17)
    return tx.order.create({
      data: {
        userId,
        status: 'PROCESSING',
        totalPrice: toMoney(totalCents),
        deliveryAddress: address,
        cardLast4: cardNumber.slice(-4),
        paymentRef: payment.bankRef,
        items: { create: orderItems },
        payment: {
          create: { amount: toMoney(totalCents), status: 'SUCCESSFUL', bankRef: payment.bankRef },
        },
      },
      include: { items: { include: { product: { select: { name: true } } } } },
    });
  }, { timeout: TRANSACTION_TIMEOUT_MS });

  const invoiceNumber = await issueInvoice(order, userId);
  return formatOrder(order, invoiceNumber);
}

module.exports = { checkout, toCents, toMoney, unitCostCents };
