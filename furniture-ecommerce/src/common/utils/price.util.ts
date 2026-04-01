/**
 * calculates the total of a product, given its price and quantity
 */
export const calculateTotal = (price: number, quantity: number): string =>
  (price * quantity).toFixed(2);
