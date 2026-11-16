import { AppData, SCHEMA_VERSION } from './types';
import { isDate } from './dates';
import { check } from './ops';

export const APP_ID = 'personal-finance-manager';

export function exportJson(data: AppData): string {
  return JSON.stringify({ app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data }, null, 2);
}

const isObj = (x: unknown): x is Record<string, any> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Kiểm tra cấu trúc, phiên bản và tính hợp lệ của file sao lưu. */
export function parseBackup(text: string): { ok: true; data: AppData } | { ok: false; errors: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ['File không phải JSON hợp lệ.'] }; }
  const errors: string[] = [];
  if (!isObj(raw) || raw.app !== APP_ID) return { ok: false, errors: ['File không phải bản sao lưu của ứng dụng này.'] };
  if (raw.schemaVersion !== SCHEMA_VERSION) return { ok: false, errors: [`Phiên bản dữ liệu ${String(raw.schemaVersion)} không được hỗ trợ (cần ${SCHEMA_VERSION}).`] };
  const d = raw.data;
  if (!isObj(d)) return { ok: false, errors: ['Thiếu phần dữ liệu (data).'] };
  const arr = (k: string) => { if (!Array.isArray(d[k])) errors.push(`Thiếu danh sách "${k}".`); return Array.isArray(d[k]); };
  if (typeof d.initialBalance !== 'number' || d.initialBalance < 0) errors.push('Dư ban đầu không hợp lệ.');
  for (const k of ['credit', 'cash']) {
    const c = d.debts?.[k];
    if (!isObj(c) || typeof c.rate !== 'number' || !['month', 'year'].includes(c.unit) || (c.start && !isDate(c.start)) || (c.end && !isDate(c.end))) errors.push(`Cấu hình lãi "${k}" không hợp lệ.`);
  }
  const ids = new Set<string>();
  const checkRec = (list: any[], name: string, fn: (x: any) => boolean) => {
    list.forEach((x, i) => {
      if (!isObj(x) || typeof x.id !== 'string' || !fn(x)) errors.push(`${name} #${i + 1} không hợp lệ.`);
      else if (ids.has(name + x.id)) errors.push(`${name} #${i + 1} trùng mã.`);
      else ids.add(name + x.id);
    });
  };
  const txOk = (x: any) => ['income', 'expense', 'repay'].includes(x.type) && isDate(x.date) && Number.isInteger(x.amount) && x.amount > 0 &&
    typeof x.createdAt === 'number' && (x.type !== 'expense' || ['balance', 'credit', 'cash'].includes(x.source)) && (x.type !== 'repay' || ['credit', 'cash'].includes(x.debt)) &&
    typeof x.category === 'string' && typeof x.content === 'string';
  if (arr('transactions')) checkRec(d.transactions, 'Giao dịch', txOk);
  if (arr('plans')) checkRec(d.plans, 'Dự kiến', (x) => txOk(x) && ['pending', 'confirmed', 'cancelled'].includes(x.status));
  if (arr('debtAdjustments')) checkRec(d.debtAdjustments, 'Điều chỉnh nợ', (x) => ['credit', 'cash'].includes(x.debt) && isDate(x.date) && Number.isFinite(x.delta) && typeof x.createdAt === 'number');
  if (arr('balanceAdjustments')) checkRec(d.balanceAdjustments, 'Điều chỉnh dư', (x) => isDate(x.date) && Number.isFinite(x.delta) && typeof x.createdAt === 'number');
  if (arr('history')) checkRec(d.history, 'Lịch sử', (x) => typeof x.at === 'number' && typeof x.description === 'string');
  if (!isObj(d.categories) || !Array.isArray(d.categories.income) || !Array.isArray(d.categories.expense)) errors.push('Danh mục không hợp lệ.');
  if (errors.length) return { ok: false, errors: errors.slice(0, 10) };
  const data = d as AppData;
  const e = check(data);
  if (e) return { ok: false, errors: ['Dữ liệu không nhất quán: ' + e] };
  return { ok: true, data };
}
