import type { ExplanationFactor, Tactics } from '../types';
import type { SimResult, SimTeamOut } from './game';
import { DEF_LABEL, OFF_LABEL } from '../staff';

interface Ctx {
  us: 0 | 1;
  tactics: [Tactics, Tactics];
  names: Map<number, string>;
  injuredNames: string[];
  starterFoulMinutesLost: number;
  /** Management inputs the player controls: [home, away]. */
  context?: { coachFit: [number, number]; freshness: [number, number]; morale: [number, number]; cohesion: [number, number]; squadFit?: [number, number] };
}

/**
 * "Why we won / lost": at least three causal factors, each with an estimated
 * points swing (positive = helped the user's team) and an actionable hint.
 */
export function explainGame(res: SimResult, ctx: Ctx): ExplanationFactor[] {
  const u = res.teams[ctx.us];
  const o = res.teams[1 - ctx.us];
  const ut = ctx.tactics[ctx.us];
  const ot = ctx.tactics[1 - ctx.us];
  const won = u.score > o.score;
  const f: ExplanationFactor[] = [];

  // Rebounding / second chance
  const orbDiff = u.orb - o.orb;
  const scDiff = u.secondChance - o.secondChance;
  f.push({
    title: orbDiff >= 0 ? `Won the offensive glass by ${orbDiff}` : `Lost the offensive glass by ${-orbDiff}`,
    detail: `Second-chance points ${u.secondChance}–${o.secondChance}. Total rebounds ${u.orb + u.drb}–${o.orb + o.drb}.`,
    impact: scDiff * 0.9,
    category: 'rebounding',
    suggestion: scDiff < -5 ? (ut.reboundEmphasis < 1 ? 'Raise rebounding emphasis or play a bigger lineup.' : 'Your bigs are outmatched on the boards; consider a stronger rebounder.') : undefined,
  });

  // Turnovers
  const tovDiff = o.tov - u.tov;
  f.push({
    title: tovDiff >= 0 ? `Forced ${tovDiff} more turnovers` : `Committed ${-tovDiff} more turnovers`,
    detail: `Turnovers ${u.tov}–${o.tov}; points off turnovers ${u.offTov}–${o.offTov}; fast-break points ${u.fastBreak}–${o.fastBreak}.`,
    impact: (u.offTov - o.offTov) * 0.8 + tovDiff * 0.4,
    category: 'turnovers',
    suggestion: tovDiff < -4 ? (ot.def === 'pressure' ? 'Their pressure hurt you: start a second ball-handler or slow the pace.' : 'Ball security issue: a motion offence with weak passers or a fast pace raises turnovers.') : undefined,
  });

  // Three-point shooting
  const u3 = u.thrA ? u.thrM / u.thrA : 0;
  const o3 = o.thrA ? o.thrM / o.thrA : 0;
  const exp3 = 0.34;
  f.push({
    title: `Three-point shooting ${u.thrM}/${u.thrA} vs ${o.thrM}/${o.thrA}`,
    detail: `${pct(u3)} against ${pct(o3)}. ${u.thrA > o.thrA + 6 ? 'You took many more threes.' : o.thrA > u.thrA + 6 ? 'They lived beyond the arc.' : ''}`,
    impact: (u3 - exp3) * u.thrA * 3 - (o3 - exp3) * o.thrA * 3,
    category: 'shooting',
    suggestion:
      o3 > 0.4 && o.thrA >= 24 && (ut.def === 'packPaint' || ut.def === 'zone')
        ? `Your ${DEF_LABEL[ut.def]} conceded open threes; Switch or Drop protect the arc better.`
        : u3 < 0.3 && u.thrA >= 25
          ? 'Too many low-percentage threes: lower three-point emphasis or add a real shooter.'
          : undefined,
  });

  // Rim
  const uRim = u.rimA ? u.rimM / u.rimA : 0;
  const oRim = o.rimA ? o.rimM / o.rimA : 0;
  f.push({
    title: `Paint points ${u.paint}–${o.paint}`,
    detail: `At the rim: ${u.rimM}/${u.rimA} (${pct(uRim)}) vs ${o.rimM}/${o.rimA} (${pct(oRim)}).`,
    impact: (u.paint - o.paint) * 0.45,
    category: 'tactics',
    suggestion:
      o.paint - u.paint > 10
        ? ut.def === 'pressure' || ut.def === 'switch'
          ? `They attacked the rim against your ${DEF_LABEL[ut.def]}; Drop or Pack the Paint protects it better.`
          : 'They dominated inside: you need a rim protector.'
        : undefined,
  });

  // Free throws
  f.push({
    title: `Free throws ${u.ftM}/${u.ftA} vs ${o.ftM}/${o.ftA}`,
    detail: `Free-throw attempts ${u.ftA}–${o.ftA}. Team fouls ${u.fouls}–${o.fouls}.`,
    impact: (u.ftM - o.ftM) * 0.85,
    category: 'freeThrows',
    suggestion: o.ftA - u.ftA > 8 ? (ut.foulDiscipline > 0 ? 'Aggressive defence sent them to the line: lower foul aggression.' : 'Opponents drew fouls at will; your interior defenders were overmatched.') : undefined,
  });

  // Bench
  f.push({
    title: `Bench scoring ${u.bench}–${o.bench}`,
    detail: u.bench > o.bench ? 'Your second unit outscored theirs.' : 'Their reserves outscored yours.',
    impact: (u.bench - o.bench) * 0.35,
    category: 'bench',
    suggestion: o.bench - u.bench > 12 ? (ut.rotation === 'tight' ? 'A tight rotation tired your starters; consider a balanced rotation.' : 'Bench quality gap: depth signings would help.') : undefined,
  });

  // Fouls
  if (ctx.starterFoulMinutesLost >= 8) {
    f.push({
      title: 'Foul trouble limited your starters',
      detail: `Starters spent about ${Math.round(ctx.starterFoulMinutesLost)} minutes fewer on court than usual because of fouls.`,
      impact: -ctx.starterFoulMinutesLost * 0.25,
      category: 'fouls',
      suggestion: 'Lower foul aggression, or rest players earlier with fouls.',
    });
  }

  // Star performance
  const bestUs = [...u.players].sort((a, b) => b.pts - a.pts)[0];
  const bestThem = [...o.players].sort((a, b) => b.pts - a.pts)[0];
  if (bestThem && bestThem.pts >= 24) {
    f.push({
      title: `${ctx.names.get(bestThem.playerId) ?? 'Their star'} scored ${bestThem.pts}`,
      detail: `${bestThem.fgm}/${bestThem.fga} from the field, ${bestThem.tpm}/${bestThem.tpa} from three.`,
      impact: -(bestThem.pts - 14) * 0.5,
      category: 'star',
      suggestion: 'Better perimeter defenders or a Switch scheme reduce star isolations.',
    });
  }
  if (bestUs && bestUs.pts >= 22) {
    f.push({
      title: `${ctx.names.get(bestUs.playerId) ?? 'Your star'} delivered ${bestUs.pts} points`,
      detail: `${bestUs.fgm}/${bestUs.fga} FG, ${bestUs.ast} assists, ${bestUs.orb + bestUs.drb} rebounds.`,
      impact: (bestUs.pts - 14) * 0.5,
      category: 'star',
    });
  }

  // Clutch
  if (u.clutchPts + o.clutchPts > 0) {
    f.push({
      title: `Closing minutes ${u.clutchPts}–${o.clutchPts}`,
      detail: 'Scoring in the final four minutes of a close game.',
      impact: (u.clutchPts - o.clutchPts) * 0.9,
      category: 'clutch',
      suggestion: o.clutchPts > u.clutchPts + 4 ? 'Late-game execution: players with high clutch ratings make the difference.' : undefined,
    });
  }

  // Tactical matchup note
  const matchup = tacticalNote(ut, ot, u, o);
  if (matchup) f.push(matchup);

  if (ctx.injuredNames.length) {
    f.push({
      title: `Injury: ${ctx.injuredNames.join(', ')}`,
      detail: 'Lost during the game; rotation had to adapt.',
      impact: -3 * ctx.injuredNames.length,
      category: 'injury',
    });
  }

  // Management factors — the levers the player actually pulls between games
  if (ctx.context) {
    const k = ctx.context;
    const me = ctx.us, them = 1 - ctx.us;
    if (k.coachFit[me] < 2) f.push({ title: k.coachFit[me] === 0 ? 'Your coach was running systems he doesn\'t believe in' : 'Only half of the game plan matched your coach', detail: 'Execution suffers when the offensive or defensive system differs from the head coach\'s preferred philosophy.', impact: -(2 - k.coachFit[me]) * 1.5, category: 'tactics', suggestion: 'Align tactics with the coach\'s preferences (Team → Tactics shows them), or hire a coach who fits your plan.' });
    else if (k.coachFit[them] < 2) f.push({ title: 'Your coach was in his element', detail: 'Both systems matched his philosophy; the opponent\'s staff did not have that edge.', impact: 1.5, category: 'tactics' });
    if (k.squadFit && k.squadFit[me] < 0.45) f.push({ title: 'The roster does not suit the game plan', detail: 'Your systems ask your players for skills they do not have: forced shots and broken possessions.', impact: -Math.round((0.6 - k.squadFit[me]) * 12 * 10) / 10, category: 'tactics', suggestion: 'Team → Tactics: pick a plan the squad fits ("Fit the squad"), or sign players for your system.' });
    else if (k.squadFit && k.squadFit[me] >= 0.85 && k.squadFit[them] < 0.7) f.push({ title: 'A game plan built for this roster', detail: 'Your systems played to your players\' strengths.', impact: 1.2, category: 'tactics' });
    const fd = k.freshness[me] - k.freshness[them];
    if (Math.abs(fd) >= 6) f.push({ title: fd < 0 ? 'Tired legs' : 'Fresher legs', detail: `Average freshness of your rotation ${Math.round(k.freshness[me])} vs ${Math.round(k.freshness[them])}.`, impact: fd * 0.25, category: 'fatigue', suggestion: fd < 0 ? 'Lighten training intensity, deepen the rotation, or improve the physio and locker-room facilities.' : undefined });
    const md = k.morale[me] - k.morale[them];
    if (Math.abs(md) >= 8) f.push({ title: md < 0 ? 'A divided locker room' : 'High morale', detail: `Average morale ${Math.round(k.morale[me])} vs ${Math.round(k.morale[them])}.`, impact: md * 0.12, category: 'tactics', suggestion: md < 0 ? 'Check roles and minutes promises in Team → Players; unhappy players shoot worse.' : undefined });
    const cd = k.cohesion[me] - k.cohesion[them];
    if (Math.abs(cd) >= 12) f.push({ title: cd < 0 ? 'New squad, little chemistry' : 'Chemistry of a settled squad', detail: `Team cohesion ${Math.round(k.cohesion[me])} vs ${Math.round(k.cohesion[them])}.`, impact: cd * 0.08, category: 'tactics', suggestion: cd < 0 ? 'Cohesion grows week by week; tactical training and fewer roster changes speed it up.' : undefined });
  }

  // Pick factors aligned with the outcome, biggest magnitude first.
  const sign = won ? 1 : -1;
  const aligned = f.filter((x) => Math.sign(x.impact) === sign).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const other = f.filter((x) => Math.sign(x.impact) !== sign).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const out = [...aligned.slice(0, 4)];
  const rest = [...aligned.slice(4), ...other];
  while (out.length < 3 && rest.length) out.push(rest.shift()!);
  if (other[0] && !out.includes(other[0]) && out.length < 5) out.push(other[0]); // one counterpoint
  return out.map((x) => ({ ...x, impact: Math.round(x.impact * 10) / 10 }));
}

function tacticalNote(ut: Tactics, ot: Tactics, u: SimTeamOut, o: SimTeamOut): ExplanationFactor | null {
  if (ot.def === 'drop' && u.midA >= 14) {
    const p = u.midM / u.midA;
    return {
      title: `Their Drop coverage gave you ${u.midA} mid-range looks`,
      detail: `You converted ${u.midM}/${u.midA} (${pct(p)}).`,
      impact: (p - 0.4) * u.midA * 2,
      category: 'tactics',
      suggestion: p < 0.38 ? 'Against Drop, a good pull-up shooter or a Pace & Space system punishes it.' : undefined,
    };
  }
  if (ot.def === 'zone' && u.thrA >= 24) {
    const p = u.thrM / u.thrA;
    return {
      title: 'Their zone forced you to shoot from outside',
      detail: `${u.thrA} three-point attempts against the zone (${pct(p)}).`,
      impact: (p - 0.34) * u.thrA * 3,
      category: 'tactics',
      suggestion: p < 0.32 ? 'Beat the zone with better shooters or a Post / Inside-Out offence.' : undefined,
    };
  }
  if (ut.off === 'paceSpace' && u.thrA > 0 && u.thrM / u.thrA < 0.3) {
    return {
      title: `${OFF_LABEL[ut.off]} without the shooting`,
      detail: `Your system generated ${u.thrA} threes but the personnel made only ${u.thrM}.`,
      impact: -(0.34 - u.thrM / u.thrA) * u.thrA * 3,
      category: 'tactics',
      suggestion: 'Check the personnel fit in Tactics: this system needs at least three reliable shooters.',
    };
  }
  if (ut.def === 'pressure' && o.tov >= 15) {
    return {
      title: 'Your pressure defence created chaos',
      detail: `${o.tov} opponent turnovers, ${u.fastBreak} fast-break points.`,
      impact: (o.tov - 12) * 0.9,
      category: 'transition',
    };
  }
  return null;
}

function pct(v: number) {
  return `${Math.round(v * 1000) / 10}%`;
}
