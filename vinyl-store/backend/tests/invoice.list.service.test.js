//service tests for listInvoices with a fake prisma
jest.mock('../src/config/prisma', () => ({
  invoice: { findMany: jest.fn() },
}))

const prisma = require('../src/config/prisma')
const { listInvoices } = require('../src/modules/invoices/invoice.service')

beforeEach(() => jest.resetAllMocks())

describe('listInvoices', () => {
  it('returns invoices newest first with customer and numeric total', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      {
        id: 1,
        invoiceNumber: 'INV-1',
        totalAmount: '1650.00',
        issuedAt: new Date('2026-11-20'),
        orderId: 10,
        order: { id: 10, user: { name: 'T', lastname: 'C', email: 't@x.com' } },
      },
    ])

    const result = await listInvoices({})

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 1,
      invoiceNumber: 'INV-1',
      totalAmount: 1650,
      issuedAt: new Date('2026-11-20'),
      orderId: 10,
      customer: { name: 'T', lastname: 'C', email: 't@x.com' },
    })
    expect(prisma.invoice.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { issuedAt: 'desc' },
      include: expect.any(Object),
    })
  })

  it('filters by date range when from/to are given', async () => {
    prisma.invoice.findMany.mockResolvedValue([])
    await listInvoices({ from: '2026-11-01', to: '2026-12-31' })
    expect(prisma.invoice.findMany).toHaveBeenCalledWith({
      where: {
        issuedAt: {
          gte: new Date('2026-11-01'),
          lte: new Date('2026-12-31'),
        },
      },
      orderBy: { issuedAt: 'desc' },
      include: expect.any(Object),
    })
  })

  it('returns an empty array when there are no invoices', async () => {
    prisma.invoice.findMany.mockResolvedValue([])
    const result = await listInvoices({})
    expect(result).toEqual([])
  })
})