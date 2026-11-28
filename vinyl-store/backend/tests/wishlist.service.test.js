jest.mock('../src/config/prisma', () => ({
  product: { findUnique: jest.fn() },
  wishList: { upsert: jest.fn(), findUnique: jest.fn() },
  wishListItem: { create: jest.fn(), deleteMany: jest.fn() },
}));

const prisma = require('../src/config/prisma');
const {
  addToWishList,
  removeFromWishList,
  getWishList,
} = require('../src/modules/wishlist/wishlist.service');

beforeEach(() => jest.resetAllMocks());

const product = {
  id: 7,
  name: 'L.A. Woman',
  model: 'Reissue',
  price: '1650.00',
  quantity: 8,
  imageUrl: null,
  artist: { name: 'The Doors' },
};

describe('wishlist service', () => {
  it('adds a product to the wish list', async () => {
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.wishList.upsert.mockResolvedValue({ id: 10, userId: 1 });
    prisma.wishListItem.create.mockResolvedValue({ id: 100 });

    const result = await addToWishList(1, 7);
    expect(result).toEqual({ productId: 7, added: true });
    expect(prisma.wishListItem.create).toHaveBeenCalledWith({
      data: { wishListId: 10, productId: 7 },
    });
  });

  it('returns 404 if the product does not exist', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(addToWishList(1, 999)).rejects.toMatchObject({ status: 404 });
    expect(prisma.wishListItem.create).not.toHaveBeenCalled();
  });

  it('returns 409 on a duplicate add (P2002)', async () => {
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.wishList.upsert.mockResolvedValue({ id: 10 });
    prisma.wishListItem.create.mockRejectedValue({ code: 'P2002' });

    await expect(addToWishList(1, 7)).rejects.toMatchObject({ status: 409 });
  });

  it('removes a product from the wish list', async () => {
    prisma.wishList.findUnique.mockResolvedValue({ id: 10 });
    prisma.wishListItem.deleteMany.mockResolvedValue({ count: 1 });

    const result = await removeFromWishList(1, 7);
    expect(result).toEqual({ productId: 7, removed: true });
  });

  it('returns 404 when removing something not in the list', async () => {
    prisma.wishList.findUnique.mockResolvedValue({ id: 10 });
    prisma.wishListItem.deleteMany.mockResolvedValue({ count: 0 });

    await expect(removeFromWishList(1, 7)).rejects.toMatchObject({ status: 404 });
  });

  it('returns an empty list when the user has no wish list', async () => {
    prisma.wishList.findUnique.mockResolvedValue(null);
    const result = await getWishList(1);
    expect(result).toEqual({ items: [] });
  });

  it('returns the wish list with product details', async () => {
    prisma.wishList.findUnique.mockResolvedValue({
      id: 10,
      items: [{ productId: 7, createdAt: new Date('2026-11-20'), product }],
    });

    const result = await getWishList(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      productId: 7,
      name: 'L.A. Woman',
      artist: 'The Doors',
      price: 1650,
      stock: 8,
    });
  });
});

//SCRUM-158 (requirement 12): records removed by a product manager
describe('wishlist with hidden records', () => {
  //test 1: adding a removed record is the same as adding one that does not exist
  it('returns 404 when adding a hidden record', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(addToWishList(1, 7)).rejects.toMatchObject({
      status: 404,
      message: 'Product not found',
    });
    expect(prisma.product.findUnique).toHaveBeenCalledWith({ where: { id: 7, isHidden: false } });
    expect(prisma.wishListItem.create).not.toHaveBeenCalled();
  });

  //test 2: the list only loads items whose record is not hidden, the rows themselves are kept
  it('leaves hidden records out of the list', async () => {
    prisma.wishList.findUnique.mockResolvedValue({ id: 10, items: [] });

    await getWishList(1);

    const { items } = prisma.wishList.findUnique.mock.calls[0][0].include;
    expect(items.where).toEqual({ product: { isHidden: false } });
    expect(prisma.wishListItem.deleteMany).not.toHaveBeenCalled();
  });

  //test 3: a hidden record can still be taken out of the wish list
  it('still removes a hidden record from the wish list', async () => {
    prisma.wishList.findUnique.mockResolvedValue({ id: 10, userId: 1 });
    prisma.wishListItem.deleteMany.mockResolvedValue({ count: 1 });

    expect(await removeFromWishList(1, 7)).toEqual({ productId: 7, removed: true });
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });
});
