//tests for the pretend bank used at checkout
const { chargeCard, passesLuhn, TEST_CARDS } = require('../src/modules/orders/mockBank');

//a fixed "today" so the expiry tests do not depend on when they run (15 june 2027)
const now = new Date(2027, 5, 15);
const validExpiry = { expiryMonth: 12, expiryYear: 2030 };

describe('mock bank', () => {
  //test 1: a normal valid card is approved and gets a bank reference
  it('approves a valid card', () => {
    const result = chargeCard({ cardNumber: TEST_CARDS.APPROVED, ...validExpiry }, now);
    expect(result.approved).toBe(true);
    expect(result.bankRef).toMatch(/^MOCK-/);
  });

  //test 2: each payment gets its own reference
  it('gives every payment a different reference', () => {
    const first = chargeCard({ cardNumber: TEST_CARDS.APPROVED, ...validExpiry }, now);
    const second = chargeCard({ cardNumber: TEST_CARDS.APPROVED, ...validExpiry }, now);
    expect(first.bankRef).not.toBe(second.bankRef);
  });

  //test 3: a number with a typo fails the luhn check
  it('declines a card number that fails the luhn check', () => {
    expect(passesLuhn('4242424242424241')).toBe(false);
    const result = chargeCard({ cardNumber: '4242424242424241', ...validExpiry }, now);
    expect(result).toEqual({ approved: false, reason: 'Invalid card number' });
  });

  //test 4: numbers starting with 0 are not real cards, even "0000000000000" which passes luhn
  it('declines a card number starting with 0', () => {
    expect(passesLuhn('0000000000000')).toBe(true);
    const result = chargeCard({ cardNumber: '0000000000000', ...validExpiry }, now);
    expect(result).toEqual({ approved: false, reason: 'Invalid card number' });
  });

  //test 5: the two special test cards are declined with their reasons
  it('declines the test cards for declined and insufficient funds', () => {
    expect(chargeCard({ cardNumber: TEST_CARDS.DECLINED, ...validExpiry }, now)).toEqual({
      approved: false,
      reason: 'Card declined',
    });
    expect(chargeCard({ cardNumber: TEST_CARDS.NO_FUNDS, ...validExpiry }, now)).toEqual({
      approved: false,
      reason: 'Insufficient funds',
    });
  });

  //test 6: a card that expired last month is declined
  it('declines an expired card', () => {
    const result = chargeCard(
      { cardNumber: TEST_CARDS.APPROVED, expiryMonth: 5, expiryYear: 2027 },
      now
    );
    expect(result).toEqual({ approved: false, reason: 'Card expired' });
  });

  //test 7: a card expiring this month still works until the month ends
  it('accepts a card that expires this month', () => {
    const result = chargeCard(
      { cardNumber: TEST_CARDS.APPROVED, expiryMonth: 6, expiryYear: 2027 },
      now
    );
    expect(result.approved).toBe(true);
  });
});
