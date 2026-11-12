// Help Center content. Plain data on purpose: edit the wording here without touching layout code.
//
// Each section: { id, title, summary, blocks: [...] }
// Block types:
//   { type: 'p', text }                       short paragraph
//   { type: 'steps', items: [] }              numbered steps
//   { type: 'list', items: [] }               bullet list
//   { type: 'tip' | 'warning', text }         highlighted note
//   { type: 'flow', items: [{ label, sub }] } step diagram
//   { type: 'reuse' }                         "upload once, reuse" diagram
//   { type: 'faq', items: [[question, answer]] }
//   { type: 'goto', label, to, needsCreate }  button that opens a page (needsCreate: staff roles only)
//
// Section `layout`: 'top' or 'bottom' spans the full width; otherwise it sits in the two-column grid.

export const HELP_SECTIONS = [
  {
    id: 'getting-started',
    layout: 'top',
    title: 'Getting started',
    summary: 'The 4 steps for every activity.',
    blocks: [
      {
        type: 'flow',
        items: [
          { label: 'Create', sub: 'the activity' },
          { label: 'Upload', sub: 'the proof' },
          { label: 'Tag', sub: 'with metadata' },
          { label: 'Reuse or share', sub: 'when needed' },
        ],
      },
      {
        type: 'list',
        items: [
          'Documentation: your activities and their evidence.',
          'Repository: search evidence from all offices.',
          'Shared Evidence: your evidence that others reuse.',
          'Dashboard: what needs your attention.',
        ],
      },
    ],
  },
  {
    id: 'create-activity',
    title: 'Create an activity',
    summary: 'Record what your office did.',
    blocks: [
      {
        type: 'steps',
        items: [
          'Go to Documentation and click New Activity.',
          'Fill in the title, type, date, accreditation area, and academic year. These are required.',
          'Click Create.',
        ],
      },
      {
        type: 'tip',
        text: 'Not sure which accreditation area to pick? Choose the one an accreditor would check for this proof.',
      },
      {
        type: 'warning',
        text: 'Only the creator can edit or delete an activity. An activity with evidence cannot be deleted.',
      },
      { type: 'goto', label: 'Create an activity', to: '/activities/new', needsCreate: true },
    ],
  },
  {
    id: 'upload-evidence',
    title: 'Upload evidence',
    summary: 'Attach files or links as proof.',
    blocks: [
      {
        type: 'steps',
        items: [
          'Open the activity and choose Upload Evidence.',
          'Drag in your files, or pick them from your computer.',
          'Confirm the upload.',
        ],
      },
      {
        type: 'list',
        items: [
          'Allowed files: PDF, DOCX, XLSX, JPG, JPEG, PNG.',
          'Maximum size: 10 MB per file.',
          'No file? You can add a Google Drive link instead.',
        ],
      },
      {
        type: 'tip',
        text: 'Use clear file names, like "CCS_Seminar_Attendance.pdf". They make searching much easier.',
      },
    ],
  },
  {
    id: 'add-metadata',
    title: 'Add metadata',
    summary: 'Tag your files so others can find them.',
    blocks: [
      {
        type: 'steps',
        items: [
          'Open the activity and go to the metadata step.',
          'Tick the files to tag. You can tick several at once.',
          'Pick the evidence type and related offices. Add tags if you like.',
          'Save.',
        ],
      },
      {
        type: 'tip',
        text: 'Tag every office that could use the file as proof. Untagged files show up under "Missing Metadata" on your dashboard.',
      },
    ],
  },
  {
    id: 'referencing',
    title: 'Reference evidence',
    summary: 'Reuse a file in another activity without uploading it again.',
    blocks: [
      {
        type: 'p',
        text: 'One file often supports more than one activity. Instead of uploading copies, reference the file you already have. It stays stored once, and AERCS tracks where it is used.',
      },
      { type: 'reuse' },
      {
        type: 'steps',
        items: [
          'Open your activity and click Reference Evidence. You can also find the file in the Repository.',
          'Search for the file you need.',
          'Choose the activity that will use it, then confirm.',
        ],
      },
      {
        type: 'list',
        items: [
          'You can only reference into your own office’s activities.',
          'You cannot reference a file into the activity it came from, or twice into the same activity.',
          'Removing a reference does not delete the file.',
        ],
      },
      { type: 'goto', label: 'Browse Repository', to: '/repository' },
    ],
  },
  {
    id: 'share-accreditor',
    title: 'Share with an accreditor',
    summary: 'Give an accreditor view-only access.',
    blocks: [
      {
        type: 'steps',
        items: [
          'Open an activity and choose Generate Accreditor Access.',
          'Pick the files to share (or the whole activity), a name, an expiry date, and the accreditor.',
          'Confirm. The accreditor is emailed and sees the link when they sign in.',
        ],
      },
      {
        type: 'list',
        items: [
          'Access is view-only.',
          'After the expiry date, the accreditor can no longer open the link.',
          'Only the person who made a link can edit, extend, or delete it.',
        ],
      },
    ],
  },
  {
    id: 'faq',
    layout: 'bottom',
    title: 'Quick answers',
    summary: 'Common problems.',
    blocks: [
      {
        type: 'faq',
        items: [
          ['My file won’t upload.', 'Check that it is a PDF, DOCX, XLSX, JPG, JPEG, or PNG, and under 10 MB.'],
          ['I can’t delete an activity.', 'Only its creator can, and only if it has no evidence.'],
          ['I can’t find another office’s file.', 'You only see evidence you are allowed to view. Ask the owner to tag your office.'],
          ['An accreditor can’t open their link.', 'The link may have expired, or it was not assigned to their account.'],
          ['I forgot my password.', 'Use "Forgot password" on the sign-in page.'],
        ],
      },
    ],
  },
];
