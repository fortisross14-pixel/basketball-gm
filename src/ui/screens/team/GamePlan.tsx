// Game plan "politics" panel: coach, squad, supporters and owner each want a style.
import { motion } from 'framer-motion';
import { useAct, useNotify, useWorld } from '../../store';
import { Badge, Button, Card } from '../../components/ui';
import { Icon, type IconName } from '../../art/icons';
import { club as getClub } from '../../../engine/world';
import { OFF_LABEL, DEF_LABEL } from '../../../engine/staff';
import { PACE_LABEL, PRESET_LABEL, executionPoints, planOf, presetPlan, reactionPreview, stakeholderViews, type Preset, type StakeView } from '../../../engine/gameplan';

const ICON: Record<StakeView['who'], IconName> = { coach: 'whistle', players: 'players', fans: 'fans', owner: 'owner' };
const MOOD: Record<StakeView['mood'], { label: string; tone: 'good' | 'warn' | 'bad' }> = { love: { label: 'Loves it', tone: 'good' }, ok: { label: 'Accepts it', tone: 'warn' }, unhappy: { label: 'Against it', tone: 'bad' } };
const PRESETS: Preset[] = ['results', 'balanced', 'coach', 'players', 'fans', 'owner'];

export function GamePlanPanel() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const views = stakeholderViews(w, c);
  const plan = planOf(c);
  const coach = views.find((v) => v.who === 'coach')!;
  const squad = views.find((v) => v.who === 'players')!;
  const pts = executionPoints(coach.score, squad.score);

  const apply = (p: Preset) => {
    const np = presetPlan(w, c, p);
    act((ww) => { Object.assign(getClub(ww, c.id).tactics, np); });
    notify(`${PRESET_LABEL[p]}: ${OFF_LABEL[np.off]} · ${DEF_LABEL[np.def]} · ${PACE_LABEL[np.pace]}`);
  };

  return (
    <Card
      title="Game plan"
      style={{ marginBottom: 16 }}
      actions={<span className={`badge ${pts >= 1 ? 'good' : pts <= -1 ? 'bad' : ''}`} title="Approximate effect on your average margin per game, from coach buy-in and squad fit">Execution {pts > 0 ? '+' : ''}{pts} pts/game</span>}
    >
      <div className="small muted mb8">
        Propose your style. Going against the <b>coach</b> or the <b>squad</b> costs execution in games. Going against the <b>supporters</b> or the <b>owner</b> makes defeats hurt more and wins earn less goodwill; a style they love turns wins into faster approval.
      </div>
      <div className="row gap4 mb8" style={{ flexWrap: 'wrap' }}>
        <span className="chip">{OFF_LABEL[plan.off]}</span>
        <span className="chip">{DEF_LABEL[plan.def]}</span>
        <span className="chip">{PACE_LABEL[plan.pace]}</span>
        <span className="spacer" />
        {PRESETS.map((p) => <Button key={p} size="sm" variant={p === 'results' ? 'primary' : undefined} onClick={() => apply(p)}>{PRESET_LABEL[p]}</Button>)}
      </div>
      <div className="grid g4">
        {views.map((v, i) => {
          const m = MOOD[v.mood];
          const r = reactionPreview(v.score);
          return (
            <motion.div key={v.who} className={`stake stake-${v.mood}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="row">
                <span className="stake-icon"><Icon name={ICON[v.who]} size={18} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="stake-title">{v.title}</div>
                  <div className="small faint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
                </div>
                <span className="spacer" />
                <Badge tone={m.tone}>{m.label}</Badge>
              </div>
              <div className="stake-bar"><motion.b animate={{ width: `${Math.round(v.score * 100)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} /></div>
              <div className="small"><b>{v.identity}</b></div>
              <div className="small faint">{v.desc}</div>
              <div className="small mt8">Wants: <span className={v.wants.off === plan.off ? 'good' : 'muted'}>{OFF_LABEL[v.wants.off]}</span> · <span className={v.wants.def === plan.def ? 'good' : 'muted'}>{DEF_LABEL[v.wants.def]}</span> · <span className={v.wants.pace === plan.pace ? 'good' : 'muted'}>{PACE_LABEL[v.wants.pace]}</span></div>
              <div className="small mt8 stake-quote">{v.quote}</div>
              {(v.who === 'fans' || v.who === 'owner') && (
                <div className="small mt8"><span className="good">After a win:</span> {r.win}. <span className="bad">After a loss:</span> {r.loss}.</div>
              )}
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

/** Small tags for a system row: which stakeholders want this option most. */
export function useLikes() {
  const w = useWorld();
  const c = getClub(w, w.user.clubId!);
  const views = stakeholderViews(w, c);
  return {
    off: (o: string) => views.filter((v) => v.wants.off === o).map((v) => v.title),
    def: (d: string) => views.filter((v) => v.wants.def === d).map((v) => v.title),
    pace: (p: string) => views.filter((v) => v.wants.pace === p).map((v) => v.title),
  };
}
