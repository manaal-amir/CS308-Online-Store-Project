//tests for the checkout service with a fake database, so no docker is needed
//the real database test (checkout.db.test.js) checks customers buying at the same moment

//replace prisma with fake functions
jest.mock('../src/config/prisma', () => ({
  $transaction: jest.fn(),
  invoice: { update: jest.fn() },
}));

//replace the invoice helpers, they are tested in invoice.test.js
jest.mock('../src/modules/invoices/invoice.service', () => ({ buildInvoice: jest.fn() }));
jest.mock('../src/modules/invoices/invoice.pdf', () => ({ generatePdf: jest.fn() }));
jest.mock('../src/modules/invoices/invoice.email', () => ({ sendInvoiceEmail: jest.fn() }));

//replace the bank so each test decides if the payment is approved
jest.mock('../src/modules/orders/mockBank', () => ({ chargeCard: jest.fn() }));

const prisma = require('../src/config/prisma');
const { buildInvoice } = require('../src/modules/invoices/invoice.service');
const { generatePdf } = require('../src/modules/invoices/invoice.pdf');
const { sendInvoiceEmail } = require('../src/modules/invoices/invoice.email');
const { chargeCard } = require('../src/modules/orders/mockBank');
const { checkout, toMoney, unitCostCents } = require('../src/modules/orders/checkout.service');

//card details as they arrive after route validation
const card = {
  cardNumber: '4242424242424242',
  cardHolder: 'Test Customer',
  expiryMonth: 12,
  expiryYear: 2030,
  cvv: '123',
  deliveryAddress: 'Orta Mahalle, Tuzla, Istanbul',
};

//two products, one without a cost so the half price rule is used
const vinyl = { id: 5, name: 'Discovery', price: '1250.50', cost: '600.00' };
const player = { id: 2, name: 'Turntable', price: '4999.99', cost: null };

//rows the cart delete returns, higher product id first to check stock is updated in id order
const cartRows = [
  { productId: 5, quantity: 2 },
  { productId: 2, quantity: 1 },
];

//a fake transaction object, every test changes the parts it needs
let tx;

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});

  tx = {
    $queryRaw: jest.fn().mockResolvedValue(cartRows),
    user: { findUnique: jest.fn() },
    product: {
      findMany: jest.fn().mockResolvedValue([vinyl, player]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    //return the saved order the way prisma would, with product names on each item
    order: {
      create: jest.fn(async ({ data }) => ({
        id: 42,
        status: data.status,
        totalPrice: data.totalPrice,
        deliveryAddress: data.deliveryAddress,
        cardLast4: data.cardLast4,
        createdAt: new Date('2026-11-10T10:00:00Z'),
        items: data.items.create.map((item) => ({
          ...item,
          product: { name: item.productId === 5 ? vinyl.name : player.name },
        })),
      })),
    },
  };

  //run the transaction callback with the fake tx, like prisma does
  prisma.$transaction.mockImplementation((callback) => callback(tx));
  chargeCard.mockReturnValue({ approved: true, bankRef: 'MOCK-abc' });
  buildInvoice.mockResolvedValue({ id: 3, invoiceNumber: 'INV-20261110-00042' });
  generatePdf.mockResolvedValue(Buffer.from('pdf'));
  sendInvoiceEmail.mockResolvedValue({ sent: true });
  prisma.invoice.update.mockResolvedValue({});
});

afterEach(() => {
  console.error.mockRestore();
});

describe('checkout service', () => {
  //test 1: a normal checkout saves the order with the right totals and returns it
  it('creates a paid order from the cart', async () => {
    const order = await checkout(7, card);

    //2 x 1250.50 + 1 x 4999.99 = 7500.99
    expect(order).toMatchObject({
      id: 42,
      status: 'PROCESSING',
      totalPrice: 7500.99,
      cardLast4: '4242',
      deliveryAddress: card.deliveryAddress,
      invoiceNumber: 'INV-20261110-00042',
    });
    expect(order.items).toEqual(
      expect.arrayContaining([
        { productId: 5, name: 'Discovery', quantity: 2, unitPrice: 1250.5, lineTotal: 2501 },
        { productId: 2, name: 'Turntable', quantity: 1, unitPrice: 4999.99, lineTotal: 4999.99 },
      ])
    );

    //the payment row is saved with the bank's reference
    const { data } = tx.order.create.mock.calls[0][0];
    expect(data.payment.create).toEqual({ amount: '7500.99', status: 'SUCCESSFUL', bankRef: 'MOCK-abc' });
    expect(data.paymentRef).toBe('MOCK-abc');
  });

  //test 2: only the last 4 digits are saved, never the full number, cvv or holder (requirement 17)
  it('never saves the full card number or cvv', async () => {
    await checkout(7, card);
    const saved = JSON.stringify(tx.order.create.mock.calls[0][0].data);
    expect(saved).not.toContain(card.cardNumber);
    expect(saved).not.toContain('cvv');
    expect(saved).not.toContain(card.cardHolder);
  });

  //test 3: the cart is taken for this user only, inside the transaction
  it('takes the cart items of the logged in user', async () => {
    await checkout(7, card);
    //a tagged sql query is called with the text parts first, then the values
    const [sqlParts, userId] = tx.$queryRaw.mock.calls[0];
    expect(sqlParts.join('?')).toContain('DELETE FROM "CartItem"');
    expect(sqlParts.join('?')).toContain('RETURNING');
    expect(userId).toBe(7);
  });

  //test 4: stock goes down with a check that enough is left, in product id order
  it('decreases stock only if enough is left, in product id order', async () => {
    await checkout(7, card);
    expect(tx.product.updateMany.mock.calls.map((call) => call[0])).toEqual([
      { where: { id: 2, quantity: { gte: 1 } }, data: { quantity: { decrement: 1 } } },
      { where: { id: 5, quantity: { gte: 2 } }, data: { quantity: { decrement: 2 } } },
    ]);
  });

  //test 5: prices and costs are copied into the order items, cost falls back to half the price
  it('copies the price and cost of each product', async () => {
    await checkout(7, card);
    const items = tx.order.create.mock.calls[0][0].data.items.create;
    expect(items).toEqual(
      expect.arrayContaining([
        { productId: 5, quantity: 2, unitPrice: '1250.50', unitCost: '600.00' },
        { productId: 2, quantity: 1, unitPrice: '4999.99', unitCost: '2500.00' },
      ])
    );
  });

  //test 6: an empty cart cannot be checked out, also what a double click's second request sees
  it('rejects an empty cart', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(checkout(7, card)).rejects.toMatchObject({ status: 400, message: 'Your cart is empty' });
    expect(chargeCard).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  //test 7: without a typed address the home address is used
  it('uses the home address when no delivery address is given', async () => {
    tx.user.findUnique.mockResolvedValue({ homeAddress: 'Home Street 1' });
    const order = await checkout(7, { ...card, deliveryAddress: undefined });
    expect(order.deliveryAddress).toBe('Home Street 1');
  });

  //test 8: no typed address and no home address is an error
  it('rejects a checkout with no address at all', async () => {
    tx.user.findUnique.mockResolvedValue({ homeAddress: null });
    await expect(checkout(7, { ...card, deliveryAddress: '' })).rejects.toMatchObject({
      status: 400,
      message: 'deliveryAddress is required',
    });
  });

  //test 9: if a product ran out, the whole order stops and nothing is charged
  it('rejects the order when a product ran out', async () => {
    tx.product.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await expect(checkout(7, card)).rejects.toMatchObject({
      status: 409,
      message: 'Not enough stock for "Discovery"',
    });
    expect(chargeCard).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  //test 10: a product that was removed from the shop stops the order
  it('rejects the order when a product no longer exists', async () => {
    tx.product.findMany.mockResolvedValue([vinyl]);
    await expect(checkout(7, card)).rejects.toMatchObject({ status: 409 });
    expect(chargeCard).not.toHaveBeenCalled();
  });

  //test 11: a declined card stops the order, the transaction rolls back stock and cart
  it('rejects the order when the bank declines', async () => {
    chargeCard.mockReturnValue({ approved: false, reason: 'Card declined' });
    await expect(checkout(7, card)).rejects.toMatchObject({
      status: 402,
      message: 'Payment declined: Card declined',
    });
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(sendInvoiceEmail).not.toHaveBeenCalled();
  });

  //test 12: only the card fields the bank needs are passed on
  it('sends the bank only the card number and expiry', async () => {
    await checkout(7, card);
    expect(chargeCard).toHaveBeenCalledWith({ cardNumber: card.cardNumber, expiryMonth: 12, expiryYear: 2030 });
  });

  //test 13: the transaction gets a longer timeout for busy moments
  it('runs inside one transaction with a timeout', async () => {
    await checkout(7, card);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 10000 });
  });

  //test 14: the invoice is created and emailed once after payment (requirement 4)
  it('creates and emails the invoice', async () => {
    await checkout(7, card);
    expect(buildInvoice).toHaveBeenCalledWith(42, { id: 7, role: 'CUSTOMER' });
    expect(sendInvoiceEmail).toHaveBeenCalledTimes(1);
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { emailedAt: expect.any(Date) },
    });
  });

  //test 15: a failed email does not undo a paid order
  it('still returns the order if the invoice email fails', async () => {
    sendInvoiceEmail.mockRejectedValue(new Error('smtp down'));
    const order = await checkout(7, card);
    expect(order.id).toBe(42);
    expect(order.invoiceNumber).toBeNull();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });
});

describe('checkout money helpers', () => {
  //test 16: cents are turned into exact 2 decimal text
  it('formats cents as money text', () => {
    expect(toMoney(750099)).toBe('7500.99');
    expect(toMoney(5)).toBe('0.05');
  });

  //test 17: missing cost means half the price, rounded to the nearest cent
  it('uses half the price when there is no cost', () => {
    expect(unitCostCents({ price: '10.01', cost: null })).toBe(501);
    expect(unitCostCents({ price: '10.00', cost: '3.25' })).toBe(325);
  });
});
