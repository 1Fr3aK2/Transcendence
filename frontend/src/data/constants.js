export const PAYOUT = 1.85;
export const WINDOW = 15;   // betting window, in seconds
export const MINUTE = 60;   // full round length, in seconds

export const fakePrices = {
  BTC: { price: 67423.51, high: 68100.00, low: 66800.00, volume: '24.3B' },
  ETH: { price: 3512.88,  high: 3580.00,  low: 3440.00,  volume: '9.1B' },
};

export const COINS = Object.keys(fakePrices);
