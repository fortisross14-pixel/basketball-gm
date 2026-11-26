import { useWorld } from '../../store';
import { Money, Page, Stat } from '../../components/ui';
import { StaffPanel } from '../../helpers';
import { club as getClub, clubStaff } from '../../../engine/world';
import { staffPayroll } from '../../../engine/staff';

export default function StaffScreen() {
  const w = useWorld();
  const c = getClub(w, w.user.clubId!);
  const total = staffPayroll(w, c);
  return (
    <Page title="Coaching Staff" subtitle="Hire, replace and dismiss the people who run basketball operations.">
      <div className="grid g3 mb8" style={{ marginBottom: 14 }}>
        <Stat label="Staff payroll" value={<Money v={total} />} sub={`Budget ${Math.round(c.finances.budget.staff / 1000)}k`} tone={total > c.finances.budget.staff ? 'warn' : undefined} />
        <Stat label="Staff employed" value={clubStaff(w, c.id).length} sub="All departments" />
        <Stat label="Club prestige" value={c.prestige} sub="Better staff want bigger clubs" />
      </div>
      <div className="grid g2">
        <StaffPanel roles={['headCoach', 'assistantOff', 'assistantDef', 'assistantDev']} title="Coaching" />
        <StaffPanel roles={['scoutDirector', 'analytics', 'academyDirector']} title="Basketball operations" />
      </div>
    </Page>
  );
}
