import { Tx, SOURCE_LABEL, TYPE_LABEL, DEBT_LABEL } from './types';
import { fmtDate } from './dates';

const q = (s: string | number | undefined) => {
  const v = String(s ?? '');
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};
export function txToCsv(txs: Tx[]): string {
  const head = ['Ngày', 'Loại', 'Định kỳ/Phát sinh', 'Số tiền (VND)', 'Nguồn / Khoản nợ', 'Danh mục', 'Nội dung', 'Ghi chú'];
  const rows = txs.map((t) => [
    fmtDate(t.date), TYPE_LABEL[t.type], t.type === 'repay' ? '' : t.kind === 'regular' ? 'Định kỳ' : 'Phát sinh', t.amount,
    t.type === 'expense' ? SOURCE_LABEL[t.source!] : t.type === 'repay' ? DEBT_LABEL[t.debt!] : '', t.category, t.content, t.note,
  ]);
  return '\ufeff' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
}
export function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
