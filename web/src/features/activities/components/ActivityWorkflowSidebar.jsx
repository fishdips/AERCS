import { Link } from 'react-router-dom';

const steps = [
  { key: 'create', label: 'Create Activity' },
  { key: 'upload', label: 'Upload Evidence' },
  { key: 'metadata', label: 'Assign Metadata' },
];

export default function ActivityWorkflowSidebar({ activeStep, activityId, completedSteps = [], disabledSteps = [] }) {
  const stepHref = (key) => {
    if (key === 'create') return '/activities/new';
    if (!activityId) return '';
    if (key === 'upload') return `/activities/${activityId}/evidence`;
    return `/activities/${activityId}/metadata`;
  };

  return (
    <aside className="am-workflow-sidebar">
      <p className="am-section-label">Workflow</p>
      <ol className="am-workflow-stepper">
        {steps.map((step, index) => {
          const active = step.key === activeStep;
          const completed = completedSteps.includes(step.key);
          const disabled = disabledSteps.includes(step.key);
          const href = stepHref(step.key);
          const content = (
            <>
              <span className="am-workflow-marker">{index + 1}</span>
              <span>{step.label}</span>
            </>
          );

          return (
            <li
              className={[
                'am-workflow-step',
                active ? 'am-workflow-step-active' : '',
                completed ? 'am-workflow-step-completed' : '',
                disabled ? 'am-workflow-step-disabled' : '',
              ].filter(Boolean).join(' ')}
              key={step.key}
            >
              {href && (activityId || step.key === 'create') && !disabled ? (
                <Link to={href}>{content}</Link>
              ) : (
                <span className="am-workflow-static">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
