const crypto = require('crypto');

//a pretend bank so checkout can be tested without real money (requirement 4)
//it approves or declines a card the same way a real bank answer would look

//card numbers testers can use to see each kind of answer
//all three pass the luhn check, so they look like real card numbers
const TEST_CARDS = {
  APPROVED: '4242424242424242',
  DECLINED: '4000000000000002',
  NO_FUNDS: '4000000000009995',
};

//luhn check: the standard checksum every real card number passes
//catches typos like one wrong or swapped digit
function passesLuhn(cardNumber) {
  let sum = 0;
  //go from the last digit to the first, doubling every second digit
  for (let i = 0; i < cardNumber.length; i += 1) {
    let digit = Number(cardNumber[cardNumber.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      //a doubled digit above 9 counts as the sum of its two digits, e.g. 16 -> 7
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

//a card works until the last day of its expiry month
function isExpired(expiryMonth, expiryYear, now) {
  const year = now.getFullYear();
  //getMonth() counts from 0, card months count from 1
  const month = now.getMonth() + 1;
  return expiryYear < year || (expiryYear === year && expiryMonth < month);
}

//asks the bank to take the payment
//returns { approved: true, bankRef } or { approved: false, reason }
//now can be passed in by tests so the expiry check does not depend on today's date
function chargeCard({ cardNumber, expiryMonth, expiryYear }, now = new Date()) {
  //real card numbers never start with 0, this also stops "0000000000000" which passes luhn
  if (cardNumber.startsWith('0') || !passesLuhn(cardNumber)) {
    return { approved: false, reason: 'Invalid card number' };
  }
  if (isExpired(expiryMonth, expiryYear, now)) {
    return { approved: false, reason: 'Card expired' };
  }
  if (cardNumber === TEST_CARDS.DECLINED) {
    return { approved: false, reason: 'Card declined' };
  }
  if (cardNumber === TEST_CARDS.NO_FUNDS) {
    return { approved: false, reason: 'Insufficient funds' };
  }

  //approved: the bank sends back a reference we keep instead of any card details
  return { approved: true, bankRef: `MOCK-${crypto.randomUUID()}` };
}

module.exports = { chargeCard, passesLuhn, TEST_CARDS };
