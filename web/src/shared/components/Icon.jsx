// Thin wrapper so every icon in the app shares the same size and alignment.
export default function Icon({ as: Component, size = 14, ...props }) {
  return <Component className="ui-icon" size={size} aria-hidden="true" {...props} />;
}
