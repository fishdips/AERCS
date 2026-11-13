// What the activity page should say when it can't open an activity, from the server's answer:
//   403  the activity exists but belongs to another department or office  -> "no access"
//   404  there is no such activity (deleted, or a wrong address)           -> "not found"
//   else a network or server problem                                       -> "could not be loaded"
export function describeActivityLoadError(error) {
  const status = error?.response?.status;
  if (status === 403) {
    return { kind: 'noAccess', message: "You don't have access to this activity." };
  }
  if (status === 404) {
    return { kind: 'notFound', message: 'Activity not found.' };
  }
  return { kind: 'failed', message: 'The activity could not be loaded. Please try again.' };
}
