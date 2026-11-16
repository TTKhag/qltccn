import { useState } from 'react';
import { useStore } from '../store';
import { Card, Confirm, Field } from '../components/ui';
import { AppData, emptyData, uid } from '../lib/types';
import { storageNote } from '../lib/notes';

export default function Settings() {
  const { data, replaceAll, run, notify } = useStore();
  const [cat, setCat] = useState('');
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [reset, setReset] = useState(false);
  const [word, setWord] = useState('');
  const upd = (fn: (d: AppData) => void, msg: string) => run((d) => { const n = JSON.parse(JSON.stringify(d)) as AppData; fn(n); return { ok: true, data: n }; }, msg);
  const add = () => {
    const c = cat.trim();
    if (!c) return;
    if (data.categories[kind].includes(c)) { notify('Danh mục đã tồn tại.', 'err'); return; }
    upd((d) => { d.categories[kind].push(c); }, 'Đã thêm danh mục.'); setCat('');
  };
  const remove = (k: 'income' | 'expense', c: string) => {
    const used = data.transactions.some((t) => t.category === c) || data.plans.some((p) => p.category === c);
    if (used) { notify('Danh mục đang được dùng trong giao dịch nên không thể xóa.', 'err'); return; }
    upd((d) => { d.categories[k] = d.categories[k].filter((x) => x !== c); }, 'Đã xóa danh mục.');
  };
  return (
    <div className="stack-lg">
      <Card title="Danh mục">
        <div className="grid2">
          <div><h4>Chi</h4><div className="chips">{data.categories.expense.map((c) => <span key={c} className="chip">{c}<button aria-label={`Xóa ${c}`} onClick={() => remove('expense', c)}>✕</button></span>)}</div></div>
          <div><h4>Thu</h4><div className="chips">{data.categories.income.map((c) => <span key={c} className="chip">{c}<button aria-label={`Xóa ${c}`} onClick={() => remove('income', c)}>✕</button></span>)}</div></div>
        </div>
        <div className="row"><select value={kind} onChange={(e) => setKind(e.target.value as 'income' | 'expense')} aria-label="Loại danh mục"><option value="expense">Chi</option><option value="income">Thu</option></select><input value={cat} onChange={(e) => setCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Tên danh mục mới" /><button className="btn primary" onClick={add}>Thêm</button></div>
      </Card>
      <Card title="Quy ước tính toán">
        <ul className="log">{storageNote.map((s) => <li key={s}>{s}</li>)}</ul>
      </Card>
      <Card title="Xóa toàn bộ dữ liệu">
        <p>Xóa mọi giao dịch, nợ, dự kiến và lịch sử trong trình duyệt này. Nên tải file sao lưu trước.</p>
        <div><button className="btn danger" onClick={() => { setWord(''); setReset(true); }}>Xóa toàn bộ dữ liệu…</button></div>
      </Card>
      {reset && <Confirm title="Xóa toàn bộ dữ liệu?" danger confirmText="Xóa vĩnh viễn" onNo={() => setReset(false)} onYes={() => { if (word !== 'XOA') { notify('Gõ đúng chữ XOA để xác nhận.', 'err'); return; } const e = emptyData(); e.history.push({ id: uid(), at: Date.now(), kind: 'reset', description: 'Đã xóa toàn bộ dữ liệu' }); replaceAll(e, 'Đã xóa toàn bộ dữ liệu.'); setReset(false); }}>
        <p>Thao tác này không thể hoàn tác.</p><Field label="Gõ XOA để xác nhận"><input value={word} onChange={(e) => setWord(e.target.value)} /></Field>
      </Confirm>}
    </div>
  );
}
