import { useAct, useNotify, useWorld } from '../../store';
import { Badge, Button, Callout, Card, Page, PlayerLink, Stat, Table } from '../../components/ui';
import { OvrCell, PotCell, StaffPanel } from '../../helpers';
import { academy, age, club as getClub, roster } from '../../../engine/world';
import { promoteYouth, releaseYouth } from '../../../engine/squad';
import { registrationCheck } from '../../../engine/market';
import { buildCalendar, fmtDate } from '../../../engine/calendar';
import { potentialLabel } from '../../../engine/player';
import { potRange } from '../../helpers';

export default function Academy() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const youth = academy(w, c.id);
  const cal = buildCalendar(w.season);
  const intakeDay = w.day <= cal.youthIntake ? fmtDate(w.season, cal.youthIntake) : fmtDate(w.season + 1, buildCalendar(w.season + 1).youthIntake);
  const worst = Math.min(...roster(w, c.id).map((p) => p.ovr));
  return (
    <Page title="Academy" subtitle="Your homegrown pipeline: cheap, registrable and loyal — if they develop.">
      <div className="grid g4 mb8" style={{ marginBottom: 14 }}>
        <Stat label="Academy players" value={youth.length} />
        <Stat label="Academy facility" value={`${c.arena.levels.academy}/5`} sub="Better intakes and development" />
        <Stat label="Next intake" value={intakeDay} />
        <Stat label="Academy budget" value={`€${Math.round(c.finances.budget.academy / 1000)}k`} sub="per season" />
      </div>
      <Callout>Academy graduates are <b>homegrown</b>: they count towards the league's homegrown quota wherever they play. Players turning 20 must be promoted or they leave. Promotion gives a cheap 3-year first-team deal with a release clause.</Callout>
      <Card className="flush mt16">
        <Table
          rows={youth}
          rowKey={(p) => p.id}
          initialSort="pot"
          empty="The academy is empty. A youth intake arrives every June."
          columns={[
            { key: 'n', label: 'Player', render: (p) => <PlayerLink player={p} /> },
            { key: 'pos', label: 'Pos', render: (p) => p.pos },
            { key: 'a', label: 'Age', render: (p) => <span className={age(w, p) >= 19 ? 'warn' : ''}>{age(w, p)}</span>, sort: (p) => age(w, p), align: 'r' },
            { key: 'o', label: 'OVR', render: (p) => <OvrCell p={p} />, sort: (p) => p.ovr, align: 'c' },
            { key: 'pot', label: 'POT', render: (p) => <PotCell p={p} />, sort: (p) => p.pot, align: 'c' },
            { key: 'lbl', label: 'Projection', render: (p) => <span className="small muted">{potentialLabel(Math.round((potRange(w, p)[0] + potRange(w, p)[1]) / 2))}</span> },
            { key: 'we', label: 'Work ethic', render: (p) => p.personality.workEthic, sort: (p) => p.personality.workEthic, align: 'r' },
            { key: 'rd', label: '', render: (p) => (p.ovr >= worst ? <Badge tone="good">Ready</Badge> : null) },
            {
              key: 'act', label: '', render: (p) => (
                <span className="row gap4">
                  <Button size="sm" variant="primary" onClick={() => {
                    const reg = registrationCheck(w, c, p);
                    if (!reg.ok) { notify(reg.reasons.join(' '), 'bad'); return; }
                    const res = act((ww) => promoteYouth(ww, getClub(ww, c.id), p));
                    notify(res.message, res.ok ? 'good' : 'bad');
                  }}>Promote</Button>
                  <Button size="sm" variant="danger" onClick={() => {
                    if (!confirm(`Release ${p.firstName} ${p.lastName} from the academy?`)) return;
                    act((ww) => releaseYouth(ww, p));
                    notify(`${p.firstName} ${p.lastName} released.`);
                  }}>Release</Button>
                </span>
              ),
            },
          ]}
        />
      </Card>
      <div className="mt16"><StaffPanel roles={['academyDirector']} title="Academy director" /></div>
    </Page>
  );
}
