//guest cart helper: keeps a logged out visitor's cart in the browser (localStorage)
//it has no react code, so it works with any frontend setup
//only product ids and quantities are saved, names and prices should be loaded fresh
//from the products api when the cart is shown, because prices can change

//the key the cart is saved under in localStorage
const STORAGE_KEY = 'vinyl-store-guest-cart';

//the event sent on window whenever this tab changes the cart
const CHANGE_EVENT = 'guest-cart-changed';

//same limit as the backend merge endpoint
const MAX_ITEMS = 100;

//copy of the cart in memory, used when the browser blocks or fills up localStorage
let memoryCart = [];
//turns false once localStorage fails, from then on only the memory copy is used
let storageWorks = true;
//the merge request that is currently running, so a second call does not send the cart twice
let mergeInProgress = null;

//returns the browser's storage, or null if it is not available (e.g. some private modes)
function storage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

//checks that a value is a whole number above 0
function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

//keeps only valid entries and combines the same product if it appears twice
function cleanItems(raw) {
  if (!Array.isArray(raw)) return [];
  const combined = new Map();
  for (const item of raw) {
    if (item && isPositiveInt(item.productId) && isPositiveInt(item.quantity)) {
      combined.set(item.productId, (combined.get(item.productId) || 0) + item.quantity);
    }
  }
  return [...combined].map(([productId, quantity]) => ({ productId, quantity }));
}

//reads the saved cart, returns null if localStorage cannot be used
function readStorage() {
  const store = storage();
  if (!store || !storageWorks) return null;

  let text;
  try {
    text = store.getItem(STORAGE_KEY);
  } catch {
    storageWorks = false;
    return null;
  }
  if (text === null) return [];

  try {
    return JSON.parse(text);
  } catch {
    //the saved data is broken, start again with an empty cart
    return [];
  }
}

//tells the rest of the page (e.g. a cart badge) that the cart changed
function notifyChange() {
  const target = globalThis.window;
  if (target && typeof target.dispatchEvent === 'function') {
    target.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

//saves the cart to localStorage (or memory if that fails), tells listeners, and returns it
function saveGuestCart(items) {
  memoryCart = items.map((item) => ({ ...item }));

  const store = storage();
  if (store && storageWorks) {
    try {
      if (items.length === 0) {
        store.removeItem(STORAGE_KEY);
      } else {
        store.setItem(STORAGE_KEY, JSON.stringify(items));
      }
    } catch {
      //storage is full or blocked, keep using the memory copy for the rest of the visit
      storageWorks = false;
    }
  }

  notifyChange();
  return getGuestCart();
}

//reads the cart as a list of { productId, quantity }
export function getGuestCart() {
  const saved = readStorage();
  return cleanItems(saved === null ? memoryCart : saved);
}

//total number of copies in the cart, e.g. for a cart badge in the navbar
export function getGuestCartCount() {
  return getGuestCart().reduce((sum, item) => sum + item.quantity, 0);
}

//adds a product, or increases its quantity if it is already in the cart
//stock is the product's quantity in stock from the products api
//throws an Error with a message the page can show if it cannot be added
export function addToGuestCart(productId, quantity = 1, stock) {
  if (!isPositiveInt(productId) || !isPositiveInt(quantity)) {
    throw new Error('Invalid product or quantity');
  }
  //out of stock products cannot be added (requirement 7)
  if (!Number.isInteger(stock) || stock <= 0) {
    throw new Error('Product is out of stock');
  }

  const items = getGuestCart();
  const existing = items.find((item) => item.productId === productId);
  const newQuantity = (existing ? existing.quantity : 0) + quantity;

  //the cart can never hold more than the stock
  if (newQuantity > stock) {
    throw new Error(`Only ${stock} in stock`);
  }

  if (existing) {
    existing.quantity = newQuantity;
  } else {
    if (items.length >= MAX_ITEMS) {
      throw new Error(`The cart can hold at most ${MAX_ITEMS} different products`);
    }
    items.push({ productId, quantity: newQuantity });
  }
  return saveGuestCart(items);
}

//sets a product's quantity to an exact number, 0 removes it
//stock is optional here, pass it when the page knows it
export function updateGuestCartItem(productId, quantity, stock) {
  if (!isPositiveInt(productId) || !Number.isInteger(quantity) || quantity < 0) {
    throw new Error('Invalid product or quantity');
  }
  if (quantity === 0) {
    return removeFromGuestCart(productId);
  }
  if (Number.isInteger(stock) && quantity > stock) {
    throw new Error(`Only ${stock} in stock`);
  }

  const items = getGuestCart();
  const existing = items.find((item) => item.productId === productId);
  if (!existing) {
    throw new Error('Item is not in the cart');
  }
  existing.quantity = quantity;
  return saveGuestCart(items);
}

//removes a product from the cart
export function removeFromGuestCart(productId) {
  if (!isPositiveInt(productId)) {
    throw new Error('Invalid product');
  }
  return saveGuestCart(getGuestCart().filter((item) => item.productId !== productId));
}

//empties the cart
export function clearGuestCart() {
  return saveGuestCart([]);
}

//calls callback(cart) whenever the cart changes, in this tab or in another open tab
//returns a function that stops listening, e.g. for react:
//useEffect(() => subscribeToGuestCart(setCart), []);
export function subscribeToGuestCart(callback) {
  const target = globalThis.window;
  if (!target || typeof target.addEventListener !== 'function') {
    return () => {};
  }

  const onChange = () => callback(getGuestCart());
  //the browser sends a "storage" event when another tab changes localStorage
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };

  target.addEventListener(CHANGE_EVENT, onChange);
  target.addEventListener('storage', onStorage);
  return () => {
    target.removeEventListener(CHANGE_EVENT, onChange);
    target.removeEventListener('storage', onStorage);
  };
}

//sends the cart to the backend and removes what was sent from the browser cart
async function sendMerge(token, apiBaseUrl) {
  const sent = getGuestCart();
  if (sent.length === 0) return null;

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: sent }),
    });
  } catch {
    //no internet or the server is down, the guest cart is kept
    throw new Error('Could not reach the server, your cart was kept');
  }

  //the backend sends errors as { error: '...' }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Could not save your cart');
  }

  //the sent items now live in the database, so take them out of the browser cart
  //anything added while the request was running stays
  const left = getGuestCart()
    .map((item) => {
      const sentItem = sent.find((s) => s.productId === item.productId);
      return { ...item, quantity: item.quantity - (sentItem ? sentItem.quantity : 0) };
    })
    .filter((item) => item.quantity > 0);
  saveGuestCart(left);

  return data;
}

//call this right after a successful login (requirement 4)
//sends the guest cart to POST /api/cart/merge so it is saved to the user's account
//token is the jwt from the login response, apiBaseUrl is e.g. 'http://localhost:3000'
//returns the merged cart from the backend, or null if the guest cart was empty
//the response includes "adjustments", products that were capped or skipped, so the page can tell the user
//if it fails, the guest cart is kept so it can be tried again
//calling it twice at once (e.g. react strict mode runs effects twice) only sends the cart once
export function mergeGuestCartAfterLogin(token, apiBaseUrl = '') {
  if (!mergeInProgress) {
    mergeInProgress = sendMerge(token, apiBaseUrl).finally(() => {
      mergeInProgress = null;
    });
  }
  return mergeInProgress;
}

//only for tests: resets the memory copy and flags so every test starts fresh
export function resetGuestCartForTests() {
  memoryCart = [];
  storageWorks = true;
  mergeInProgress = null;
}