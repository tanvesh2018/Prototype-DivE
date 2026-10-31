import { useEffect, useMemo, useRef, useState } from 'react';
import { runAI, type AIResult } from '../ai/client';
import { columnMapping, type ColumnMapOut } from '../ai/tasks';
import { DATASET, DATASETS, type DatasetKey } from '../engine/glossary';
import { detectDataset, parseUpload, ruleMapColumns, type ParsedUpload } from '../engine/ingest';
import { hygieneScore } from '../engine/quality';
import type { ColumnMapping } from '../engine/types';
import { download } from '../engine/util';
import { ingest } from '../engine/workspace';
import { SAMPLE_FILES, useStore } from '../state/store';
import { AIChip, Badge, Button, Conf, Icon, Modal } from './ui';

export function UploadModal({ expected, onClose }: { expected?: DatasetKey; onClose: () => void }) {
  const { s, act, toast, navigate } = useStore();
  const [parsed, setParsed] = useState<ParsedUpload | null>(null);
  const [key, setKey] = useState<DatasetKey | null>(expected ?? null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [ai, setAi] = useState<AIResult<ColumnMapOut> | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | { key: DatasetKey; notes: string[] }>(null);
  const input = useRef<HTMLInputElement>(null);

  const samples = useMemo(() => {
    const all = Object.keys(SAMPLE_FILES).filter((f) => !f.startsWith('19_')).sort();
    if (!expected) return all;
    const first = all.filter((f) => f === DATASET[expected].sampleFile);
    return [...first, ...all.filter((f) => !first.includes(f))];
  }, [expected]);

  const load = (fileName: string, text: string) => {
    setError('');
    try {
      const p = parseUpload(fileName, text);
      if (p.kind === 'csv' && (!p.headers.length || !p.rows.length)) throw new Error('The file has no header row or no data rows.');
      const det = detectDataset(p);
      const k = expected && (DATASET[expected].format === p.kind || (DATASET[expected].format === 'csv' && p.kind === 'csv')) ? expected : det.key;
      if (expected && k !== expected) setError(`This screen expects ${DATASET[expected].label}, but the file looks like ${DATASET[det.key].label}. You can still import it as that type.`);
      setParsed(p); setKey(k); setAi(null);
      setMapping(p.kind === 'csv' ? ruleMapColumns(p.headers, k) : []);
    } catch (e: any) {
      setError(`Could not read ${fileName}: ${e.message}`);
    }
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!/\.(csv|json|txt)$/i.test(f.name)) { setError('Please upload a .csv, .json or .txt file (Excel: File → Save As → CSV).'); return; }
    f.text().then((t) => load(f.name, t));
  };

  // re-map when user changes dataset type
  const changeKey = (k: DatasetKey) => { setKey(k); setAi(null); if (parsed?.kind === 'csv') setMapping(ruleMapColumns(parsed.headers, k)); };

  // AI column matching runs automatically once a CSV is loaded
  useEffect(() => {
    if (!parsed || parsed.kind !== 'csv' || !key || ai) return;
    let cancel = false;
    setAiBusy(true);
    const def = DATASET[key];
    runAI(columnMapping, {
      dataset: def.label, glossary: def.fields.map((f) => ({ key: f.key, label: f.label, description: f.description })),
      headers: parsed.headers, sample: parsed.rows.slice(0, 3), rule: ruleMapColumns(parsed.headers, key),
    }).then((r) => {
      if (cancel) return;
      setAi(r);
      setMapping(r.data.mappings.map((m) => ({ source: m.source, target: m.target, confidence: m.confidence, reason: m.reason, method: r.source === 'gemini' ? 'ai' : 'rule', confirmed: m.confidence >= 0.8 })));
    }).finally(() => !cancel && setAiBusy(false));
    return () => { cancel = true; };
  }, [parsed, key, ai]);

  const lowConf = mapping.filter((m) => !m.confirmed);
  const requiredMissing = key && parsed?.kind === 'csv' ? DATASET[key].fields.filter((f) => f.required && !mapping.some((m) => m.target === f.key)) : [];
  const existing = key ? s.datasets[key] : undefined;

  const doImport = () => {
    if (!parsed || !key) return;
    const finalMap = mapping.map((m) => ({ ...m, confirmed: true }));
    let notes: string[] = [];
    const ok = act(`Uploaded ${parsed.fileName}`, `${DATASET[key].label} · ${parsed.kind === 'csv' ? parsed.rows.length : 1} records · ${finalMap.filter((m) => m.method === 'ai').length} AI-mapped columns`, (d) => {
      notes = ingest(d, parsed, key, finalMap).notes;
    });
    if (ok) {
      setDone({ key, notes });
      toast(`${parsed.fileName} imported as ${DATASET[key].label}`);
    }
  };

  if (done) {
    const h = hygieneScore(s, done.key);
    const issues = s.issues.filter((i) => i.dataset === done.key && i.status === 'open');
    const ds = s.datasets[done.key];
    return <Modal title="Upload complete" subtitle={`${ds?.fileName} → ${DATASET[done.key].label}`} onClose={onClose}
      footer={<>{DATASET[done.key].hygiene && <Button variant="secondary" icon="alert" onClick={() => { onClose(); navigate('Data & Inventory', { tab: 'quality', dataset: done.key }); }}>Review quality issues</Button>}<Button onClick={onClose}>Done</Button></>}>
      <div className="stack">
        <div className="grid-3">
          <div className="lesson-card"><span className="muted">Records stored</span><strong style={{ fontSize: 22 }}>{ds?.rows.length ?? '—'}</strong><span className="muted">{ds?.rawCount} rows in source file</span></div>
          <div className="lesson-card"><span className="muted">Data hygiene</span><strong style={{ fontSize: 22 }}>{h ?? 'n/a'}</strong>{h !== null && <Badge tone={h >= s.config.hygieneGate ? 'success' : 'danger'}>{h >= s.config.hygieneGate ? 'Passes 90 gate' : 'Below gate — blocked'}</Badge>}</div>
          <div className="lesson-card"><span className="muted">Open quality issues</span><strong style={{ fontSize: 22 }}>{issues.length}</strong><span className="muted">{issues.filter((i) => i.type === 'broken_link').length} broken links · {issues.filter((i) => i.type === 'duplicate' || i.type === 'lookalike').length} duplicates</span></div>
        </div>
        {done.notes.map((n) => <div key={n} className="ai-box" style={{ borderLeftColor: n.startsWith('WARNING') ? 'var(--red)' : undefined }}><div className="ai-head"><Icon name={n.startsWith('WARNING') ? 'alert' : 'shield'} size={14} />{n.startsWith('WARNING') ? 'Privacy warning' : 'Processing note'}</div>{n}</div>)}
        <p className="muted small">Scores, dependency map, readiness and dashboards have been recalculated from the new data.</p>
      </div>
    </Modal>;
  }

  return <Modal wide title={expected ? `Upload ${DATASET[expected].label}` : 'Upload source file'} subtitle="Files are matched to the DealSync glossary, personal data is hidden, and every record is scored before use." onClose={onClose}
    footer={parsed ? <>
      <span className="spacer">{parsed.kind === 'csv' ? `${lowConf.length} low-confidence column${lowConf.length === 1 ? '' : 's'} need your confirmation${requiredMissing.length ? ` · missing required: ${requiredMissing.map((f) => f.label).join(', ')}` : ''}` : 'Ready to import'}</span>
      <Button variant="ghost" onClick={() => { setParsed(null); setKey(expected ?? null); setMapping([]); setAi(null); }}>Choose another file</Button>
      {lowConf.length > 0 && <Button variant="secondary" icon="check" onClick={() => setMapping((ms) => ms.map((m) => ({ ...m, confirmed: true, method: m.method })))}>Confirm all</Button>}
      <Button icon="upload" disabled={lowConf.length > 0 || !key} onClick={doImport}>{existing ? 'Replace & import' : 'Import'}</Button>
    </> : <Button variant="secondary" onClick={onClose}>Cancel</Button>}>
    {!parsed && <>
      <div className={`dropzone ${over ? 'over' : ''}`} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}>
        <Icon name="upload" size={28} />
        <strong>Drop a file here or click to browse</strong>
        <span className="muted">CSV (any column names), JSON learning records or TXT contract clauses · sample files are in the project's <b>sample-data/</b> folder</span>
        <input ref={input} type="file" accept=".csv,.json,.txt" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {error && <p style={{ color: 'var(--red)' }} className="small mt">{error}</p>}
      <div className="mt row between"><strong className="small">Or use a bundled sample file</strong><span className="muted small">Download to inspect the messy source format</span></div>
      <div className="sample-list">{samples.map((f) => <div key={f} className="row" style={{ gap: 4 }}>
        <button style={{ flex: 1, ...(expected && f === DATASET[expected].sampleFile ? { borderColor: 'var(--orange)' } : {}) }} onClick={() => load(f, SAMPLE_FILES[f])}><Icon name="file" size={13} />{f}</button>
        <button title="Download sample" onClick={() => download(f, SAMPLE_FILES[f], f.endsWith('.json') ? 'application/json' : 'text/plain')}><Icon name="download" size={13} /></button>
      </div>)}</div>
    </>}
    {parsed && key && <div className="stack">
      <div className="row between wrap">
        <div className="row"><Icon name="file" /><div><strong>{parsed.fileName}</strong><div className="muted small">{parsed.kind === 'csv' ? `${parsed.rows.length} rows · ${parsed.headers.length} columns` : parsed.kind === 'json' ? `${(parsed.json?.records ?? parsed.json ?? []).length} records` : `${parsed.text.length} characters`}</div></div></div>
        <label className="field" style={{ minWidth: 260 }}>Import as
          <select value={key} onChange={(e) => changeKey(e.target.value as DatasetKey)}>{DATASETS.filter((d) => d.format === parsed.kind || (parsed.kind === 'text' && d.format === 'text')).map((d) => <option key={d.key} value={d.key}>{d.label} — {d.component}</option>)}</select>
        </label>
      </div>
      {error && <div className="ai-box" style={{ borderLeftColor: 'var(--amber)' }}>{error}</div>}
      {existing && <div className="ai-box" style={{ borderLeftColor: 'var(--amber)' }}>This replaces the current <b>{DATASET[key].label}</b> ({existing.rows.length} records from {existing.fileName}). Quality decisions on the old file will be re-evaluated.</div>}
      {DATASET[key].fields.some((f) => f.pii) && <div className="ai-box"><div className="ai-head"><Icon name="shield" size={14} />Personal data will be hidden at upload</div>{s.controls.maskPII ? `Names, emails and employee numbers are dropped and replaced with counts by role and site — the deal only needs to know how many people need access and where.` : 'Masking is OFF in Governance & Settings — personal data would be stored.'}</div>}
      {parsed.kind === 'csv' && <>
        <div className="row between"><strong>Column matching</strong><span className="row">{aiBusy ? <span className="ai-chip"><span className="spinner" /> Matching columns with AI…</span> : <AIChip result={ai} />}<Button variant="ghost" icon="refresh" onClick={() => setAi(null)} disabled={aiBusy}>Re-run</Button></span></div>
        <div className="gtable scroll-y" style={{ ['--cols' as any]: '1.3fr 1.4fr 1.4fr 60px 2fr 70px', maxHeight: 360 }}>
          <div className="tr th"><span>Source column</span><span>Sample values</span><span>Standard name</span><span>Confidence</span><span>Why</span><span>Confirm</span></div>
          {mapping.map((m, i) => <div className="tr" key={m.source} style={!m.confirmed ? { background: '#fff8ef' } : undefined}>
            <span><strong>{m.source}</strong></span>
            <span className="muted">{parsed.rows.slice(0, 3).map((r) => r[i]).filter(Boolean).join(' · ').slice(0, 60) || '—'}</span>
            <span><select className="inline" value={m.target ?? ''} onChange={(e) => setMapping((ms) => ms.map((x, j) => (j === i ? { ...x, target: e.target.value || null, method: 'user', confirmed: true, confidence: 1, reason: 'Set by user' } : x)))}>
              <option value="">— keep as extra column —</option>
              {DATASET[key].fields.map((f) => <option key={f.key} value={f.key}>{f.key} ({f.label}){f.required ? ' *' : ''}</option>)}
            </select></span>
            <span><Conf v={m.confidence} /></span>
            <span className="muted small">{m.method === 'ai' && <Badge tone="info">AI</Badge>} {m.reason}</span>
            <span><input type="checkbox" checked={m.confirmed} onChange={(e) => setMapping((ms) => ms.map((x, j) => (j === i ? { ...x, confirmed: e.target.checked } : x)))} /></span>
          </div>)}
        </div>
      </>}
      {parsed.kind === 'text' && <pre className="ai-box" style={{ maxHeight: 280, overflow: 'auto' }}>{parsed.text.slice(0, 2500)}</pre>}
      {parsed.kind === 'json' && <div className="ai-box">{(parsed.json?.records ?? []).length} anonymised learning records will be added to the knowledge hub. Records without client consent are rejected.</div>}
    </div>}
  </Modal>;
}
