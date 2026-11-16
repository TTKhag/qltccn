import { useState } from 'react';
import { AppData, DEBT_LABEL, DebtKey, Kind, SOURCE_LABEL, Source, TxFields, TxType } from '../lib/types';
import { Field, MoneyInput, Modal } from './ui';

export function TxForm({ title, initial, data, defaultDate, onSubmit, onClose, submitText }: {
  title: string; initial?: Partial<TxFields>; data: AppData; defaultDate: string; submitText: string;
  onSubmit: (f: TxFields) => boolean; onClose: () => void;
}) {
  const [f, setF] = useState<TxFields>({
    type: 'expense', kind: 'regular', date: defaultDate, amount: 0, source: 'balance', debt: 'credit', category: '', content: '', note: '', ...initial,
  });
  const set = (p: Partial<TxFields>) => setF((x) => ({ ...x, ...p }));
  const cats = f.type === 'income' ? data.categories.income : data.categories.expense;
  const category = f.category || cats[0] || 'Khác';
  const submit = () => { if (onSubmit({ ...f, category })) onClose(); };
  return (
    <Modal title={title} onClose={onClose}>
      <div className="seg" role="tablist">
        {(['expense', 'income', 'repay'] as TxType[]).map((t) => (
          <button key={t} role="tab" aria-selected={f.type === t} className={f.type === t ? 'on ' + t : ''} onClick={() => set({ type: t, category: '' })}>
            {t === 'expense' ? 'Chi' : t === 'income' ? 'Thu' : 'Trả nợ'}
          </button>
        ))}
      </div>
      <div className="grid2">
        <Field label="Số tiền (₫)"><MoneyInput value={f.amount} onChange={(n) => set({ amount: n })} autoFocus /></Field>
        <Field label="Ngày"><input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        {f.type === 'expense' && (
          <Field label="Nguồn chi" hint={f.source === 'balance' ? 'Trừ trực tiếp vào số dư.' : 'Cộng vào nợ gốc, không trừ số dư.'}>
            <select value={f.source} onChange={(e) => set({ source: e.target.value as Source })}>
              {(['balance', 'credit', 'cash'] as Source[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
            </select>
          </Field>
        )}
        {f.type === 'repay' && (
          <Field label="Khoản nợ cần trả" hint="Trả lãi trước, phần còn lại giảm nợ gốc.">
            <select value={f.debt} onChange={(e) => set({ debt: e.target.value as DebtKey })}>
              {(['credit', 'cash'] as DebtKey[]).map((s) => <option key={s} value={s}>{DEBT_LABEL[s]}</option>)}
            </select>
          </Field>
        )}
        {f.type !== 'repay' && (
          <>
            <Field label="Loại">
              <select value={f.kind} onChange={(e) => set({ kind: e.target.value as Kind })}>
                <option value="regular">Định kỳ</option><option value="incidental">Phát sinh</option>
              </select>
            </Field>
            <Field label="Danh mục">
              <select value={category} onChange={(e) => set({ category: e.target.value })}>
                {cats.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </>
        )}
      </div>
      <Field label={f.type === 'income' ? 'Nội dung' : f.kind === 'incidental' || f.type === 'repay' ? 'Nội dung / lý do' : 'Nội dung'}><input value={f.content} onChange={(e) => set({ content: e.target.value })} placeholder="Ví dụ: tiền điện tháng 6" /></Field>
      <Field label="Ghi chú (không bắt buộc)"><input value={f.note ?? ''} onChange={(e) => set({ note: e.target.value })} /></Field>
      <div className="row end"><button className="btn" onClick={onClose}>Hủy</button><button className="btn primary" onClick={submit}>{submitText}</button></div>
    </Modal>
  );
}
