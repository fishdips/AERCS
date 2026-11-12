import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, FileText, Info, Link2, Search, TriangleAlert } from 'lucide-react';
import ActivityShell from '../../activities/components/ActivityShell';
import Icon from '../../../shared/components/Icon';
import { useAuth } from '../../../shared/hooks/useAuth';
import { ACTIVITY_CREATE_ROLES } from '../../activities/constants';
import { HELP_SECTIONS } from '../helpContent';
import './HelpPage.css';

// Flattens a section's text so search can match anything inside it.
function sectionText(section) {
  const parts = [section.title, section.summary];
  section.blocks.forEach((block) => {
    if (block.text) parts.push(block.text);
    (block.items || []).forEach((item) => {
      if (typeof item === 'string') parts.push(item);
      else if (Array.isArray(item)) parts.push(...item);
      else parts.push(item.label, item.sub);
    });
  });
  return parts.join(' ').toLowerCase();
}

function Flow({ items }) {
  return (
    <ol className="help-flow">
      {items.map((item, index) => (
        <li className="help-flow-step" key={item.label}>
          <span className="am-workflow-marker help-marker-dark">{index + 1}</span>
          <span className="help-flow-text">
            <span className="help-flow-label">{item.label}</span>
            <span className="help-flow-sub">{item.sub}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

// One stored file used by several activities: the idea behind "reference".
function ReuseDiagram() {
  const targets = ['Research Seminar', 'Faculty Development', 'Instruction Review'];
  return (
    <div className="help-reuse" role="img" aria-label="One uploaded file is referenced by three activities without being copied">
      <div className="help-reuse-file">
        <Icon as={FileText} size={18} />
        <span>
          <span className="help-reuse-name">Certificate.pdf</span>
          <span className="help-reuse-sub">Uploaded once</span>
        </span>
      </div>
      <div className="help-reuse-targets">
        {targets.map((name) => (
          <div className="help-reuse-target" key={name}>
            <Icon as={Link2} size={14} />
            <span>{name}</span>
          </div>
        ))}
      </div>
      <p className="help-reuse-caption">Referenced, not copied</p>
    </div>
  );
}

function Block({ block, canCreate }) {
  switch (block.type) {
    case 'p':
      return <p className="help-p">{block.text}</p>;
    case 'steps':
      return (
        <ol className="help-steps">
          {block.items.map((item) => <li key={item}>{item}</li>)}
        </ol>
      );
    case 'list':
      return (
        <ul className="help-list">
          {block.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      );
    case 'tip':
      return (
        <div className="help-note">
          <Icon as={Info} size={15} />
          <p>{block.text}</p>
        </div>
      );
    case 'warning':
      return (
        <div className="am-alert am-alert-warning">
          <Icon as={TriangleAlert} size={15} />
          <span className="am-alert-text">{block.text}</span>
        </div>
      );
    case 'faq':
      return (
        <dl className="help-faq">
          {block.items.map(([question, answer]) => (
            <div key={question}>
              <dt>{question}</dt>
              <dd>{answer}</dd>
            </div>
          ))}
        </dl>
      );
    case 'flow':
      return <Flow items={block.items} />;
    case 'reuse':
      return <ReuseDiagram />;
    case 'goto':
      if (block.needsCreate && !canCreate) return null;
      return (
        <Link className="am-btn-secondary help-goto" to={block.to}>
          {block.label} <Icon as={ArrowRight} />
        </Link>
      );
    default:
      return null;
  }
}

function Topic({ section, canCreate }) {
  return (
    <section className="help-topic" id={section.id}>
      <h2 className="help-topic-title">{section.title}</h2>
      <p className="help-topic-summary">{section.summary}</p>
      {section.blocks.map((block, index) => (
        <Block block={block} canCreate={canCreate} key={`${section.id}-${index}`} />
      ))}
    </section>
  );
}

export default function HelpPage() {
  const location = useLocation();
  const { user } = useAuth();
  const canCreate = ACTIVITY_CREATE_ROLES.includes(user?.role);
  const [query, setQuery] = useState('');

  const indexed = useMemo(
    () => HELP_SECTIONS.map((section) => ({ section, text: sectionText(section) })),
    [],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP_SECTIONS;
    return indexed.filter(({ text }) => text.includes(q)).map(({ section }) => section);
  }, [indexed, query]);

  const top = visible.filter((section) => section.layout === 'top');
  const middle = visible.filter((section) => !section.layout);
  const bottom = visible.filter((section) => section.layout === 'bottom');

  // Deep links such as /help#referencing scroll to that topic.
  useEffect(() => {
    const id = location.hash.replace('#', '');
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [location.hash]);

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Support / Help</p>
      <div className="help-header">
        <div>
          <h1 className="am-page-title">Help</h1>
          <p className="help-intro">Quick guides for using AERCS.</p>
        </div>
        <label className="help-search">
          <Icon as={Search} size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help"
            aria-label="Search help"
          />
        </label>
      </div>

      {visible.length === 0 && (
        <p className="am-empty am-empty-plain">Nothing found for "{query}".</p>
      )}

      {top.map((section) => <Topic section={section} canCreate={canCreate} key={section.id} />)}

      {middle.length > 0 && (
        <div className="help-columns">
          {middle.map((section) => <Topic section={section} canCreate={canCreate} key={section.id} />)}
        </div>
      )}

      {bottom.map((section) => <Topic section={section} canCreate={canCreate} key={section.id} />)}
    </ActivityShell>
  );
}
