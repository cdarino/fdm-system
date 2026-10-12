export const ACTIVITY_UPDATED_EVENT = 'fdm:activity-updated';

export function notifyActivityUpdated() {
  window.dispatchEvent(new Event(ACTIVITY_UPDATED_EVENT));
}
