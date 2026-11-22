
export function validateCheckout(form) {
  const errors = {};

  const cardHolder = form.cardHolder.trim();
  const cardNumber = form.cardNumber.replace(/\s/g, "");
  const month = Number(form.expiryMonth);
  const year = Number(form.expiryYear);
  const cvv = form.cvv.trim();

  if (!cardHolder) {
    errors.cardHolder = "Cardholder name is required.";
  }

  if (!/^\d{13,19}$/.test(cardNumber)) {
    errors.cardNumber = "Enter a valid card number (13–19 digits).";
  }

  if (
    !/^\d{1,2}$/.test(form.expiryMonth) ||
    month < 1 ||
    month > 12
  ) {
    errors.expiryMonth = "Enter a valid month (01–12).";
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (
    !/^\d{4}$/.test(form.expiryYear) ||
    year < currentYear ||
    year > currentYear + 20 ||
    (year === currentYear && month < currentMonth)
  ) {
    errors.expiryYear = "Enter a valid, unexpired year.";
  }

  if (!/^\d{3,4}$/.test(cvv)) {
    errors.cvv = "CVV must be 3 or 4 digits.";
  }

  return errors;
}
