import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Card, Confirm } from '../components/ui';
import { download } from '../lib/csv';
import { exportJson, parseBackup } from '../lib/backup';
import { mergeData } from '../lib/ops';
import { AppData } from '../lib/types';
import { fmt } from '../lib/format';

export default function Backup() {
  const { data, replaceAll, run } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<AppData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');

  const onFile = async (f?: File) => {
    if (!f) return;
    const r = parseBackup(await f.text());
    if (file.current) file.current.value = '';
    if (!r.ok) { setErrors(r.errors); setPending(null); return; }
    setErrors([]); setPending(r.data); setMode('replace');
  };
  const apply = () => {
    if (!pending) return;
    if (mode === 'replace') {
      const pre = exportJson(data);
      download(`tu-dong-sao-luu-truoc-khoi-phuc-${new Date().toISOString().slice(0, 10)}.json`, pre, 'application/json');
      replaceAll(pending, 'Đã khôi phục dữ liệu (thay thế). Bản dữ liệu cũ vừa được tải về để phòng hờ.');
    } else run((d) => mergeData(d, pending), 'Đã nhập gộp dữ liệu.');
    setPending(null);
  };
  return (
    <div className="stack-lg">
      <div className="warn">Dữ liệu chỉ nằm trong trình duyệt này. Xóa dữ liệu trang web, dùng chế độ ẩn danh hoặc đổi thiết bị sẽ làm mất dữ liệu. Hãy sao lưu định kỳ.</div>
      <Card title="Sao lưu">
        <p>Xuất toàn bộ dữ liệu (giao dịch, nợ, dự kiến, lịch sử, cài đặt) ra một file JSON.</p>
        <div><button className="btn primary" onClick={() => download(`quan-ly-tai-chinh-${new Date().toISOString().slice(0, 10)}.json`, exportJson(data), 'application/json')}>Tải file sao lưu</button></div>
        <p className="muted">Hiện có {data.transactions.length} giao dịch, {data.plans.length} khoản dự kiến, dư ban đầu {fmt(data.initialBalance)}.</p>
      </Card>
      <Card title="Khôi phục">
        <p>Chọn file JSON đã sao lưu. File được kiểm tra cấu trúc, phiên bản và tính nhất quán trước khi áp dụng.</p>
        <input ref={file} type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0])} />
        {errors.length > 0 && <div className="warn"><b>Không thể khôi phục:</b><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      </Card>
      {pending && (
        <Confirm title="Khôi phục dữ liệu" confirmText="Khôi phục" danger={mode === 'replace'} onNo={() => setPending(null)} onYes={apply}>
          <p>File hợp lệ: {pending.transactions.length} giao dịch, {pending.plans.length} khoản dự kiến.</p>
          <label className="radio"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> <span><b>Thay thế</b>: dữ liệu hiện tại sẽ bị ghi đè hoàn toàn (một bản sao lưu dữ liệu cũ sẽ được tải về trước).</span></label>
          <label className="radio"><input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> <span><b>Nhập gộp</b>: chỉ thêm các bản ghi chưa có (theo mã), giữ nguyên cài đặt và dư ban đầu hiện tại.</span></label>
        </Confirm>
      )}
    </div>
  );
}
