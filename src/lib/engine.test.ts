import { describe, it, expect } from 'vitest';
import { compute } from './engine';
import * as ops from './ops';
import { emptyData, AppData, TxFields } from './types';
import { exportJson, parseBackup } from './backup';

const T = '2026-06-30';
const f = (o: Partial<TxFields>): TxFields => ({ type: 'income', kind: 'regular', date: '2026-01-01', amount: 1000, category: 'x', content: 'c', ...o });
const must = (r: ops.Result): AppData => { if (!r.ok) throw new Error(r.error); return r.data; };
const withYear12 = (d: AppData) => must(ops.setDebtConfig(d, 'credit', { rate: 12, unit: 'year', start: '', end: '' }, T));

describe('số dư', () => {
  it('thu làm tăng số dư', () => {
    const d = must(ops.addTx(emptyData(), f({ amount: 5_000_000 }), T));
    expect(compute(d, T).balance).toBe(5_000_000);
  });
  it('chi từ số dư làm giảm số dư', () => {
    let d = must(ops.addTx(emptyData(), f({ amount: 5_000_000 }), T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'balance', amount: 2_000_000, date: '2026-01-02' }), T));
    expect(compute(d, T).balance).toBe(3_000_000);
  });
  it('chi vượt số dư bị từ chối', () => {
    const r = ops.addTx(emptyData(), f({ type: 'expense', source: 'balance', amount: 1 }), T);
    expect(r.ok).toBe(false);
  });
  it('dư ban đầu được tính vào', () => {
    const d = must(ops.setInitialBalance(emptyData(), 700, T));
    expect(compute(d, T).balance).toBe(700);
  });
});

describe('nợ', () => {
  it('chi từ nợ tăng nợ gốc, không giảm số dư', () => {
    let d = must(ops.addTx(emptyData(), f({ amount: 1000 }), T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'cash', amount: 400 }), T));
    const s = compute(d, T);
    expect(s.balance).toBe(1000);
    expect(s.debts.cash.principal).toBe(400);
    expect(s.debts.credit.principal).toBe(0);
  });
  it('trả nợ giảm số dư và nợ gốc (không lãi)', () => {
    let d = must(ops.addTx(emptyData(), f({ amount: 1000 }), T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'credit', amount: 600, date: '2026-01-02' }), T));
    d = must(ops.addTx(d, f({ type: 'repay', debt: 'credit', amount: 250, date: '2026-01-03' }), T));
    const s = compute(d, T);
    expect(s.balance).toBe(750);
    expect(s.debts.credit.principal).toBe(350);
    expect(s.debts.credit.actual).toBe(350);
  });
  it('trả vượt nợ bị từ chối', () => {
    let d = must(ops.addTx(emptyData(), f({ amount: 10_000 }), T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'credit', amount: 100, date: '2026-01-02' }), T));
    expect(ops.addTx(d, f({ type: 'repay', debt: 'credit', amount: 101, date: '2026-01-03' }), T).ok).toBe(false);
  });
  it('tổng nợ = tín dụng + tiền mặt', () => {
    let d = must(ops.addTx(emptyData(), f({ type: 'expense', source: 'credit', amount: 300 }), T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'cash', amount: 200 }), T));
    const s = compute(d, T);
    expect(s.totalPrincipal).toBe(500);
    expect(s.totalActual).toBe(500);
    expect(s.totalInterest).toBe(0);
  });
});

describe('lãi', () => {
  it('lãi đơn theo nhiều khoản nợ ở các ngày khác nhau (365 ngày/năm)', () => {
    let d = withYear12(emptyData());
    d = must(ops.addTx(d, f({ type: 'expense', source: 'credit', amount: 10_000_000, date: '2026-01-01' }), T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'credit', amount: 5_000_000, date: '2026-01-31' }), T));
    const s = compute(d, '2026-03-02');
    // 10tr*12%/365*30 = 98630 ; 15tr*12%/365*30 = 147945
    expect(s.debts.credit.accrued).toBe(98630 + 147945);
    expect(s.debts.credit.actual).toBe(15_000_000 + 98630 + 147945);
  });
  it('không tính lãi cho ngày phát sinh', () => {
    let d = withYear12(emptyData());
    d = must(ops.addTx(d, f({ type: 'expense', source: 'credit', amount: 1_000_000, date: '2026-01-01' }), T));
    expect(compute(d, '2026-01-01').debts.credit.accrued).toBe(0);
    expect(compute(d, '2026-01-02').debts.credit.accrued).toBe(Math.round((1_000_000 * 0.12) / 365));
  });
  it('lãi theo tháng = r*12/365 mỗi ngày', () => {
    let d = must(ops.setDebtConfig(emptyData(), 'cash', { rate: 1, unit: 'month', start: '', end: '' }, T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'cash', amount: 1_000_000, date: '2026-01-01' }), T));
    expect(compute(d, '2026-01-31').debts.cash.accrued).toBe(Math.round((1_000_000 * 0.01 * 12 * 30) / 365));
  });
  it('khoảng thời gian tính lãi giới hạn lãi', () => {
    let d = must(ops.setDebtConfig(emptyData(), 'credit', { rate: 12, unit: 'year', start: '2026-01-11', end: '2026-01-20' }, T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'credit', amount: 3_650_000, date: '2026-01-01' }), T));
    expect(compute(d, T).debts.credit.accrued).toBe(Math.round(3_650_000 * 0.12 / 365 * 10)); // 10 ngày
  });
  it('trả nợ trả lãi trước rồi mới giảm gốc; gốc giảm làm giảm cơ sở lãi', () => {
    let d = withYear12(emptyData());
    d = must(ops.addTx(d, f({ amount: 10_000_000 }), T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'credit', amount: 1_000_000, date: '2026-01-01' }), T));
    const lai = Math.round((1_000_000 * 0.12 * 30) / 365); // đến 31/01
    const r = must(ops.addTx(d, f({ type: 'repay', debt: 'credit', amount: lai + 100_000, date: '2026-01-31' }), T));
    const s = compute(r, '2026-01-31');
    const id = r.transactions.find((t) => t.type === 'repay')!.id;
    expect(s.allocations[id]).toEqual({ interest: lai, principal: 100_000 });
    expect(s.debts.credit.principal).toBe(900_000);
    expect(s.debts.credit.interestDue).toBe(0);
    // sau 10 ngày, lãi tính trên 900k
    expect(compute(r, '2026-02-10').debts.credit.accrued).toBe(lai + Math.round((900_000 * 0.12 * 10) / 365));
  });
  it('không cộng lãi chồng khi tính lại nhiều lần', () => {
    let d = withYear12(emptyData());
    d = must(ops.addTx(d, f({ type: 'expense', source: 'credit', amount: 1_000_000, date: '2026-01-01' }), T));
    expect(compute(d, T).debts.credit.actual).toBe(compute(d, T).debts.credit.actual);
    expect(compute(d, T).debts.credit.accrued).toBe(compute(JSON.parse(JSON.stringify(d)), T).debts.credit.accrued);
  });
  it('điều chỉnh thực nợ: không thấp hơn gốc, có lịch sử', () => {
    let d = must(ops.addTx(emptyData(), f({ type: 'expense', source: 'cash', amount: 1_000_000 }), T));
    expect(ops.setActualDebt(d, 'cash', 900_000, 'x', T).ok).toBe(false);
    d = must(ops.setActualDebt(d, 'cash', 1_200_000, 'Lãi thỏa thuận', T));
    const s = compute(d, T);
    expect(s.debts.cash.principal).toBe(1_000_000);
    expect(s.debts.cash.actual).toBe(1_200_000);
    expect(s.totalInterest).toBe(200_000);
    expect(d.debtAdjustments).toHaveLength(1);
    expect(d.history.length).toBeGreaterThan(0);
  });
  it('đổi lãi suất lưu lịch sử', () => {
    const d = withYear12(emptyData());
    expect(d.history).toHaveLength(1);
  });
});

describe('sửa / xóa giao dịch', () => {
  it('tính lại toàn bộ khi sửa và xóa', () => {
    let d = must(ops.addTx(emptyData(), f({ amount: 1000 }), T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'balance', amount: 300, date: '2026-01-02' }), T));
    const id = d.transactions[1].id;
    d = must(ops.updateTx(d, id, f({ type: 'expense', source: 'balance', amount: 500, date: '2026-01-02' }), T));
    expect(compute(d, T).balance).toBe(500);
    d = must(ops.deleteTx(d, id, T));
    expect(compute(d, T).balance).toBe(1000);
  });
  it('xóa khoản thu làm số dư âm thì bị từ chối', () => {
    let d = must(ops.addTx(emptyData(), f({ amount: 1000 }), T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'balance', amount: 800, date: '2026-01-02' }), T));
    expect(ops.deleteTx(d, d.transactions[0].id, T).ok).toBe(false);
  });
  it('giao dịch thực ở tương lai bị từ chối', () => {
    expect(ops.addTx(emptyData(), f({ date: '2026-12-01' }), T).ok).toBe(false);
  });
  it('cùng ngày: thu được xử lý trước chi', () => {
    let d = must(ops.addTx(emptyData(), f({ amount: 100, date: '2026-01-05' }), T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'balance', amount: 100, date: '2026-01-05' }), T));
    expect(compute(d, T).balance).toBe(0);
  });
});

describe('dự kiến', () => {
  const base = () => {
    let d = must(ops.addTx(emptyData(), f({ amount: 1000 }), T));
    d = must(ops.addPlan(d, f({ type: 'expense', source: 'balance', amount: 400, date: '2026-07-10' })));
    d = must(ops.addPlan(d, f({ type: 'income', amount: 200, date: '2026-07-20' })));
    return d;
  };
  it('khoản dự kiến không ảnh hưởng dữ liệu thực', () => {
    const d = base();
    expect(compute(d, T).balance).toBe(1000);
    expect(d.transactions).toHaveLength(1);
  });
  it('dư dự kiến theo trình tự thời gian đến ngày chọn', () => {
    const d = base();
    const pend = d.plans.filter((p) => p.status === 'pending');
    expect(compute(d, '2026-07-09', pend).balance).toBe(1000);
    expect(compute(d, '2026-07-10', pend).balance).toBe(600);
    expect(compute(d, '2026-07-31', pend).balance).toBe(800);
  });
  it('chi dự kiến từ nợ tăng nợ dự kiến, không giảm dư', () => {
    let d = must(ops.addPlan(base(), f({ type: 'expense', source: 'credit', amount: 300, date: '2026-07-12' })));
    const s = compute(d, '2026-07-31', d.plans);
    expect(s.debts.credit.principal).toBe(300);
    expect(s.balance).toBe(800);
  });
  it('xác nhận tạo giao dịch thực đúng một lần', () => {
    const d = base();
    const id = d.plans[0].id;
    const c = must(ops.confirmPlan(d, id, '2026-06-30', T));
    expect(c.transactions).toHaveLength(2);
    expect(c.plans[0].status).toBe('confirmed');
    expect(ops.confirmPlan(c, id, '2026-06-30', T).ok).toBe(false);
    expect(compute(c, T).balance).toBe(600);
  });
  it('khoản đã hủy không thể xác nhận', () => {
    const b = base();
    const d = must(ops.setPlanStatus(b, b.plans[0].id, 'cancelled'));
    expect(ops.confirmPlan(d, d.plans[0].id, '2026-06-30', T).ok).toBe(false);
  });
});

describe('sao lưu / khôi phục', () => {
  const sample = () => {
    let d = withYear12(emptyData());
    d = must(ops.addTx(d, f({ amount: 9000 }), T));
    d = must(ops.addTx(d, f({ type: 'expense', source: 'credit', amount: 500, date: '2026-01-05' }), T));
    return must(ops.addPlan(d, f({ type: 'income', amount: 5, date: '2026-08-01' })));
  };
  it('xuất rồi nhập khôi phục chính xác', () => {
    const d = sample();
    const r = parseBackup(exportJson(d));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual(d);
  });
  it('từ chối file sai cấu trúc / sai phiên bản', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup('{"app":"x"}').ok).toBe(false);
    const bad = JSON.parse(exportJson(sample()));
    bad.schemaVersion = 99;
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
    const bad2 = JSON.parse(exportJson(sample()));
    bad2.data.transactions[0].amount = -5;
    expect(parseBackup(JSON.stringify(bad2)).ok).toBe(false);
  });
  it('nhập gộp không trùng bản ghi', () => {
    const d = sample();
    const m = must(ops.mergeData(d, d, T));
    expect(m.transactions).toHaveLength(d.transactions.length);
    expect(m.plans).toHaveLength(d.plans.length);
  });
});
