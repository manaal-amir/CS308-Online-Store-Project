//tests for the status update service with a fake database
jest.mock('../src/config/prisma', () => ({ $transaction: jest.fn() }))

const prisma = require('../src/config/prisma')
const { updateStatus } = require('../src/modules/orders/status.service')

let tx

beforeEach(() => {
  jest.resetAllMocks()
  tx = {
    order: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  }
  prisma.$transaction.mockImplementation((cb) => cb(tx))
})

describe('status service', () => {
  it('moves PROCESSING to IN_TRANSIT', async () => {
    tx.order.findUnique
      .mockResolvedValueOnce({ id: 42, status: 'PROCESSING' })
      .mockResolvedValueOnce({ id: 42, status: 'IN_TRANSIT', updatedAt: new Date() })
    tx.order.updateMany.mockResolvedValue({ count: 1 })

    const result = await updateStatus(42, 'IN_TRANSIT')
    expect(result.status).toBe('IN_TRANSIT')
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 42, status: 'PROCESSING' },
      data: { status: 'IN_TRANSIT' },
    })
  })

  it('moves IN_TRANSIT to DELIVERED', async () => {
    tx.order.findUnique
      .mockResolvedValueOnce({ id: 42, status: 'IN_TRANSIT' })
      .mockResolvedValueOnce({ id: 42, status: 'DELIVERED', updatedAt: new Date() })
    tx.order.updateMany.mockResolvedValue({ count: 1 })

    const result = await updateStatus(42, 'DELIVERED')
    expect(result.status).toBe('DELIVERED')
  })

  it('blocks IN_TRANSIT to PROCESSING', async () => {
    tx.order.findUnique.mockResolvedValue({ id: 42, status: 'IN_TRANSIT' })
    await expect(updateStatus(42, 'PROCESSING')).rejects.toMatchObject({ status: 409 })
    expect(tx.order.updateMany).not.toHaveBeenCalled()
  })

  it('blocks PROCESSING to DELIVERED (skips a step)', async () => {
    tx.order.findUnique.mockResolvedValue({ id: 42, status: 'PROCESSING' })
    await expect(updateStatus(42, 'DELIVERED')).rejects.toMatchObject({ status: 409 })
  })

  it('blocks CANCELLED as a target', async () => {
    tx.order.findUnique.mockResolvedValue({ id: 42, status: 'PROCESSING' })
    await expect(updateStatus(42, 'CANCELLED')).rejects.toMatchObject({ status: 409 })
  })

  it('blocks moves from DELIVERED', async () => {
    tx.order.findUnique.mockResolvedValue({ id: 42, status: 'DELIVERED' })
    await expect(updateStatus(42, 'IN_TRANSIT')).rejects.toMatchObject({ status: 409 })
  })

  it('blocks moves from CANCELLED', async () => {
    tx.order.findUnique.mockResolvedValue({ id: 42, status: 'CANCELLED' })
    await expect(updateStatus(42, 'IN_TRANSIT')).rejects.toMatchObject({ status: 409 })
  })

  it('returns 404 for a missing order', async () => {
    tx.order.findUnique.mockResolvedValue(null)
    await expect(updateStatus(999, 'IN_TRANSIT')).rejects.toMatchObject({ status: 404 })
  })

  it('returns 409 when the status changed between read and update (race with cancel)', async () => {
    tx.order.findUnique.mockResolvedValue({ id: 42, status: 'PROCESSING' })
    tx.order.updateMany.mockResolvedValue({ count: 0 })

    await expect(updateStatus(42, 'IN_TRANSIT')).rejects.toMatchObject({
      status: 409,
      message: 'Order status changed at the same time, please try again',
    })
  })
})