import { useState } from 'react';
import { useAct, useNotify, useWorld } from '../../store';
import { Button, Callout, Modal, Money, NumberField } from '../../components/ui';
import { club as getClub, playerName } from '../../../engine/world';
import { bidForPlayer, type BidResult } from '../../../engine/market';
import type { Player } from '../../../engine/types';
import ContractModal from '../club/ContractModal';

/** Transfer bid to the player's club; on acceptance opens personal-terms negotiation. */
export default function BidModal({ player, onClose }: { player: Player; onClose: () => void }) {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const uc = getClub(w, w.user.clubId!);
  const seller = player.teamId != null ? getClub(w, player.teamId) : null;
  const [fee, setFee] = useState(Math.round(player.value / 5000) * 5000);
  const [res, setRes] = useState<BidResult | null>(null);
  const [terms, setTerms] = useState<number | null>(null);
  if (terms != null) return <ContractModal player={player} mode="sign" feeAgreed={terms} onClose={onClose} />;
  return (
    <Modal title={`Transfer bid: ${playerName(player)}`} onClose={onClose}>
      <div className="kv small">
        <span>Club</span><span>{seller?.name ?? 'Free agent'}</span>
        <span>Market value</span><span><Money v={player.value} /></span>
        <span>Release clause</span><span>{player.contract?.buyout != null ? <Money v={player.contract.buyout} /> : 'None'}</span>
        <span>Contract</span><span>{player.contract ? `${Math.round(player.contract.salary / 1000)}k/yr until ${player.contract.expires + 1}` : '—'}</span>
        <span>Your cash</span><span><Money v={uc.finances.cash} /> · transfer budget <Money v={uc.finances.budget.transfer} /></span>
      </div>
      <div className="row mt16">
        <span>Offer</span>
        <NumberField value={fee} step={5000} min={0} onChange={setFee} prefix="€" width={140} />
        {player.contract?.buyout != null && <Button size="sm" onClick={() => setFee(player.contract!.buyout!)}>Pay the clause</Button>}
        <span className="spacer" />
        <Button variant="primary" onClick={() => {
          const r = act((ww) => bidForPlayer(ww, getClub(ww, uc.id), player, fee));
          setRes(r);
          if (r.outcome === 'counter' && r.counterFee) setFee(r.counterFee);
          if (r.outcome === 'blocked' || r.outcome === 'rejected') notify(r.message, 'bad');
        }}>Submit bid</Button>
      </div>
      {fee > uc.finances.budget.transfer && <div className="small warn mt8">This exceeds your transfer budget; the board will judge the overspend.</div>}
      {res && (
        <div className="mt16">
          <Callout tone={res.outcome === 'accepted' ? 'good' : res.outcome === 'counter' ? 'warn' : 'bad'}>{res.message}</Callout>
          {res.outcome === 'accepted' && <div className="row mt8"><span className="spacer" /><Button variant="primary" onClick={() => setTerms(fee)}>Negotiate personal terms →</Button></div>}
        </div>
      )}
    </Modal>
  );
}
