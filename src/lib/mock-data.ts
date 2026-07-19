// ─── Mock data for local development ─────────────────────────

export const MOCK_CATEGORIES = [
  { id: 'cat-a', name: 'Cat A', display_order: 1 },
  { id: 'cat-b', name: 'Cat B', display_order: 2 },
  { id: 'cat-c', name: 'Cat C', display_order: 3 },
  { id: 'cat-d', name: 'Cat D', display_order: 4 },
]

export const MOCK_EVENTS = [
  { id: 'ev-1', category_id: 'cat-a', name: 'Best Speaker', rulebook_url: null, max_entries: 2, is_team_event: false, team_size: null, event_date: '2025-08-10', event_time: '09:00', venue: 'Main Hall', assigned_members: null, criteria_count: 4, criteria_names: null, rules: null, created_at: new Date().toISOString(), categories: MOCK_CATEGORIES[0] },
  { id: 'ev-2', category_id: 'cat-a', name: 'Debate', rulebook_url: null, max_entries: 1, is_team_event: true, team_size: 2, event_date: '2025-08-10', event_time: '11:00', venue: 'Main Hall', assigned_members: null, criteria_count: 4, criteria_names: null, rules: null, created_at: new Date().toISOString(), categories: MOCK_CATEGORIES[0] },
  { id: 'ev-3', category_id: 'cat-a', name: 'Essay Writing', rulebook_url: null, max_entries: 2, is_team_event: false, team_size: null, event_date: '2025-08-11', event_time: '09:00', venue: 'Room 101', assigned_members: null, criteria_count: 3, criteria_names: null, rules: null, created_at: new Date().toISOString(), categories: MOCK_CATEGORIES[0] },
  { id: 'ev-4', category_id: 'cat-b', name: 'Drawing', rulebook_url: null, max_entries: 2, is_team_event: false, team_size: null, event_date: '2025-08-11', event_time: '10:00', venue: 'Art Room', assigned_members: null, criteria_count: 3, criteria_names: null, rules: null, created_at: new Date().toISOString(), categories: MOCK_CATEGORIES[1] },
  { id: 'ev-5', category_id: 'cat-b', name: 'Collage', rulebook_url: null, max_entries: 1, is_team_event: true, team_size: 3, event_date: '2025-08-11', event_time: '13:00', venue: 'Art Room', assigned_members: null, criteria_count: 3, criteria_names: null, rules: null, created_at: new Date().toISOString(), categories: MOCK_CATEGORIES[1] },
  { id: 'ev-6', category_id: 'cat-c', name: 'Dance', rulebook_url: null, max_entries: 1, is_team_event: true, team_size: 5, event_date: '2025-08-12', event_time: '09:00', venue: 'Auditorium', assigned_members: null, criteria_count: 4, criteria_names: null, rules: null, created_at: new Date().toISOString(), categories: MOCK_CATEGORIES[2] },
  { id: 'ev-7', category_id: 'cat-c', name: 'Singing', rulebook_url: null, max_entries: 2, is_team_event: false, team_size: null, event_date: '2025-08-12', event_time: '11:30', venue: 'Auditorium', assigned_members: null, criteria_count: 4, criteria_names: null, rules: null, created_at: new Date().toISOString(), categories: MOCK_CATEGORIES[2] },
  { id: 'ev-8', category_id: 'cat-d', name: 'Quiz', rulebook_url: null, max_entries: 1, is_team_event: true, team_size: 3, event_date: '2025-08-12', event_time: '14:00', venue: 'Conference Room', assigned_members: null, criteria_count: 4, criteria_names: null, rules: null, created_at: new Date().toISOString(), categories: MOCK_CATEGORIES[3] },
  { id: 'ev-9', category_id: 'cat-d', name: 'Science Model', rulebook_url: null, max_entries: 1, is_team_event: true, team_size: 2, event_date: '2025-08-13', event_time: '10:00', venue: 'Science Lab', assigned_members: null, criteria_count: 4, criteria_names: null, rules: null, created_at: new Date().toISOString(), categories: MOCK_CATEGORIES[3] },
]

export const MOCK_SCHOOLS = [
  { id: 'school-1', user_id: 'local-school-1', school_name: 'St. Joseph\'s School', slot_number: 1, email: 'slot1@reflections.in', password_plain: 'slot123', created_at: new Date().toISOString() },
  { id: 'school-2', user_id: 'local-school-2', school_name: 'Holy Cross School', slot_number: 2, email: 'slot2@reflections.in', password_plain: 'slot123', created_at: new Date().toISOString() },
  { id: 'school-3', user_id: 'local-school-3', school_name: 'National Public School', slot_number: 3, email: 'slot3@reflections.in', password_plain: 'slot123', created_at: new Date().toISOString() },
]

export const MOCK_PARTICIPANTS = [
  { id: 'p-1', slot_number: 1, event_id: 'ev-1', participant_name: 'Arjun Sharma', entry_index: 1, member_index: 1, created_at: new Date().toISOString() },
  { id: 'p-2', slot_number: 1, event_id: 'ev-1', participant_name: 'Priya Nair', entry_index: 2, member_index: 1, created_at: new Date().toISOString() },
  { id: 'p-3', slot_number: 1, event_id: 'ev-4', participant_name: 'Riya Menon', entry_index: 1, member_index: 1, created_at: new Date().toISOString() },
  { id: 'p-4', slot_number: 2, event_id: 'ev-1', participant_name: 'Karan Patel', entry_index: 1, member_index: 1, created_at: new Date().toISOString() },
  { id: 'p-5', slot_number: 2, event_id: 'ev-6', participant_name: 'Anjali Thomas', entry_index: 1, member_index: 1, created_at: new Date().toISOString() },
  { id: 'p-6', slot_number: 2, event_id: 'ev-6', participant_name: 'Sneha Rao', entry_index: 1, member_index: 2, created_at: new Date().toISOString() },
  { id: 'p-7', slot_number: 3, event_id: 'ev-1', participant_name: 'Dev Krishnan', entry_index: 1, member_index: 1, created_at: new Date().toISOString() },
  { id: 'p-8', slot_number: 3, event_id: 'ev-8', participant_name: 'Ananya Pillai', entry_index: 1, member_index: 1, created_at: new Date().toISOString() },
]

export const MOCK_MARKS = [
  { id: 'm-1', slot_number: 1, event_id: 'ev-1', entry_index: 1, scores: [45, 38], total: 83, finalized: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'm-2', slot_number: 2, event_id: 'ev-1', entry_index: 1, scores: [50, 40], total: 90, finalized: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'm-3', slot_number: 3, event_id: 'ev-1', entry_index: 1, scores: [42, 35], total: 77, finalized: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'm-4', slot_number: 1, event_id: 'ev-4', entry_index: 1, scores: [60], total: 60, finalized: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'm-5', slot_number: 2, event_id: 'ev-4', entry_index: 1, scores: [55], total: 55, finalized: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
]

export const MOCK_RESULTS = [
  {
    id: 'r-1', event_id: 'ev-1',
    first_slot: 2, second_slot: 1, third_slot: 3,
    winners_json: JSON.stringify([
      { rank: 1, total: 90, entries: [{ slot: 2, entry: 1, names: 'Karan Patel' }] },
      { rank: 2, total: 83, entries: [{ slot: 1, entry: 1, names: 'Arjun Sharma' }] },
      { rank: 3, total: 77, entries: [{ slot: 3, entry: 1, names: 'Dev Krishnan' }] },
    ]),
    published: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    events: { ...MOCK_EVENTS[0], categories: MOCK_CATEGORIES[0] },
  },
]

export const MOCK_ANNOUNCEMENTS = [
  { id: 'ann-1', title: 'Welcome to Reflections 2025!', message: 'Registration is now open. Please fill in your participant details for each event before the deadline.', created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'ann-2', title: 'Rulebooks Available', message: 'Rulebooks for all events have been uploaded. Please review them carefully before submitting participants.', created_at: new Date(Date.now() - 3600000).toISOString() },
]

export const MOCK_SETTINGS = { id: 1, registration_open: true, points_1st: 15, points_2nd: 10, points_3rd: 5, unlock_password: null, security_answer_1: null, security_answer_2: null }

export const MOCK_ONSPOT: any[] = []
