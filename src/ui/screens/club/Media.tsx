import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { NewsTag } from '../../../engine/types';
import { club as getClub } from '../../../engine/world';
import { fmtAbs } from '../../../engine/calendar';
import { DEPT_LABEL, MODE_LABEL } from '../../../engine/delegation';
import { Badge, Button, Card, Empty, Page, Tabs, Table } from '../../components/ui';
import { StaffPanel } from '../../helpers';
import { useAct, useWorld } from '../../store';

const TAGS: NewsTag[] = ['result', 'transfer', 'injury', 'rumour', 'board', 'finance', 'fans', 'media', 'award', 'milestone', 'club', 'career', 'league', 'staff', 'delegation'];

export default function Media() {
  const w = useWorld();
  const act = useAct();
  const [tab, setTab] = useState<'news' | 'log' | 'pr'>('news');
  const [tag, setTag] = useState<NewsTag | 'all'>('all');
  const [mine, setMine] = useState(w.user.clubId != null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(60);
  const uid = w.user.clubId;
  const news = w.news.filter((n) => (tag === 'all' || n.tags.includes(tag)) && (!mine || uid == null || n.clubIds.includes(uid)) && (!unreadOnly || !n.read));
  const unread = w.news.filter((n) => !n.read).length;
  const c = uid != null ? getClub(w, uid) : null;

  return (
    <Page
      title="News & Media"
      subtitle="The living sports newspaper of your basketball world"
      actions={<Button size="sm" onClick={() => act((ww) => { for (const n of ww.news) n.read = true; })} disabled={!unread}>Mark all read ({unread})</Button>}
    >
      <Tabs tabs={[{ id: 'news', label: 'News feed' }, { id: 'log', label: `Delegation log (${w.delegationLog.length})` }, ...(c ? [{ id: 'pr' as const, label: 'PR & press' }] : [])]} value={tab} onChange={setTab} />
      {tab === 'news' && (
        <Card>
          <div className="row wrap mb8">
            <select value={tag} onChange={(e) => setTag(e.target.value as NewsTag | 'all')}>
              <option value="all">All topics</option>
              {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {uid != null && <label className="row small"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> My club only</label>}
            <label className="row small"><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread only</label>
            <span className="spacer" />
            <span className="muted small">{news.length} stories</span>
          </div>
          {news.length === 0 && <Empty>No stories match.</Empty>}
          <div className="list">
            {news.slice(0, limit).map((n) => (
              <div key={n.id} className="list-item" style={{ opacity: n.read ? 0.7 : 1, cursor: 'pointer' }} onClick={() => !n.read && act(() => { n.read = true; })}>
                <div className="row">
                  {!n.read && <Badge tone="accent">new</Badge>}
                  <b>{n.headline}</b>
                  <span className="spacer" />
                  {n.importance >= 3 && <Badge tone="warn">major</Badge>}
                  <span className="small muted">{fmtAbs(n.day)}</span>
                </div>
                <div className="small mt8">{n.body}</div>
                <div className="row small muted mt8 wrap">
                  <span>{n.outlet}</span>
                  {n.tags.map((t) => <span key={t} className="chip">{t}</span>)}
                  {n.clubIds.slice(0, 3).map((id) => { const cl = getClub(w, id); return cl ? <Link key={id} to={`/clubs/${id}`} className="link">{cl.abbrev}</Link> : null; })}
                  {n.playerIds.slice(0, 3).map((id) => { const p = w.players.find((x) => x.id === id); return p ? <Link key={id} to={`/player/${id}`} className="link">{p.lastName}</Link> : null; })}
                </div>
              </div>
            ))}
          </div>
          {news.length > limit && <div className="center mt8"><Button onClick={() => setLimit(limit + 60)}>Show more</Button></div>}
        </Card>
      )}
      {tab === 'log' && (
        <Card title="Decisions taken by your staff">
          <p className="small muted">Every delegated decision is recorded with the accountable staff member, the rationale and the expected outcome. Adjust policies in Settings → Delegation.</p>
          <Table
            rows={w.delegationLog}
            rowKey={(e) => e.id}
            empty="No delegated decisions yet."
            columns={[
              { key: 'd', label: 'Date', render: (e) => fmtAbs(e.day), sort: (e) => e.day },
              { key: 'dept', label: 'Department', render: (e) => <span className="small">{DEPT_LABEL[e.dept] ?? e.dept}<br /><span className="faint">{MODE_LABEL[w.user.delegation[e.dept]?.mode ?? 'manual']}</span></span> },
              { key: 's', label: 'Staff', render: (e) => e.staff },
              { key: 'a', label: 'Action', render: (e) => <span style={{ whiteSpace: 'normal' }}>{e.action}</span> },
              { key: 'r', label: 'Why', render: (e) => <span className="small muted" style={{ whiteSpace: 'normal' }}>{e.rationale}</span> },
              { key: 'x', label: 'Expected', render: (e) => <span className="small muted" style={{ whiteSpace: 'normal' }}>{e.expected}</span> },
            ]}
          />
        </Card>
      )}
      {tab === 'pr' && c && (
        <div className="grid g2">
          <StaffPanel roles={['prLead']} title="Communications" />
          <Card title="Media standing">
            <div className="kv">
              <span>Board media trust</span><span>{Math.round(c.board.trust.media)}/100</span>
              <span>Fan sentiment</span><span>{Math.round(c.fans.sentiment)}/100</span>
              <span>Press posture</span><span>{w.user.pressStance > 2 ? 'Combative' : w.user.pressStance < -2 ? 'Conciliatory' : 'Neutral'}</span>
              <span>Press delegation</span><span>{MODE_LABEL[w.user.delegation.media.mode]}</span>
            </div>
            <p className="small muted mt8">Press conferences arrive as decisions on the Today screen (after losing streaks, incidents, big games). Your answers move player morale, fan sentiment and the board's media trust. Delegate media to your PR lead to have them answered automatically.</p>
          </Card>
        </div>
      )}
    </Page>
  );
}
