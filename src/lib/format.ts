const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
export const fmtNum = (n: number) => nf.format(Math.round(n));
export const fmt = (n: number) => `${fmtNum(n)} ₫`;
export const parseMoney = (s: string) => {
  const d = s.replace(/[^\d]/g, '');
  return d ? Number(d) : 0;
};
