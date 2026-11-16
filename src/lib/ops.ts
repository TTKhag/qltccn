import { AppData, DebtKey, Plan, Tx, TxFields, uid, DEBT_LABEL } from './types';
import { compute } from './engine';
import { isDate, todayStr } from './dates';
import { fmt } from './format';

export type Result = { ok: true; data: AppData } | { ok: false; error: string };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function validateFields(f: TxFields): string | null {
  if (!isDate(f.date)) return 'Ngày không hợp lệ.';
  if (!Number.isFinite(f.amount) || f.amount <= 0 || !Number.isInteger(f.amount)) return 'Số tiền phải là số nguyên dương.';
  if (!f.content.trim()) return 'Vui lòng nhập nội dung hoặc lý do.';
  if (f.type === 'expense' && !f.source) return 'Vui lòng chọn nguồn chi.';
  if (f.type === 'repay' && !f.debt) return 'Vui lòng chọn khoản nợ cần trả.';
  return null;
}

/** Kiểm tra toàn bộ dữ liệu: tính lại từ đầu, báo lỗi nếu số dư/nợ âm hoặc giao dịch ở tương lai. */
export function check(data: AppData, today = todayStr()): string | null {
  const future = data.transactions.find((t) => t.date > today);
  if (future) return `Giao dịch thực tế không được ở tương lai (${future.date}). Hãy dùng mục Dự kiến.`;
  const st = compute(data, today);
  return st.errors[0] ?? null;
}
const done = (d: AppData, today: string): Result => {
  const e = check(d, today);
  return e ? { ok: false, error: e } : { ok: true, data: d };
};

const normalize = (f: TxFields): TxFields => ({
  type: f.type,
  kind: f.type === 'repay' ? 'regular' : f.kind,
  date: f.date,
  amount: f.amount,
  source: f.type === 'expense' ? f.source : undefined,
  debt: f.type === 'repay' ? f.debt : undefined,
  category: f.type === 'repay' ? 'Trả nợ' : f.category,
  content: f.content.trim(),
  note: f.note?.trim() || undefined,
});

export function addTx(data: AppData, f: TxFields, today = todayStr()): Result {
  const e = validateFields(f);
  if (e) return { ok: false, error: e };
  const d = clone(data);
  d.transactions.push({ ...normalize(f), id: uid(), createdAt: Date.now() });
  return done(d, today);
}
export function updateTx(data: AppData, id: string, f: TxFields, today = todayStr()): Result {
  const e = validateFields(f);
  if (e) return { ok: false, error: e };
  const d = clone(data);
  const i = d.transactions.findIndex((t) => t.id === id);
  if (i < 0) return { ok: false, error: 'Không tìm thấy giao dịch.' };
  d.transactions[i] = { ...normalize(f), id, createdAt: d.transactions[i].createdAt, fromPlanId: d.transactions[i].fromPlanId };
  return done(d, today);
}
export function deleteTx(data: AppData, id: string, today = todayStr()): Result {
  const d = clone(data);
  d.transactions = d.transactions.filter((t) => t.id !== id);
  return done(d, today);
}

export function addPlan(data: AppData, f: TxFields): Result {
  const e = validateFields(f);
  if (e) return { ok: false, error: e };
  const d = clone(data);
  d.plans.push({ ...normalize(f), id: uid(), createdAt: Date.now(), status: 'pending' });
  return { ok: true, data: d };
}
export function updatePlan(data: AppData, id: string, f: TxFields): Result {
  const e = validateFields(f);
  if (e) return { ok: false, error: e };
  const d = clone(data);
  const i = d.plans.findIndex((p) => p.id === id);
  if (i < 0 || d.plans[i].status !== 'pending') return { ok: false, error: 'Chỉ sửa được khoản dự kiến đang chờ.' };
  d.plans[i] = { ...d.plans[i], ...normalize(f) };
  return { ok: true, data: d };
}
export function setPlanStatus(data: AppData, id: string, status: 'cancelled' | 'pending'): Result {
  const d = clone(data);
  const p = d.plans.find((x) => x.id === id);
  if (!p) return { ok: false, error: 'Không tìm thấy khoản dự kiến.' };
  if (p.status === 'confirmed') return { ok: false, error: 'Khoản đã xác nhận không thể thay đổi trạng thái.' };
  p.status = status;
  return { ok: true, data: d };
}
export function deletePlan(data: AppData, id: string): Result {
  const d = clone(data);
  d.plans = d.plans.filter((p) => p.id !== id);
  return { ok: true, data: d };
}
/** Xác nhận khoản dự kiến: chuyển thành giao dịch thực đúng một lần. */
export function confirmPlan(data: AppData, id: string, date: string, today = todayStr()): Result {
  const d = clone(data);
  const p = d.plans.find((x) => x.id === id);
  if (!p) return { ok: false, error: 'Không tìm thấy khoản dự kiến.' };
  if (p.status !== 'pending') return { ok: false, error: 'Khoản này đã được xử lý, không thể xác nhận lại.' };
  const f: TxFields = { type: p.type, kind: p.kind, date, amount: p.amount, source: p.source, debt: p.debt, category: p.category, content: p.content, note: p.note };
  const e = validateFields(f);
  if (e) return { ok: false, error: e };
  const tx: Tx = { ...normalize(f), id: uid(), createdAt: Date.now(), fromPlanId: p.id };
  d.transactions.push(tx);
  p.status = 'confirmed';
  p.txId = tx.id;
  return done(d, today);
}

export function setDebtConfig(data: AppData, k: DebtKey, cfg: AppData['debts'][DebtKey], today = todayStr()): Result {
  if (!(cfg.rate >= 0) || cfg.rate > 1000) return { ok: false, error: 'Lãi suất không hợp lệ.' };
  if (cfg.start && !isDate(cfg.start)) return { ok: false, error: 'Ngày bắt đầu không hợp lệ.' };
  if (cfg.end && !isDate(cfg.end)) return { ok: false, error: 'Ngày kết thúc không hợp lệ.' };
  if (cfg.start && cfg.end && cfg.end < cfg.start) return { ok: false, error: 'Ngày kết thúc phải sau ngày bắt đầu.' };
  const d = clone(data);
  const old = d.debts[k];
  d.debts[k] = { ...cfg };
  d.history.push({
    id: uid(), at: Date.now(), kind: 'config', debt: k,
    description: `${DEBT_LABEL[k]}: lãi ${old.rate}%/${old.unit === 'year' ? 'năm' : 'tháng'} (${old.start || '—'} → ${old.end || '—'}) thành ${cfg.rate}%/${cfg.unit === 'year' ? 'năm' : 'tháng'} (${cfg.start || '—'} → ${cfg.end || '—'})`,
  });
  return done(d, today);
}

/** Đặt thực nợ mong muốn: tạo bút toán điều chỉnh lãi (không đổi nợ gốc). Không cho thấp hơn nợ gốc. */
export function setActualDebt(data: AppData, k: DebtKey, target: number, reason: string, today = todayStr()): Result {
  if (!reason.trim()) return { ok: false, error: 'Vui lòng nhập lý do điều chỉnh.' };
  const st = compute(data, today);
  const cur = st.debts[k];
  if (!Number.isFinite(target) || target < cur.principal) return { ok: false, error: `Thực nợ không được thấp hơn nợ gốc (${fmt(cur.principal)}).` };
  const delta = target - cur.actual;
  if (delta === 0) return { ok: false, error: 'Thực nợ không thay đổi.' };
  const d = clone(data);
  const id = uid();
  d.debtAdjustments.push({ id, debt: k, date: today, delta, targetActual: target, reason: reason.trim(), createdAt: Date.now() });
  d.history.push({ id: uid(), at: Date.now(), kind: 'adjust-debt', debt: k, description: `${DEBT_LABEL[k]}: thực nợ ${fmt(cur.actual)} → ${fmt(target)} (${reason.trim()})` });
  return done(d, today);
}

export function setInitialBalance(data: AppData, v: number, today = todayStr()): Result {
  if (!Number.isFinite(v) || v < 0) return { ok: false, error: 'Dư ban đầu không hợp lệ.' };
  const d = clone(data);
  d.history.push({ id: uid(), at: Date.now(), kind: 'initial-balance', description: `Dư ban đầu ${fmt(d.initialBalance)} → ${fmt(v)}` });
  d.initialBalance = v;
  return done(d, today);
}
export function adjustBalance(data: AppData, target: number, reason: string, today = todayStr()): Result {
  if (!reason.trim()) return { ok: false, error: 'Vui lòng nhập lý do điều chỉnh.' };
  if (!Number.isFinite(target) || target < 0) return { ok: false, error: 'Số dư mới không hợp lệ.' };
  const cur = compute(data, today).balance;
  if (cur === target) return { ok: false, error: 'Số dư không thay đổi.' };
  const d = clone(data);
  d.balanceAdjustments.push({ id: uid(), date: today, delta: target - cur, reason: reason.trim(), createdAt: Date.now() });
  d.history.push({ id: uid(), at: Date.now(), kind: 'adjust-balance', description: `Điều chỉnh số dư ${fmt(cur)} → ${fmt(target)} (${reason.trim()})` });
  return done(d, today);
}

export function mergeData(cur: AppData, inc: AppData, today = todayStr()): Result {
  const d = clone(cur);
  const addNew = <T extends { id: string }>(a: T[], b: T[]) => { const ids = new Set(a.map((x) => x.id)); for (const x of b) if (!ids.has(x.id)) a.push(clone(x)); };
  addNew(d.transactions, inc.transactions);
  addNew(d.plans, inc.plans);
  addNew(d.debtAdjustments, inc.debtAdjustments);
  addNew(d.balanceAdjustments, inc.balanceAdjustments);
  addNew(d.history, inc.history);
  d.categories.income = Array.from(new Set([...d.categories.income, ...inc.categories.income]));
  d.categories.expense = Array.from(new Set([...d.categories.expense, ...inc.categories.expense]));
  d.history.push({ id: uid(), at: Date.now(), kind: 'import', description: 'Nhập gộp dữ liệu từ file sao lưu (giữ nguyên cài đặt & dư ban đầu hiện tại)' });
  return done(d, today);
}
