import { AppData, DebtConfig, DebtKey, Plan, Tx } from './types';
import { dayNum, fmtDate } from './dates';
import { fmt } from './format';

export interface Segment { from: string; to: string; principal: number; days: number; dailyRate: number; interest: number }
export interface DebtState {
  principal: number; // nợ gốc (còn lại)
  accrued: number; // lãi phát sinh theo công thức
  adjusted: number; // điều chỉnh lãi thủ công (có lịch sử)
  paidInterest: number;
  paidPrincipal: number;
  interestDue: number; // lãi còn phải trả
  actual: number; // thực nợ = gốc + lãi còn phải trả
  segments: Segment[];
}
export interface Allocation { interest: number; principal: number }
export interface State {
  balance: number;
  debts: Record<DebtKey, DebtState>;
  totalPrincipal: number;
  totalInterest: number;
  totalActual: number;
  totalIncome: number;
  totalSpendBalance: number;
  totalRepaid: number;
  allocations: Record<string, Allocation>;
  series: { date: string; balance: number }[];
  errors: string[];
}

/** Lãi suất theo ngày (lãi đơn). Năm: r/365. Tháng: r*12/365. */
export function dailyRate(cfg: DebtConfig): number {
  if (!(cfg.rate > 0)) return 0;
  const r = cfg.rate / 100;
  return cfg.unit === 'year' ? r / 365 : (r * 12) / 365;
}
/** Số ngày tính lãi trong (from, to] giao với [start, end]. Ngày phát sinh khoản nợ không tính lãi. */
export function interestDays(from: string, to: string, cfg: DebtConfig): number {
  let lo = dayNum(from) + 1;
  let hi = dayNum(to);
  if (cfg.start) lo = Math.max(lo, dayNum(cfg.start));
  if (cfg.end) hi = Math.min(hi, dayNum(cfg.end));
  return Math.max(0, hi - lo + 1);
}

type EvKind = 'income' | 'balAdj' | 'draw' | 'spend' | 'repay' | 'debtAdj';
interface Ev { date: string; ord: number; created: number; id: string; k: EvKind; amount: number; debt?: DebtKey }

type TxLike = Pick<Tx, 'id' | 'type' | 'date' | 'amount' | 'source' | 'debt' | 'createdAt'>;
function txEv(t: TxLike): Ev {
  if (t.type === 'income') return { date: t.date, ord: 0, created: t.createdAt, id: t.id, k: 'income', amount: t.amount };
  if (t.type === 'repay') return { date: t.date, ord: 3, created: t.createdAt, id: t.id, k: 'repay', amount: t.amount, debt: t.debt };
  if (t.source === 'credit' || t.source === 'cash') return { date: t.date, ord: 1, created: t.createdAt, id: t.id, k: 'draw', amount: t.amount, debt: t.source };
  return { date: t.date, ord: 3, created: t.createdAt, id: t.id, k: 'spend', amount: t.amount };
}

interface Internal { principal: number; accrued: number; adj: number; paidI: number; paidP: number; last: string | null; segs: Segment[] }

/**
 * Tính lại toàn bộ trạng thái từ danh sách giao dịch (không cộng/trừ chồng).
 * Thứ tự trong cùng một ngày: thu & điều chỉnh dư tăng -> chi từ nợ -> điều chỉnh lãi -> chi từ số dư, trả nợ & điều chỉnh dư giảm.
 * `plans`: các khoản dự kiến được đưa vào mô phỏng (không bao giờ lấy từ data.plans một cách ngầm định).
 */
export function compute(data: AppData, asOf: string, plans: Plan[] = []): State {
  const evs: Ev[] = [];
  for (const t of data.transactions) if (t.date <= asOf) evs.push(txEv(t));
  for (const p of plans) if (p.date <= asOf) evs.push(txEv(p));
  for (const a of data.debtAdjustments) if (a.date <= asOf) evs.push({ date: a.date, ord: 2, created: a.createdAt, id: a.id, k: 'debtAdj', amount: a.delta, debt: a.debt });
  for (const a of data.balanceAdjustments) if (a.date <= asOf) evs.push({ date: a.date, ord: a.delta >= 0 ? 0 : 3, created: a.createdAt, id: a.id, k: 'balAdj', amount: a.delta });
  evs.sort((a, b) => a.date.localeCompare(b.date) || a.ord - b.ord || a.created - b.created || a.id.localeCompare(b.id));

  const errors: string[] = [];
  const err = (m: string) => { if (errors.length < 20) errors.push(m); };
  let balance = data.initialBalance;
  let totalIncome = 0, totalSpendBalance = 0, totalRepaid = 0;
  const allocations: Record<string, Allocation> = {};
  const series: { date: string; balance: number }[] = [];
  const mk = (): Internal => ({ principal: 0, accrued: 0, adj: 0, paidI: 0, paidP: 0, last: null, segs: [] });
  const S: Record<DebtKey, Internal> = { credit: mk(), cash: mk() };

  const accrue = (k: DebtKey, to: string) => {
    const s = S[k];
    if (s.last !== null && s.principal > 0 && to > s.last) {
      const cfg = data.debts[k];
      const days = interestDays(s.last, to, cfg);
      const dr = dailyRate(cfg);
      if (days > 0 && dr > 0) {
        const interest = Math.round(s.principal * dr * days);
        s.accrued += interest;
        s.segs.push({ from: s.last, to, principal: s.principal, days, dailyRate: dr, interest });
      }
    }
    s.last = to;
  };
  const due = (s: Internal) => s.accrued + s.adj - s.paidI;

  for (const e of evs) {
    accrue('credit', e.date);
    accrue('cash', e.date);
    switch (e.k) {
      case 'income': balance += e.amount; totalIncome += e.amount; break;
      case 'balAdj': balance += e.amount; break;
      case 'draw': S[e.debt!].principal += e.amount; break;
      case 'spend':
        balance -= e.amount; totalSpendBalance += e.amount; break;
      case 'repay': {
        const s = S[e.debt!];
        const interestPart = Math.min(e.amount, Math.max(0, due(s)));
        const principalPart = e.amount - interestPart;
        if (principalPart > s.principal) err(`Ngày ${fmtDate(e.date)}: trả nợ ${fmt(e.amount)} vượt quá thực nợ (gốc ${fmt(s.principal)} + lãi ${fmt(Math.max(0, due(s)))}).`);
        s.paidI += interestPart;
        s.paidP += principalPart;
        s.principal -= principalPart;
        balance -= e.amount;
        totalRepaid += e.amount;
        allocations[e.id] = { interest: interestPart, principal: principalPart };
        break;
      }
      case 'debtAdj': {
        const s = S[e.debt!];
        s.adj += e.amount;
        if (due(s) < 0) err(`Ngày ${fmtDate(e.date)}: điều chỉnh làm thực nợ thấp hơn nợ gốc.`);
        break;
      }
    }
    if (e.k !== 'draw' && e.k !== 'debtAdj') {
      if (balance < 0) err(`Ngày ${fmtDate(e.date)}: số dư không đủ (thiếu ${fmt(-balance)}).`);
      series.push({ date: e.date, balance });
    }
  }
  accrue('credit', asOf);
  accrue('cash', asOf);

  const fin = (s: Internal): DebtState => {
    const d = Math.max(0, due(s));
    return { principal: s.principal, accrued: s.accrued, adjusted: s.adj, paidInterest: s.paidI, paidPrincipal: s.paidP, interestDue: d, actual: s.principal + d, segments: s.segs };
  };
  const debts = { credit: fin(S.credit), cash: fin(S.cash) };
  const dedup: { date: string; balance: number }[] = [];
  for (const p of series) {
    if (dedup.length && dedup[dedup.length - 1].date === p.date) dedup[dedup.length - 1] = p;
    else dedup.push({ ...p });
  }
  const totalPrincipal = debts.credit.principal + debts.cash.principal;
  const totalActual = debts.credit.actual + debts.cash.actual;
  return { balance, debts, totalPrincipal, totalInterest: totalActual - totalPrincipal, totalActual, totalIncome, totalSpendBalance, totalRepaid, allocations, series: dedup, errors };
}
