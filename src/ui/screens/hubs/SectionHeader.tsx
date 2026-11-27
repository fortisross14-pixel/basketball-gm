import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon } from '../../art/icons';
import { sectionOf, subsectionOf, depthOf } from './nav';
import './hubs.css';

/** Breadcrumb strip + compact sibling switcher shown above every subsection page. */
export function SectionHeader() {
  const loc = useLocation();
  const nav = useNavigate();
  const depth = depthOf(loc.pathname);
  const section = sectionOf(loc.pathname);
  const { item } = subsectionOf(loc.pathname);
  if (!section?.items || depth === 0) return null;
  return (
    <motion.div className="crumbbar" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      {/* back = the screen you came from; with no history (fresh link) fall back to the section hub */}
      <button type="button" className="crumb-back crumb-back-btn" aria-label="Back to the previous screen" title="Back" onClick={() => (loc.key !== 'default' && window.history.length > 1 ? nav(-1) : nav(section.hub!))}>
        <span className="crumb-back-icon"><Icon name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }} /></span>
      </button>
      <Link to={section.hub!} className="crumb-back" aria-label={`Open ${section.label}`}>
        <span className="crumb-section"><Icon name={section.icon} size={18} /> {section.label}</span>
      </Link>
      <span className="crumb-sep">›</span>
      <span className="crumb-current">{item ? <><Icon name={item.icon} size={18} /> {item.label}</> : 'Details'}</span>
      <span className="spacer" />
      <nav className="sibling-switch" aria-label={`${section.label} pages`}>
        {section.items.map((s) => (
          <NavLink key={s.to} to={s.to} title={s.label} className={({ isActive }) => (isActive || loc.pathname.startsWith(`${s.to}/`) ? 'active' : '')}>
            <Icon name={s.icon} size={17} />
            <span className="sib-label">{s.label}</span>
          </NavLink>
        ))}
      </nav>
    </motion.div>
  );
}
