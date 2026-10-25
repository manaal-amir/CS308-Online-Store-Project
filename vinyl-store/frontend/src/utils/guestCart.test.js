//tests for the guest cart helper
//they only use describe, it, expect and beforeEach, so they run in jest or vitest without changes
import {
  getGuestCart,
  getGuestCartCount,
  addToGuestCart,
  updateGuestCartItem,
  removeFromGuestCart,
  clearGuestCart,
  subscribeToGuestCart,
  mergeGuestCartAfterLogin,
  resetGuestCartForTests,
} from './guestCart';

const KEY = 'vinyl-store-guest-cart';

//a fake localStorage that keeps data in memory, so the tests do not need a browser
function fakeStorage() {
  const data = {};
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: (key) => { delete data[key]; },
  };
}

//a fake function that remembers how it was called and returns what it is given
function fakeFn(result) {
  const fn = (...args) => {
    fn.calls.push(args);
    return typeof result === 'function' ? result(...args) : result;
  };
  fn.calls = [];
  return fn;
}

//a fake fetch response like the browser returns
function response(ok, body) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

//replaces a global value in a way that also works in a browser-like test setup (jsdom)
function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

beforeEach(() => {
  resetGuestCartForTests();
  setGlobal('localStorage', fakeStorage());
  setGlobal('fetch', undefined);
  //plain node has no window, so add an object that can send and receive events like one
  if (typeof globalThis.window === 'undefined') {
    setGlobal('window', new EventTarget());
  }
});

describe('guest cart', () => {
  //test 1: a new visitor starts with an empty cart
  it('starts empty', () => {
    expect(getGuestCart()).toEqual([]);
    expect(getGuestCartCount()).toBe(0);
  });

  //test 2: adding saves the product and adding again increases the quantity
  it('adds products and increases existing ones', () => {
    addToGuestCart(3, 1, 5);
    addToGuestCart(3, 2, 5);
    addToGuestCart(7, 1, 2);
    expect(getGuestCart()).toEqual([{ productId: 3, quantity: 3 }, { productId: 7, quantity: 1 }]);
    expect(getGuestCartCount()).toBe(4);
  });

  //test 3: out of stock products cannot be added
  it('rejects out of stock products', () => {
    expect(() => addToGuestCart(3, 1, 0)).toThrow('Product is out of stock');
  });

  //test 4: the cart can never hold more than the stock
  it('rejects going above stock', () => {
    addToGuestCart(3, 2, 3);
    expect(() => addToGuestCart(3, 2, 3)).toThrow('Only 3 in stock');
    expect(getGuestCart()).toEqual([{ productId: 3, quantity: 2 }]);
  });

  //test 5: invalid ids or quantities are rejected
  it('rejects invalid input', () => {
    expect(() => addToGuestCart('3', 1, 5)).toThrow('Invalid product or quantity');
    expect(() => addToGuestCart(3, 0, 5)).toThrow('Invalid product or quantity');
    expect(() => updateGuestCartItem('3', 1)).toThrow('Invalid product or quantity');
    expect(() => removeFromGuestCart(-1)).toThrow('Invalid product');
  });

  //test 6: updating sets an exact quantity and 0 removes the item
  it('updates quantities and removes at 0', () => {
    addToGuestCart(3, 1, 5);
    updateGuestCartItem(3, 4, 5);
    expect(getGuestCart()).toEqual([{ productId: 3, quantity: 4 }]);
    updateGuestCartItem(3, 0, 5);
    expect(getGuestCart()).toEqual([]);
  });

  //test 7: updating above stock or a missing item is rejected
  it('rejects bad updates', () => {
    addToGuestCart(3, 1, 5);
    expect(() => updateGuestCartItem(3, 6, 5)).toThrow('Only 5 in stock');
    expect(() => updateGuestCartItem(9, 1, 5)).toThrow('Item is not in the cart');
  });

  //test 8: remove and clear empty the cart, and clear deletes the saved key
  it('removes and clears items', () => {
    addToGuestCart(3, 1, 5);
    addToGuestCart(7, 1, 5);
    removeFromGuestCart(3);
    expect(getGuestCart()).toEqual([{ productId: 7, quantity: 1 }]);
    clearGuestCart();
    expect(getGuestCart()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  //test 9: broken or hand edited saved data does not crash the page
  it('cleans broken saved data and combines duplicates', () => {
    localStorage.setItem(KEY, 'not json');
    expect(getGuestCart()).toEqual([]);
    localStorage.setItem(KEY, JSON.stringify([{ productId: 3, quantity: 1 }, { productId: 'x' }, { productId: 3, quantity: 2 }]));
    expect(getGuestCart()).toEqual([{ productId: 3, quantity: 3 }]);
  });

  //test 10: with no localStorage at all, the cart still works for the current visit
  it('keeps the cart in memory when storage is not available', () => {
    setGlobal('localStorage', undefined);
    addToGuestCart(3, 1, 5);
    addToGuestCart(3, 1, 5);
    expect(getGuestCart()).toEqual([{ productId: 3, quantity: 2 }]);
  });

  //test 11: if saving fails (e.g. storage is full), the cart is kept in memory
  it('falls back to memory when saving fails', () => {
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    addToGuestCart(3, 1, 5);
    expect(getGuestCart()).toEqual([{ productId: 3, quantity: 1 }]);
  });
});

describe('subscribeToGuestCart', () => {
  //test 12: listeners hear about changes and stop after unsubscribing
  it('calls the listener on every change until unsubscribed', () => {
    const listener = fakeFn();
    const unsubscribe = subscribeToGuestCart(listener);
    addToGuestCart(3, 1, 5);
    expect(listener.calls).toEqual([[[{ productId: 3, quantity: 1 }]]]);
    unsubscribe();
    addToGuestCart(3, 1, 5);
    expect(listener.calls).toHaveLength(1);
  });

  //test 13: changes made in another tab are picked up
  it('reacts to changes from another tab', () => {
    const listener = fakeFn();
    const unsubscribe = subscribeToGuestCart(listener);
    localStorage.setItem(KEY, JSON.stringify([{ productId: 5, quantity: 2 }]));
    const event = new Event('storage');
    event.key = KEY;
    window.dispatchEvent(event);
    expect(listener.calls).toEqual([[[{ productId: 5, quantity: 2 }]]]);
    unsubscribe();
  });
});

describe('mergeGuestCartAfterLogin', () => {
  //test 14: an empty cart does not call the backend
  it('does nothing when the cart is empty', async () => {
    setGlobal('fetch', fakeFn());
    expect(await mergeGuestCartAfterLogin('token')).toBeNull();
    expect(globalThis.fetch.calls).toHaveLength(0);
  });

  //test 15: the cart is sent with the token and cleared on success
  it('sends the cart and clears it after a successful merge', async () => {
    addToGuestCart(3, 2, 5);
    const merged = { items: [], itemCount: 2, total: 100, adjustments: [] };
    setGlobal('fetch', fakeFn(() => response(true, merged)));

    const result = await mergeGuestCartAfterLogin('abc', 'http://localhost:3000');

    expect(globalThis.fetch.calls).toEqual([[
      'http://localhost:3000/api/cart/merge',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer abc' },
        body: JSON.stringify({ items: [{ productId: 3, quantity: 2 }] }),
      },
    ]]);
    expect(result).toEqual(merged);
    expect(getGuestCart()).toEqual([]);
  });

  //test 16: if the backend rejects the merge, the cart is kept and its message is shown
  it('keeps the cart and throws the backend error if the merge fails', async () => {
    addToGuestCart(3, 2, 5);
    setGlobal('fetch', fakeFn(() => response(false, { error: 'Invalid token' })));
    await expect(mergeGuestCartAfterLogin('bad')).rejects.toThrow('Invalid token');
    expect(getGuestCart()).toEqual([{ productId: 3, quantity: 2 }]);
  });

  //test 17: if the server cannot be reached, the cart is kept with a clear message
  it('keeps the cart when the server cannot be reached', async () => {
    addToGuestCart(3, 2, 5);
    setGlobal('fetch', fakeFn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(mergeGuestCartAfterLogin('abc')).rejects.toThrow('Could not reach the server, your cart was kept');
    expect(getGuestCart()).toEqual([{ productId: 3, quantity: 2 }]);
  });

  //test 18: two calls at the same moment only send the cart once
  it('sends the cart only once when called twice at the same time', async () => {
    addToGuestCart(3, 2, 5);
    setGlobal('fetch', fakeFn(() => response(true, { items: [], adjustments: [] })));
    const [first, second] = await Promise.all([mergeGuestCartAfterLogin('abc'), mergeGuestCartAfterLogin('abc')]);
    expect(globalThis.fetch.calls).toHaveLength(1);
    expect(second).toBe(first);
  });

  //test 19: items added while the request is running are not lost
  it('keeps items that were added during the merge', async () => {
    addToGuestCart(3, 2, 5);
    setGlobal('fetch', fakeFn(() => {
      //the user adds more while the request is on its way
      addToGuestCart(3, 1, 5);
      addToGuestCart(7, 1, 5);
      return response(true, { items: [], adjustments: [] });
    }));
    await mergeGuestCartAfterLogin('abc');
    expect(getGuestCart()).toEqual([{ productId: 3, quantity: 1 }, { productId: 7, quantity: 1 }]);
  });
});